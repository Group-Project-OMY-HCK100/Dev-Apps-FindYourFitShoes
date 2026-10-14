'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Chat, { foreignKey: 'chatId', as: 'chat' });
      Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
    }
  }

  Message.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      chatId: { type: DataTypes.UUID, allowNull: false, field: 'chat_id' },
      senderId: { type: DataTypes.UUID, allowNull: false, field: 'sender_id' },
      clientMessageId: { type: DataTypes.UUID, allowNull: false, field: 'client_message_id' },
      text: { type: DataTypes.TEXT, allowNull: false },
      readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      underscored: true,
      updatedAt: false,
      indexes: [{ unique: true, fields: ['sender_id', 'client_message_id'] }],
    },
  );

  return Message;
};
