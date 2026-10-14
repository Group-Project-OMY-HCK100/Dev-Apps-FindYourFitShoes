'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Shoe extends Model {
    static associate(models) {
      Shoe.belongsTo(models.User, { foreignKey: 'userId', as: 'seller' });
      Shoe.hasMany(models.Chat, { foreignKey: 'shoeId', as: 'chats' });
    }
  }

  const imageFields = {};
  for (let index = 1; index <= 5; index += 1) {
    imageFields[`imgUrl${index}`] = {
      type: DataTypes.STRING(2048),
      allowNull: index !== 1,
      field: `img_url_${index}`,
    };
    imageFields[`imgPublicId${index}`] = {
      type: DataTypes.STRING,
      allowNull: true,
      field: `img_public_id_${index}`,
    };
  }

  Shoe.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      brand: { type: DataTypes.STRING(60), allowNull: false },
      article: { type: DataTypes.STRING(120), allowNull: false },
      category: { type: DataTypes.STRING(20), allowNull: false },
      condition: { type: DataTypes.STRING(20), allowNull: false },
      size: { type: DataTypes.DECIMAL(3, 1), allowNull: false },
      color: { type: DataTypes.STRING(20), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      price: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'available' },
      ...imageFields,
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    },
    {
      sequelize,
      modelName: 'Shoe',
      tableName: 'shoes',
      underscored: true,
      paranoid: true,
      deletedAt: 'deletedAt',
    },
  );

  return Shoe;
};
