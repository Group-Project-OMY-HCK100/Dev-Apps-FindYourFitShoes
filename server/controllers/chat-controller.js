const { Op, literal } = require('sequelize');
const { Chat, Shoe, Message } = require('../models');
const chatService = require('../services/chat-service');
const asyncHandler = require('../utils/async-handler');
const ApiError = require('../utils/api-error');
const { parsePagination } = require('../utils/pagination');
const { assertUuid, rejectUnknownFields, validationError } = require('../validators/common');

function emitRead(io, result, readerId) {
  if (!io) return;
  const payload = { chatId: result.chat.id, readerId, lastReadMessageId: result.lastReadMessageId };
  io.to(`chat:${result.chat.id}`).emit('chat:read:updated', payload);
  chatService.totalUnread(readerId).then((totalUnread) => {
    io.to(`user:${readerId}`).emit('unread:update', { totalUnread, chatId: result.chat.id, unreadCount: result.unreadCount });
  }).catch(() => {});
}

const create = asyncHandler(async (req, res) => {
  rejectUnknownFields(req.body, ['shoeId']);
  const shoeId = assertUuid(req.body.shoeId, 'shoeId');
  const result = await chatService.getOrCreate(shoeId, req.user.id);
  const data = await chatService.serializeChat(result.chat, req.user.id);
  if (result.created) {
    const io = req.app.get('io');
    if (io) {
      try {
        io.to(`user:${result.chat.buyerId}`).emit('chat:created', data);
        io.to(`user:${result.chat.shoe.userId}`).emit('chat:created', await chatService.serializeChat(result.chat, result.chat.shoe.userId));
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') console.error('Gagal broadcast chat:created:', error.message);
      }
    }
  }
  res.status(result.created ? 201 : 200).json({ success: true, data });
});

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const where = { [Op.or]: [{ buyerId: req.user.id }, { '$shoe.user_id$': req.user.id }] };
  const options = {
    where,
    include: chatService.chatInclude,
    order: [[literal('"last_message_at" IS NULL'), 'ASC'], ['lastMessageAt', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  };
  const { rows, count } = await Chat.findAndCountAll(options);
  const data = await Promise.all(rows.map((chat) => chatService.serializeChat(chat, req.user.id)));
  res.json({ success: true, data, meta: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } });
});

const detail = asyncHandler(async (req, res) => {
  assertUuid(req.params.id, 'id');
  const chat = await chatService.findParticipantChat(req.params.id, req.user.id);
  res.json({ success: true, data: await chatService.serializeChat(chat, req.user.id) });
});

function parseMessageLimit(value) {
  if (value === undefined) return 30;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 100) throw validationError([{ field: 'limit', message: 'limit harus 1–100' }]);
  return Number(value);
}

const messages = asyncHandler(async (req, res) => {
  assertUuid(req.params.id, 'id');
  await chatService.findParticipantChat(req.params.id, req.user.id);
  const { before, after } = req.query;
  if (before && after) throw validationError([{ field: 'cursor', message: 'before dan after tidak boleh dipakai bersamaan' }]);
  const cursorId = before || after;
  if (cursorId) assertUuid(cursorId, before ? 'before' : 'after');
  const limit = parseMessageLimit(req.query.limit);
  let cursor;
  if (cursorId) {
    cursor = await Message.findOne({ where: { id: cursorId, chatId: req.params.id } });
    if (!cursor) throw new ApiError(422, 'INVALID_CURSOR', 'Cursor bukan bagian dari chat ini');
  }
  const where = { chatId: req.params.id };
  let order = [['createdAt', 'DESC'], ['id', 'DESC']];
  if (before) where[Op.or] = [{ createdAt: { [Op.lt]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [Op.lt]: cursor.id } }];
  if (after) {
    where[Op.or] = [{ createdAt: { [Op.gt]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [Op.gt]: cursor.id } }];
    order = [['createdAt', 'ASC'], ['id', 'ASC']];
  }
  const rows = await Message.findAll({ where, order, limit: limit + 1 });
  const hasMore = rows.length > limit;
  const batch = rows.slice(0, limit);
  if (!after) batch.reverse();
  const nextCursor = hasMore ? (after ? batch.at(-1)?.id : batch[0]?.id) : null;
  res.json({ success: true, data: batch.map(chatService.serializeMessage), meta: { limit, hasMore, nextCursor } });
});

const read = asyncHandler(async (req, res) => {
  assertUuid(req.params.id, 'id');
  rejectUnknownFields(req.body, ['lastReadMessageId']);
  if (req.body.lastReadMessageId !== undefined) assertUuid(req.body.lastReadMessageId, 'lastReadMessageId');
  const result = await chatService.markRead(req.params.id, req.user.id, req.body.lastReadMessageId);
  emitRead(req.app.get('io'), result, req.user.id);
  res.json({ success: true, data: { chatId: result.chat.id, readCount: result.readCount, unreadCount: result.unreadCount } });
});

module.exports = { create, list, detail, messages, read, emitRead };
