'use strict';

const bcrypt = require('bcryptjs');
const usersJson = require('../db/users.json');
const shoesJson = require('../db/shoes.json');

const USER_ID_PREFIX = '10000000-0000-4000-8000-';
const SHOE_ID_PREFIX = '20000000-0000-4000-8000-';
const CATEGORIES = new Set(['running', 'casual', 'formal', 'basketball', 'hiking', 'sneakers', 'other']);
const CONDITIONS = new Set(['new', 'like_new', 'good', 'fair']);
const COLORS = new Set(['black', 'white', 'gray', 'red', 'blue', 'green', 'yellow', 'brown', 'beige', 'purple', 'pink', 'orange', 'neon', 'multicolor', 'other']);

function deterministicId(prefix, index) {
  return `${prefix}${String(index + 1).padStart(12, '0')}`;
}

function requireText(value, field, index, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} pada data ke-${index + 1} wajib berupa teks`);
  }
  const normalized = value.trim();
  if (maxLength && normalized.length > maxLength) {
    throw new Error(`${field} pada data ke-${index + 1} maksimal ${maxLength} karakter`);
  }
  return normalized;
}

function prepareUsers() {
  if (!Array.isArray(usersJson) || usersJson.length === 0) {
    throw new Error('db/users.json wajib berupa array yang tidak kosong');
  }

  const emails = new Set();
  return usersJson.map((user, index) => {
    const name = requireText(user.name, 'name', index, 80);
    const email = requireText(user.email, 'email', index, 320).toLowerCase();
    const password = user.password ?? user.password_hash;

    if (!email.includes('@')) throw new Error(`email pada data user ke-${index + 1} tidak valid`);
    if (emails.has(email)) throw new Error(`email duplikat di db/users.json: ${email}`);
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8) {
      throw new Error(`password pada data user ke-${index + 1} minimal 8 byte`);
    }

    emails.add(email);
    return { id: deterministicId(USER_ID_PREFIX, index), name, email, password };
  });
}

function prepareShoes(userIds) {
  if (!Array.isArray(shoesJson)) throw new Error('db/shoes.json wajib berupa array');

  return shoesJson.map((shoe, index) => {
    const userIndex = Number(shoe.user_id) - 1;
    if (!Number.isInteger(userIndex) || !userIds[userIndex]) {
      throw new Error(`user_id pada data sepatu ke-${index + 1} tidak merujuk ke urutan user yang valid`);
    }

    const category = requireText(shoe.category, 'category', index, 20);
    const condition = requireText(shoe.condition, 'condition', index, 20);
    const color = requireText(shoe.color, 'color', index, 20);
    const size = Number(shoe.size);
    const price = Number(shoe.price);

    if (!CATEGORIES.has(category)) throw new Error(`category pada data sepatu ke-${index + 1} tidak valid`);
    if (!CONDITIONS.has(condition)) throw new Error(`condition pada data sepatu ke-${index + 1} tidak valid`);
    if (!COLORS.has(color)) throw new Error(`color pada data sepatu ke-${index + 1} tidak valid`);
    if (!Number.isFinite(size) || size < 35 || size > 50 || size * 2 % 1 !== 0) {
      throw new Error(`size pada data sepatu ke-${index + 1} harus 35-50 dengan kelipatan 0,5`);
    }
    if (!Number.isSafeInteger(price) || price <= 0) {
      throw new Error(`price pada data sepatu ke-${index + 1} wajib berupa bilangan bulat positif`);
    }

    const images = {};
    for (let imageIndex = 1; imageIndex <= 5; imageIndex += 1) {
      const field = `img_url_${imageIndex}`;
      const value = shoe[field];
      if (imageIndex === 1) images[field] = requireText(value, field, index, 2048);
      else images[field] = value == null ? null : requireText(value, field, index, 2048);
    }

    return {
      id: deterministicId(SHOE_ID_PREFIX, index),
      user_id: userIds[userIndex],
      brand: requireText(shoe.brand, 'brand', index, 60),
      article: requireText(shoe.article, 'article', index, 120),
      category,
      condition,
      size,
      color,
      description: requireText(shoe.description, 'description', index),
      price,
      status: shoe.status ?? 'available',
      ...images,
    };
  });
}

module.exports = {
  async up(queryInterface) {
    const users = prepareUsers();
    const shoes = prepareShoes(users.map(({ id }) => id));
    const now = new Date();

    const userRows = await Promise.all(users.map(async ({ password, ...user }) => ({
      ...user,
      password_hash: await bcrypt.hash(password, 10),
      created_at: now,
      updated_at: now,
    })));
    const shoeRows = shoes.map((shoe) => ({ ...shoe, created_at: now, updated_at: now }));

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert('users', userRows, { transaction });
      await queryInterface.bulkInsert('shoes', shoeRows, { transaction });
    });
  },

  async down(queryInterface) {
    const userIds = usersJson.map((_, index) => deterministicId(USER_ID_PREFIX, index));
    const shoeIds = shoesJson.map((_, index) => deterministicId(SHOE_ID_PREFIX, index));

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('shoes', { id: shoeIds }, { transaction });
      await queryInterface.bulkDelete('users', { id: userIds }, { transaction });
    });
  },
};
