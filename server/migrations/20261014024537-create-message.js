'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()') },
      chat_id: { allowNull: false, type: Sequelize.UUID, references: { model: 'chats', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      sender_id: { allowNull: false, type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      client_message_id: { allowNull: false, type: Sequelize.UUID },
      text: { allowNull: false, type: Sequelize.TEXT },
      read_at: { allowNull: true, type: Sequelize.DATE },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('messages', { fields: ['sender_id', 'client_message_id'], type: 'unique', name: 'messages_sender_client_unique' });
    await queryInterface.addIndex('messages', ['chat_id', { attribute: 'created_at', order: 'DESC' }, { attribute: 'id', order: 'DESC' }], { name: 'messages_chat_created_idx' });
    await queryInterface.addIndex('messages', ['chat_id', 'read_at'], { name: 'messages_chat_unread_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('messages');
  },
};
