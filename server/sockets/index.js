const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Message, Shoe, User } = require('../models');
const env = require('../config/env');
const ApiError = require('../utils/api-error');
const chatService = require('../services/chat-service');
const { assertUuid, rejectUnknownFields, validationError } = require('../validators/common');

function socketError(error) {
  return {
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.status >= 500 || !error.status ? 'Terjadi kesalahan pada server' : error.message,
    },
  };
}

function withAck(handler) {
  return async (payload = {}, ack = () => {}) => {
    let acknowledged = false;
    const respond = (value) => {
      if (!acknowledged) { acknowledged = true; ack(value); }
    };
    try { respond({ success: true, data: await handler(payload) }); } catch (error) {
      if (!error.status && process.env.NODE_ENV !== 'test') console.error(error);
      respond(socketError(error));
      if (error.code === 'TOKEN_EXPIRED') error.socket.disconnect(true);
    }
  };
}

function requireAuthenticated(socket) {
  if (!socket.user) throw new ApiError(401, 'UNAUTHORIZED', 'Socket terautentikasi diperlukan');
  if (socket.tokenExpiresAt <= Date.now()) {
    const error = new ApiError(401, 'TOKEN_EXPIRED', 'Token socket telah kedaluwarsa');
    error.socket = socket;
    throw error;
  }
}

function scheduleExpiry(socket) {
  if (!Number.isFinite(socket.tokenExpiresAt) || !socket.connected) return;
  const remaining = socket.tokenExpiresAt - Date.now();
  if (remaining <= 0) { socket.disconnect(true); return; }
  socket.expiryTimer = setTimeout(() => scheduleExpiry(socket), Math.min(remaining, 2_147_483_647));
}

function eventBudget(socket, bucket = 'private', limit = 120) {
  const now = Date.now();
  socket.eventBudgets ||= {};
  const events = (socket.eventBudgets[bucket] || []).filter((time) => now - time < 60000);
  socket.eventBudgets[bucket] = events;
  if (events.length >= limit) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak event socket');
  events.push(now);
}

async function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    if (env.jwtSecret.length < 32) throw new Error('JWT secret missing or too short');
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findByPk(payload.sub);
    if (!user) throw new Error('User not found');
    socket.user = user;
    socket.tokenExpiresAt = payload.exp * 1000;
    next();
  } catch {
    const error = new Error('UNAUTHORIZED');
    error.data = { code: 'UNAUTHORIZED', message: 'Token socket tidak valid atau kedaluwarsa' };
    next(error);
  }
}

async function broadcastPresence(io, userId, online, targetSocket, connectionCounts, broadcast = true) {
  try {
    const contacts = await chatService.contactUserIds(userId);
    if (broadcast) contacts.forEach((contactId) => io.to(`user:${contactId}`).emit('presence:update', { userId, online }));
    if (targetSocket) {
      for (const contactId of contacts) {
        targetSocket.emit('presence:update', { userId: contactId, online: (connectionCounts.get(contactId) || 0) > 0 });
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error('Gagal memperbarui presence:', error.message);
  }
}

function registerSockets(io) {
  const connectionCounts = new Map();
  const ipCounts = new Map();
  io.use(socketAuth);
  io.use((socket, next) => {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const ip = env.nodeEnv === 'production' && typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim() : socket.handshake.address;
    const count = ipCounts.get(ip) || 0;
    if (count >= env.socketMaxConnectionsPerIp) {
      const error = new Error('RATE_LIMITED');
      error.data = { code: 'RATE_LIMITED', message: 'Batas koneksi socket per IP tercapai' };
      return next(error);
    }
    ipCounts.set(ip, count + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const remaining = (ipCounts.get(ip) || 1) - 1;
      if (remaining) ipCounts.set(ip, remaining);
      else ipCounts.delete(ip);
    };
    socket.once('disconnect', release);
    socket.conn.once('close', release);
    next();
  });
  io.on('connection', async (socket) => {
    socket.listingSubscriptions = new Set();

    socket.on('catalog:join', withAck(async (payload) => {
      eventBudget(socket, 'public', 60);
      rejectUnknownFields(payload, []);
      await socket.join('catalog');
      return { joined: true };
    }));
    socket.on('catalog:leave', withAck(async (payload) => {
      eventBudget(socket, 'public', 60);
      rejectUnknownFields(payload, []);
      await socket.leave('catalog');
      return { joined: false };
    }));
    socket.on('listing:join', withAck(async (payload) => {
      eventBudget(socket, 'public', 60);
      rejectUnknownFields(payload, ['shoeId']);
      const shoeId = assertUuid(payload.shoeId, 'shoeId');
      const shoe = await Shoe.findByPk(shoeId);
      if (!shoe) throw new ApiError(404, 'SHOE_NOT_FOUND', 'Sepatu tidak ditemukan');
      if (!socket.listingSubscriptions.has(shoeId) && socket.listingSubscriptions.size >= 50) {
        throw new ApiError(429, 'RATE_LIMITED', 'Batas subscription listing tercapai');
      }
      await socket.join(`shoes:${shoeId}`);
      socket.listingSubscriptions.add(shoeId);
      return { joined: true, shoeId };
    }));
    socket.on('listing:leave', withAck(async (payload) => {
      eventBudget(socket, 'public', 60);
      rejectUnknownFields(payload, ['shoeId']);
      const shoeId = assertUuid(payload.shoeId, 'shoeId');
      await socket.leave(`shoes:${shoeId}`);
      socket.listingSubscriptions.delete(shoeId);
      return { joined: false, shoeId };
    }));

    socket.on('chat:join', withAck(async (payload) => {
      requireAuthenticated(socket);
      eventBudget(socket);
      rejectUnknownFields(payload, ['chatId']);
      const chatId = assertUuid(payload.chatId, 'chatId');
      try { await chatService.findParticipantChat(chatId, socket.user.id); } catch (error) {
        if (error.code === 'CHAT_NOT_FOUND') throw new ApiError(403, 'FORBIDDEN', 'Bukan peserta chat ini');
        throw error;
      }
      await socket.join(`chat:${chatId}`);
      return { joined: true, chatId };
    }));
    socket.on('chat:leave', withAck(async (payload) => {
      requireAuthenticated(socket);
      eventBudget(socket);
      rejectUnknownFields(payload, ['chatId']);
      const chatId = assertUuid(payload.chatId, 'chatId');
      await chatService.findParticipantChat(chatId, socket.user.id);
      await socket.leave(`chat:${chatId}`);
      return { joined: false, chatId };
    }));

    socket.on('message:send', withAck(async (payload) => {
      requireAuthenticated(socket);
      eventBudget(socket);
      rejectUnknownFields(payload, ['chatId', 'clientMessageId', 'text']);
      const chatId = assertUuid(payload.chatId, 'chatId');
      const clientMessageId = assertUuid(payload.clientMessageId, 'clientMessageId');
      if (typeof payload.text !== 'string') throw validationError([{ field: 'text', message: 'text harus string' }]);
      const text = payload.text.trim();
      if (text.length < 1 || text.length > 2000) throw validationError([{ field: 'text', message: 'text harus 1–2.000 karakter setelah trim' }]);
      const result = await chatService.persistMessage({ chatId, senderId: socket.user.id, clientMessageId, text });
      const message = chatService.serializeMessage(result.message);
      if (result.created) {
        const receiverId = result.chat.buyerId === socket.user.id ? result.chat.shoe.userId : result.chat.buyerId;
        io.to(`chat:${chatId}`).emit('message:new', message);
        try {
          const [unreadCount, totalUnread] = await Promise.all([
            Message.count({ where: { chatId, senderId: { [Op.ne]: receiverId }, readAt: null } }),
            chatService.totalUnread(receiverId),
          ]);
          io.to(`user:${receiverId}`).emit('notification:new', { chatId, message, unreadCount });
          io.to(`user:${receiverId}`).emit('unread:update', { totalUnread, chatId, unreadCount });
        } catch (error) {
          if (process.env.NODE_ENV !== 'test') console.error('Gagal broadcast notification unread:', error.message);
        }
      }
      return { message };
    }));

    for (const [incoming, isTyping] of [['typing:start', true], ['typing:stop', false]]) {
      socket.on(incoming, withAck(async (payload) => {
        requireAuthenticated(socket);
        eventBudget(socket);
        rejectUnknownFields(payload, ['chatId']);
        const chatId = assertUuid(payload.chatId, 'chatId');
        await chatService.findParticipantChat(chatId, socket.user.id);
        socket.to(`chat:${chatId}`).emit('typing:update', { chatId, userId: socket.user.id, isTyping });
        return { chatId, isTyping };
      }));
    }

    socket.on('chat:read', withAck(async (payload) => {
      requireAuthenticated(socket);
      eventBudget(socket);
      rejectUnknownFields(payload, ['chatId', 'lastReadMessageId']);
      const chatId = assertUuid(payload.chatId, 'chatId');
      if (payload.lastReadMessageId !== undefined) assertUuid(payload.lastReadMessageId, 'lastReadMessageId');
      const result = await chatService.markRead(chatId, socket.user.id, payload.lastReadMessageId);
      io.to(`chat:${chatId}`).emit('chat:read:updated', { chatId, readerId: socket.user.id, lastReadMessageId: result.lastReadMessageId });
      io.to(`user:${socket.user.id}`).emit('unread:update', {
        totalUnread: await chatService.totalUnread(socket.user.id), chatId, unreadCount: result.unreadCount,
      });
      return { chatId, readCount: result.readCount, unreadCount: result.unreadCount };
    }));

    socket.on('disconnecting', () => {
      if (!socket.user) return;
      for (const room of socket.rooms) {
        if (room.startsWith('chat:')) socket.to(room).emit('typing:update', { chatId: room.slice(5), userId: socket.user.id, isTyping: false });
      }
    });

    socket.on('disconnect', () => {
      clearTimeout(socket.expiryTimer);
      if (socket.presenceCounted) {
        const remainingConnections = Math.max(0, (connectionCounts.get(socket.user.id) || 1) - 1);
        if (remainingConnections) connectionCounts.set(socket.user.id, remainingConnections);
        else connectionCounts.delete(socket.user.id);
        if (!remainingConnections) void broadcastPresence(io, socket.user.id, false, null, connectionCounts);
      }
    });

    if (socket.user) {
      await socket.join(`user:${socket.user.id}`);
      if (!socket.connected) return;
      const previousConnections = connectionCounts.get(socket.user.id) || 0;
      connectionCounts.set(socket.user.id, previousConnections + 1);
      socket.presenceCounted = true;
      scheduleExpiry(socket);
      void broadcastPresence(io, socket.user.id, true, socket, connectionCounts, previousConnections === 0);
    }
  });
}

module.exports = { registerSockets, socketAuth, withAck };
