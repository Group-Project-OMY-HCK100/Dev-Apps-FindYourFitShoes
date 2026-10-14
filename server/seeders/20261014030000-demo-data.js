'use strict';

const bcrypt = require('bcryptjs');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const SELLER_ID = '10000000-0000-4000-8000-000000000002';
const SHOE_ID = '20000000-0000-4000-8000-000000000001';

module.exports = {
  async up(queryInterface) {
    const password = process.env.DEMO_USER_PASSWORD;
    if (!password || Buffer.byteLength(password, 'utf8') < 8) {
      throw new Error('Set DEMO_USER_PASSWORD (minimal 8 byte) sebelum menjalankan demo seed');
    }
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 10);
    await queryInterface.bulkInsert('users', [
      { id: BUYER_ID, name: 'Raka', email: 'raka.demo@example.com', password_hash: passwordHash, created_at: now, updated_at: now },
      { id: SELLER_ID, name: 'Dimas', email: 'dimas.demo@example.com', password_hash: passwordHash, created_at: now, updated_at: now },
    ]);
    await queryInterface.bulkInsert('shoes', [{
      id: SHOE_ID,
      user_id: SELLER_ID,
      brand: 'Nike',
      article: 'Air Max 90',
      category: 'casual',
      condition: 'good',
      size: 42,
      color: 'black',
      description: 'Kondisi baik, sol masih bagus, dan jarang dipakai.',
      price: 450000,
      status: 'available',
      img_url_1: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      created_at: now,
      updated_at: now,
    }]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('shoes', { id: SHOE_ID });
    await queryInterface.bulkDelete('users', { id: [BUYER_ID, SELLER_ID] });
  },
};
