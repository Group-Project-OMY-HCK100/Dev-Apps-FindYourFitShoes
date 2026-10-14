'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()') },
      name: { allowNull: false, type: Sequelize.STRING(80) },
      email: { allowNull: false, type: Sequelize.STRING(320) },
      password_hash: { allowNull: false, type: Sequelize.STRING },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));');
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
