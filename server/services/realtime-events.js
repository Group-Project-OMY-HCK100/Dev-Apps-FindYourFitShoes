const chatService = require('./chat-service');

async function emitReadUpdated(io, { result, readerId }) {
  if (!io) return;
  const chatId = result.chat.id;
  io.to(`chat:${chatId}`).emit('chat:read:updated', { chatId, readerId, lastReadMessageId: result.lastReadMessageId });
  const totalUnread = await chatService.totalUnread(readerId);
  io.to(`user:${readerId}`).emit('unread:update', { totalUnread, chatId, unreadCount: result.unreadCount });
}

module.exports = { emitReadUpdated };
