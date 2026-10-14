const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const shouldRun = process.env.RUN_DB_TESTS === '1';

test('REST marketplace dan Socket.io mengikuti alur kontrak utama', { skip: !shouldRun }, async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-secret-with-at-least-32-characters';
  process.env.CLIENT_ORIGINS = 'http://localhost:5173';

  const cloudinary = require('../../services/cloudinary-service');
  let imageSequence = 0;
  cloudinary.uploadMany = async (files) => files.map(() => {
    imageSequence += 1;
    return { url: `https://res.cloudinary.com/test/image/upload/shoe-${imageSequence}.jpg`, publicId: `shoe-${imageSequence}` };
  });
  cloudinary.cleanupMany = async () => {};

  const { io: clientIo } = require('socket.io-client');
  const { sequelize, Message, Chat, Shoe, User } = require('../../models');
  const { buildServer } = require('../../server');
  await sequelize.authenticate();
  await Message.destroy({ where: {}, truncate: true, cascade: true });
  await Chat.destroy({ where: {}, truncate: true, cascade: true });
  await Shoe.destroy({ where: {}, force: true, truncate: true, cascade: true });
  await User.destroy({ where: {}, truncate: true, cascade: true });

  const { httpServer, io } = buildServer();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
    await Message.destroy({ where: {}, truncate: true, cascade: true });
    await Chat.destroy({ where: {}, truncate: true, cascade: true });
    await Shoe.destroy({ where: {}, force: true, truncate: true, cascade: true });
    await User.destroy({ where: {}, truncate: true, cascade: true });
    await sequelize.close();
  });

  async function json(path, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }

  async function register(name) {
    const email = `${name.toLowerCase().replace(' ', '-')}-${randomUUID()}@example.com`;
    const response = await json('/register', { method: 'POST', body: { name, email, password: 'Rahasia123!' } });
    assert.equal(response.status, 201);
    return { ...response.body.data, email };
  }

  assert.deepEqual(await json('/health'), { status: 200, body: { success: true, data: { status: 'ok', service: 'soleswap-api' } } });

  const seller = await register('Seller');
  const buyer = await register('Buyer');
  const otherBuyer = await register('Buyer Dua');
  const duplicate = await json('/register', { method: 'POST', body: { name: 'Duplikat', email: seller.email.toUpperCase(), password: 'Rahasia123!' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_EXISTS');
  const badLogin = await json('/login', { method: 'POST', body: { email: seller.email, password: 'salah-password' } });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error.code, 'INVALID_CREDENTIALS');

  const form = new FormData();
  Object.entries({
    brand: 'Nike', article: 'Air Max 90', category: 'casual', condition: 'good', size: '42', color: 'black',
    description: 'Kondisi baik dan jarang sekali dipakai.', price: '450000',
  }).forEach(([key, value]) => form.append(key, value));
  form.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' }), 'shoe.jpg');
  const createResponse = await fetch(`${baseUrl}/shoes`, { method: 'POST', headers: { Authorization: `Bearer ${seller.accessToken}` }, body: form });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.data.status, 'available');
  assert.equal(created.data.currency, 'IDR');
  const shoeId = created.data.id;

  const catalog = await json('/shoes?status=all');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.data.length, 1);
  assert.equal(Object.hasOwn(catalog.body.data[0], 'description'), false);

  function updateForm(price) {
    const update = new FormData();
    Object.entries({
      brand: 'Nike', article: 'Air Max 90', category: 'casual', condition: 'good', size: '42', color: 'black',
      description: 'Kondisi baik dan jarang sekali dipakai.', price: String(price),
      retainedImageUrls: JSON.stringify([created.data.imgUrl1]),
    }).forEach(([key, value]) => update.append(key, value));
    return update;
  }
  const forbiddenEdit = await fetch(`${baseUrl}/shoes/${shoeId}`, { method: 'PUT', headers: { Authorization: `Bearer ${buyer.accessToken}` }, body: updateForm(400000) });
  assert.equal(forbiddenEdit.status, 403);
  const ownerEdit = await fetch(`${baseUrl}/shoes/${shoeId}`, { method: 'PUT', headers: { Authorization: `Bearer ${seller.accessToken}` }, body: updateForm(400000) });
  assert.equal(ownerEdit.status, 200);
  assert.equal((await ownerEdit.json()).data.price, 400000);
  const aiService = require('../../services/ai-service');
  const aiFiltered = await aiService.queryByFilters({ category: 'casual', maxPrice: 500000, preferColors: ['black'] }, 12);
  const aiExcluded = await aiService.queryByFilters({ category: 'casual', excludeColors: ['black'] }, 12);
  assert.equal(aiFiltered[0].id, shoeId);
  assert.equal(aiExcluded.length, 0);

  const selfChat = await json('/chats', { method: 'POST', token: seller.accessToken, body: { shoeId } });
  assert.equal(selfChat.status, 403);
  assert.equal(selfChat.body.error.code, 'SELF_CHAT_NOT_ALLOWED');
  const firstChat = await json('/chats', { method: 'POST', token: buyer.accessToken, body: { shoeId } });
  assert.equal(firstChat.status, 201);
  const repeatedChat = await json('/chats', { method: 'POST', token: buyer.accessToken, body: { shoeId } });
  assert.equal(repeatedChat.status, 200);
  assert.equal(repeatedChat.body.data.id, firstChat.body.data.id);
  const chatId = firstChat.body.data.id;
  const buyerInbox = await json('/chats', { token: buyer.accessToken });
  const sellerInbox = await json('/chats', { token: seller.accessToken });
  assert.equal(buyerInbox.status, 200, JSON.stringify(buyerInbox.body));
  assert.equal(sellerInbox.status, 200, JSON.stringify(sellerInbox.body));
  assert.equal(buyerInbox.body.data[0].id, chatId);
  assert.equal(sellerInbox.body.data[0].id, chatId);

  function connect(token) {
    return new Promise((resolve, reject) => {
      const socket = clientIo(baseUrl, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }
  function emitAck(socket, event, payload) {
    return new Promise((resolve, reject) => socket.timeout(5000).emit(event, payload, (error, ack) => (error ? reject(error) : resolve(ack))));
  }
  const sellerSocket = await connect(seller.accessToken);
  const buyerOnline = new Promise((resolve) => sellerSocket.on('presence:update', (payload) => {
    if (payload.userId === buyer.user.id && payload.online) resolve(payload);
  }));
  const buyerSocket = await connect(buyer.accessToken);
  assert.equal((await buyerOnline).online, true);
  assert.equal((await emitAck(sellerSocket, 'chat:join', { chatId })).success, true);
  assert.equal((await emitAck(buyerSocket, 'chat:join', { chatId })).success, true);
  const received = new Promise((resolve) => sellerSocket.once('message:new', resolve));
  const clientMessageId = randomUUID();
  const sent = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId, text: ' Bisa COD besok? ' });
  assert.equal(sent.success, true);
  assert.equal(sent.data.message.text, 'Bisa COD besok?');
  assert.equal((await received).id, sent.data.message.id);
  const retried = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId, text: 'Bisa COD besok?' });
  assert.equal(retried.data.message.id, sent.data.message.id);
  const conflict = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId, text: 'Payload berbeda' });
  assert.equal(conflict.success, false);
  assert.equal(conflict.error.code, 'IDEMPOTENCY_CONFLICT');
  const secondSent = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId: randomUUID(), text: 'Saya tunggu kabarnya.' });
  assert.equal(secondSent.success, true);
  assert.equal(await Message.count({ where: { chatId } }), 2);

  const history = await json(`/chats/${chatId}/messages?limit=1`, { token: seller.accessToken });
  assert.equal(history.status, 200);
  assert.equal(history.body.data.length, 1);
  assert.equal(history.body.meta.hasMore, true);
  const older = await json(`/chats/${chatId}/messages?limit=1&before=${history.body.meta.nextCursor}`, { token: seller.accessToken });
  assert.equal(older.body.data[0].id, sent.data.message.id);
  const markedRead = await json(`/chats/${chatId}/read`, { method: 'PATCH', token: seller.accessToken, body: {} });
  assert.equal(markedRead.body.data.readCount, 2);
  assert.equal(markedRead.body.data.unreadCount, 0);

  const sold = await json(`/shoes/${shoeId}/status`, { method: 'PATCH', token: seller.accessToken, body: { status: 'sold' } });
  assert.equal(sold.status, 200);
  const blockedChat = await json('/chats', { method: 'POST', token: otherBuyer.accessToken, body: { shoeId } });
  assert.equal(blockedChat.status, 409);
  assert.equal(blockedChat.body.error.code, 'SHOE_NOT_AVAILABLE');
  const coordinateAfterSold = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId: randomUUID(), text: 'Baik, sampai jumpa.' });
  assert.equal(coordinateAfterSold.success, true);

  const affordable = await Shoe.create({
    userId: seller.user.id, brand: 'Adidas', article: 'Budget Runner', category: 'running', condition: 'good', size: 42,
    color: 'black', description: 'Sepatu lari dengan harga terjangkau.', price: 900000, status: 'available', imgUrl1: 'https://example.com/affordable.jpg',
  });
  const expensive = await Shoe.create({
    userId: seller.user.id, brand: 'Adidas', article: 'Premium Runner', category: 'running', condition: 'good', size: 42,
    color: 'black', description: 'Sepatu lari premium.', price: 1100000, status: 'available', imgUrl1: 'https://example.com/expensive.jpg',
  });
  const aiFallback = await json('/ai/search', { method: 'POST', body: { query: 'sepatu harga di bawah 1 juta', limit: 12 } });
  assert.equal(aiFallback.status, 200);
  assert.equal(aiFallback.body.data.mode, 'fallback');
  assert.equal(aiFallback.body.data.interpretedFilters, null);
  assert.equal(aiFallback.body.data.results.some(({ shoe }) => shoe.id === affordable.id), true);
  assert.equal(aiFallback.body.data.results.some(({ shoe }) => shoe.id === expensive.id), false);
  assert.equal(aiFallback.body.data.results.every(({ shoe }) => shoe.price <= 1000000), true);

  const newBalanceWhite = await Shoe.create({
    userId: seller.user.id, brand: 'New Balance', article: 'Fresh Foam 42', category: 'running', condition: 'good', size: 42,
    color: 'white', description: 'Sepatu putih kondisi bagus.', price: 950000, status: 'available', imgUrl1: 'https://example.com/new-balance-white.jpg',
  });
  await Shoe.create({
    userId: seller.user.id, brand: 'Adidas', article: 'Red Size 42', category: 'running', condition: 'good', size: 42,
    color: 'red', description: 'Sepatu merah ukuran empat puluh dua.', price: 800000, status: 'available', imgUrl1: 'https://example.com/adidas-red.jpg',
  });
  const sizeAboveForty = await Shoe.create({
    userId: seller.user.id, brand: 'Nike', article: 'Large Runner', category: 'running', condition: 'fair', size: 41,
    color: 'blue', description: 'Sepatu lari ukuran besar.', price: 700000, status: 'available', imgUrl1: 'https://example.com/large-runner.jpg',
  });

  const brandSearch = await json('/ai/search', {
    method: 'POST', body: { query: 'saya cari sepatu brand new balance, ukuran 42 kondisi bagus', limit: 12 },
  });
  assert.equal(brandSearch.status, 200);
  assert.equal(brandSearch.body.data.results.some(({ shoe }) => shoe.id === newBalanceWhite.id), true);
  assert.equal(brandSearch.body.data.results.every(({ shoe }) => shoe.brand === 'New Balance' && Number(shoe.size) === 42 && shoe.condition === 'good'), true);

  const sizeSearch = await json('/ai/search', { method: 'POST', body: { query: 'cari sepatu diatas 40', limit: 12 } });
  assert.equal(sizeSearch.status, 200);
  assert.equal(sizeSearch.body.data.results.some(({ shoe }) => shoe.id === sizeAboveForty.id), true);
  assert.equal(sizeSearch.body.data.results.every(({ shoe }) => Number(shoe.size) > 40), true);

  const colorSearch = await json('/ai/search', { method: 'POST', body: { query: 'cari sepatu warna putih', limit: 12 } });
  assert.equal(colorSearch.status, 200);
  assert.equal(colorSearch.body.data.results.some(({ shoe }) => shoe.id === newBalanceWhite.id), true);
  assert.equal(colorSearch.body.data.results.every(({ shoe }) => shoe.color === 'white'), true);

  for (const irrelevantQuery of ['ronaldo', 'cari sepatu ocha']) {
    const irrelevant = await json('/ai/search', { method: 'POST', body: { query: irrelevantQuery, limit: 12 } });
    assert.equal(irrelevant.status, 200);
    assert.deepEqual(irrelevant.body.data.results, []);
    assert.match(irrelevant.body.data.notice, /Masukkan prompt yang berkaitan dengan sepatu/u);
  }

  const removed = await json(`/shoes/${shoeId}`, { method: 'DELETE', token: seller.accessToken });
  assert.equal(removed.status, 204);
  assert.equal((await json(`/shoes/${shoeId}`)).status, 404);
  const readOnly = await emitAck(buyerSocket, 'message:send', { chatId, clientMessageId: randomUUID(), text: 'Pesan setelah delete' });
  assert.equal(readOnly.success, false);
  assert.equal(readOnly.error.code, 'SHOE_DELETED');
});
