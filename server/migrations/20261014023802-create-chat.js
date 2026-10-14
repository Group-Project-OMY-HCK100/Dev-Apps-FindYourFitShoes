'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chats', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()') },
      shoe_id: { allowNull: false, type: Sequelize.UUID, references: { model: 'shoes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      buyer_id: { allowNull: false, type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      last_message_at: { allowNull: true, type: Sequelize.DATE },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('chats', { fields: ['shoe_id', 'buyer_id'], type: 'unique', name: 'chats_shoe_buyer_unique' });
    await queryInterface.addIndex('chats', ['buyer_id', { attribute: 'last_message_at', order: 'DESC' }], { name: 'chats_buyer_last_message_idx' });
    await queryInterface.addIndex('chats', ['shoe_id'], { name: 'chats_shoe_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('chats');
  },
};
