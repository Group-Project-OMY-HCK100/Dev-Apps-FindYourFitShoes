'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Shoe, { foreignKey: 'userId', as: 'shoes' });
      User.hasMany(models.Chat, { foreignKey: 'buyerId', as: 'purchasedChats' });
      User.hasMany(models.Message, { foreignKey: 'senderId', as: 'messages' });
    }
  }

  User.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
      scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
    },
  );

  return User;
};
