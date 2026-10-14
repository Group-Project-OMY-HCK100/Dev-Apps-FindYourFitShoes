'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shoes', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()') },
      user_id: {
        allowNull: false,
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      brand: { allowNull: false, type: Sequelize.STRING(60) },
      article: { allowNull: false, type: Sequelize.STRING(120) },
      category: { allowNull: false, type: Sequelize.STRING(20) },
      condition: { allowNull: false, type: Sequelize.STRING(20) },
      size: { allowNull: false, type: Sequelize.DECIMAL(3, 1) },
      color: { allowNull: false, type: Sequelize.STRING(20) },
      description: { allowNull: false, type: Sequelize.TEXT },
      price: { allowNull: false, type: Sequelize.INTEGER },
      status: { allowNull: false, type: Sequelize.STRING(20), defaultValue: 'available' },
      img_url_1: { allowNull: false, type: Sequelize.STRING(2048) },
      img_url_2: { allowNull: true, type: Sequelize.STRING(2048) },
      img_url_3: { allowNull: true, type: Sequelize.STRING(2048) },
      img_url_4: { allowNull: true, type: Sequelize.STRING(2048) },
      img_url_5: { allowNull: true, type: Sequelize.STRING(2048) },
      img_public_id_1: { allowNull: true, type: Sequelize.STRING },
      img_public_id_2: { allowNull: true, type: Sequelize.STRING },
      img_public_id_3: { allowNull: true, type: Sequelize.STRING },
      img_public_id_4: { allowNull: true, type: Sequelize.STRING },
      img_public_id_5: { allowNull: true, type: Sequelize.STRING },
      deleted_at: { allowNull: true, type: Sequelize.DATE },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('shoes', { fields: ['price'], type: 'check', where: { price: { [Sequelize.Op.gt]: 0 } }, name: 'shoes_price_positive' });
    await queryInterface.addConstraint('shoes', { fields: ['status'], type: 'check', where: { status: ['available', 'sold'] }, name: 'shoes_status_valid' });
    await queryInterface.addIndex('shoes', ['user_id', { attribute: 'created_at', order: 'DESC' }], { name: 'shoes_owner_created_idx' });
    await queryInterface.addIndex('shoes', ['status', { attribute: 'created_at', order: 'DESC' }], { name: 'shoes_status_created_idx', where: { deleted_at: null } });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('shoes');
  },
};
