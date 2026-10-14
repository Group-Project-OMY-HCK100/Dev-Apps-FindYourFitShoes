const { Chat } = require('../models');
const { shoeSummary } = require('../utils/serializers');

async function participantUserIds(shoeId, sellerId) {
  const chats = await Chat.findAll({ where: { shoeId }, attributes: ['buyerId'] });
  return [...new Set([sellerId, ...chats.map((chat) => chat.buyerId)])];
}

async function emitListingEvent(io, event, shoe, payload) {
  if (!io) return;
  try {
    io.to('catalog').to(`shoes:${shoe.id}`).emit(event, payload);
    const userIds = await participantUserIds(shoe.id, shoe.userId);
    userIds.forEach((userId) => io.to(`user:${userId}`).emit(event, payload));
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error(`Gagal broadcast ${event}:`, error.message);
  }
}

async function created(io, shoe) {
  if (!io) return;
  try { io.to('catalog').emit('listing:created', { shoe: shoeSummary(shoe) }); } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error('Gagal broadcast listing:created:', error.message);
  }
}

async function updated(io, shoe) {
  await emitListingEvent(io, 'listing:updated', shoe, { shoeId: shoe.id, updatedAt: shoe.updatedAt });
}

async function status(io, shoe) {
  await emitListingEvent(io, 'listing:status', shoe, { shoeId: shoe.id, status: shoe.status, updatedAt: shoe.updatedAt });
}

async function deleted(io, shoe) {
  await emitListingEvent(io, 'listing:deleted', shoe, { shoeId: shoe.id, deletedAt: shoe.deletedAt });
}

module.exports = { created, updated, status, deleted };
