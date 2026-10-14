const { Op, UniqueConstraintError } = require('sequelize');
const { Chat, Shoe, User, Message, sequelize } = require('../models');
const ApiError = require('../utils/api-error');
const { publicUser, message: serializeMessage } = require('../utils/serializers');

const chatInclude = [
  {
    model: Shoe,
    as: 'shoe',
    paranoid: false,
    required: true,
    include: [{ model: User, as: 'seller', attributes: ['id', 'name'] }],
  },
  { model: User, as: 'buyer', attributes: ['id', 'name'] },
];

function isParticipant(chat, userId) {
  return chat.buyerId === userId || chat.shoe.userId === userId;
}

async function findParticipantChat(chatId, userId, { forbiddenCode = 'CHAT_NOT_FOUND' } = {}) {
  const chat = await Chat.findByPk(chatId, { include: chatInclude });
  if (!chat || !isParticipant(chat, userId)) {
    throw new ApiError(404, forbiddenCode, 'Chat tidak ditemukan');
  }
  return chat;
}

async function serializeChat(chat, viewerId) {
  const [lastMessage, unreadCount] = await Promise.all([
    Message.findOne({ where: { chatId: chat.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
    Message.count({ where: { chatId: chat.id, senderId: { [Op.ne]: viewerId }, readAt: null } }),
  ]);
  const seller = publicUser(chat.shoe.seller);
  const buyer = publicUser(chat.buyer);
  return {
    id: chat.id,
    shoe: {
      id: chat.shoe.id,
      brand: chat.shoe.brand,
      article: chat.shoe.article,
      imgUrl1: chat.shoe.imgUrl1,
      status: chat.shoe.status,
      isDeleted: Boolean(chat.shoe.deletedAt),
    },
    buyer,
    seller,
    otherParticipant: viewerId === chat.buyerId ? seller : buyer,
    lastMessageAt: chat.lastMessageAt || null,
    lastMessage: lastMessage ? {
      id: lastMessage.id,
      senderId: lastMessage.senderId,
      text: lastMessage.text,
      createdAt: lastMessage.createdAt,
    } : null,
    unreadCount,
    createdAt: chat.createdAt,
  };
}

async function getOrCreate(shoeId, buyerId) {
  let existing = await Chat.findOne({ where: { shoeId, buyerId }, include: chatInclude });
  if (existing) return { chat: existing, created: false };

  const shoe = await Shoe.findByPk(shoeId, { paranoid: false });
  if (!shoe || shoe.deletedAt) throw new ApiError(404, 'SHOE_NOT_FOUND', 'Sepatu tidak ditemukan');
  if (shoe.userId === buyerId) throw new ApiError(403, 'SELF_CHAT_NOT_ALLOWED', 'Tidak dapat membuat chat pada listing sendiri');
  if (shoe.status !== 'available') throw new ApiError(409, 'SHOE_NOT_AVAILABLE', 'Sepatu sudah tidak tersedia');

  let chat;
  try {
    chat = await Chat.create({ shoeId, buyerId });
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    existing = await Chat.findOne({ where: { shoeId, buyerId }, include: chatInclude });
    if (!existing) throw error;
    return { chat: existing, created: false };
  }
  await chat.reload({ include: chatInclude });
  return { chat, created: true };
}

async function totalUnread(userId) {
  const chats = await Chat.findAll({
    include: [{ model: Shoe, as: 'shoe', paranoid: false, required: true, attributes: ['userId'] }],
    attributes: ['id', 'buyerId'],
  });
  const ids = chats.filter((chat) => isParticipant(chat, userId)).map((chat) => chat.id);
  if (!ids.length) return 0;
  return Message.count({ where: { chatId: { [Op.in]: ids }, senderId: { [Op.ne]: userId }, readAt: null } });
}

async function contactUserIds(userId) {
  const chats = await Chat.findAll({ include: chatInclude });
  return [...new Set(chats
    .filter((chat) => isParticipant(chat, userId))
    .map((chat) => (chat.buyerId === userId ? chat.shoe.userId : chat.buyerId)))];
}

async function persistMessage({ chatId, senderId, clientMessageId, text }) {
  const chat = await findParticipantChat(chatId, senderId);
  if (chat.shoe.deletedAt) throw new ApiError(409, 'SHOE_DELETED', 'Listing telah dihapus dan chat menjadi read-only');

  const previous = await Message.findOne({ where: { senderId, clientMessageId } });
  if (previous) {
    if (previous.chatId !== chatId || previous.text !== text) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'clientMessageId telah dipakai untuk payload berbeda');
    return { message: previous, chat, created: false };
  }

  let saved;
  try {
    saved = await sequelize.transaction(async (transaction) => {
      const result = await Message.create({ chatId, senderId, clientMessageId, text }, { transaction });
      await Chat.update({ lastMessageAt: result.createdAt }, { where: { id: chatId }, transaction });
      return result;
    });
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const duplicate = await Message.findOne({ where: { senderId, clientMessageId } });
    if (!duplicate || duplicate.chatId !== chatId || duplicate.text !== text) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'clientMessageId telah dipakai untuk payload berbeda');
    return { message: duplicate, chat, created: false };
  }
  chat.lastMessageAt = saved.createdAt;
  return { message: saved, chat, created: true };
}

async function markRead(chatId, readerId, lastReadMessageId) {
  const chat = await findParticipantChat(chatId, readerId);
  const where = { chatId, senderId: { [Op.ne]: readerId }, readAt: null };
  let cursor = null;
  if (lastReadMessageId) {
    cursor = await Message.findOne({ where: { id: lastReadMessageId, chatId } });
    if (!cursor) throw new ApiError(422, 'INVALID_CURSOR', 'lastReadMessageId bukan bagian dari chat ini');
    where[Op.or] = [
      { createdAt: { [Op.lt]: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { [Op.lte]: cursor.id } },
    ];
  }
  const readAt = new Date();
  const [readCount] = await Message.update({ readAt }, { where });
  const unreadCount = await Message.count({ where: { chatId, senderId: { [Op.ne]: readerId }, readAt: null } });
  return { chat, readCount, unreadCount, lastReadMessageId: cursor?.id || null };
}

module.exports = {
  chatInclude,
  isParticipant,
  findParticipantChat,
  serializeChat,
  getOrCreate,
  totalUnread,
  contactUserIds,
  persistMessage,
  markRead,
  serializeMessage,
};
