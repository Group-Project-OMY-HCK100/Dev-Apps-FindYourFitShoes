'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Chat extends Model {
    static associate(models) {
      Chat.belongsTo(models.Shoe, { foreignKey: 'shoeId', as: 'shoe' });
      Chat.belongsTo(models.User, { foreignKey: 'buyerId', as: 'buyer' });
      Chat.hasMany(models.Message, { foreignKey: 'chatId', as: 'messages' });
    }
  }

  Chat.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      shoeId: { type: DataTypes.UUID, allowNull: false, field: 'shoe_id' },
      buyerId: { type: DataTypes.UUID, allowNull: false, field: 'buyer_id' },
      lastMessageAt: { type: DataTypes.DATE, allowNull: true, field: 'last_message_at' },
    },
    {
      sequelize,
      modelName: 'Chat',
      tableName: 'chats',
      underscored: true,
      updatedAt: false,
      indexes: [{ unique: true, fields: ['shoe_id', 'buyer_id'] }],
    },
  );

  return Chat;
};
