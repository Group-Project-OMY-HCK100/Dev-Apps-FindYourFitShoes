const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('Kontrak keamanan dan realtime socket', { skip: process.env.RUN_DB_TESTS !== '1', timeout: 30000 }, async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-secret-with-at-least-32-characters';
  process.env.SOCKET_MAX_CONNECTIONS_PER_IP = '8';
  const jwt = require('jsonwebtoken');
  const { io: clientIo } = require('socket.io-client');
  const cloudinary = require('../../services/cloudinary-service');
  cloudinary.uploadMany = async (files) => files.map(() => ({ url: 'https://res.cloudinary.com/test/shoe.jpg', publicId: randomUUID() }));
  cloudinary.cleanupMany = async () => {};
  const { sequelize, Message, Chat, Shoe, User } = require('../../models');
  const { buildServer } = require('../../server');
  const chatService = require('../../services/chat-service');
  const sockets = [];
  async function truncate() {
    for (const model of [Message, Chat, Shoe, User]) await model.destroy({ where: {}, force: true, truncate: true, cascade: true });
  }
  await sequelize.authenticate();
  await truncate();
  const { httpServer, io } = buildServer();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => io.close(resolve));
    await truncate();
    await sequelize.close();
  });
  const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
  function event(socket, name, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timeout ${name}`)); }, 5000);
      function listener(payload) {
        if (!predicate(payload)) return;
        clearTimeout(timer);
        socket.off(name, listener);
        resolve(payload);
      }
      socket.on(name, listener);
    });
  }
  async function connect(token, rejected = false) {
    const socket = clientIo(baseUrl, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket);
    if (rejected) return event(socket, 'connect_error');
    await event(socket, 'connect');
    return socket;
  }
  const ack = (socket, name, payload = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload, (error, result) => error ? reject(error) : resolve(result)));
  async function json(path, token, body, method = 'POST') {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  async function register(name) {
    const response = await json('/register', '', { name, email: `${randomUUID()}@example.com`, password: 'Rahasia123!' });
    assert.equal(response.status, 201);
    return response.body.data;
  }
  const seller = await register('Seller');
  const buyer = await register('Buyer');
  const outsider = await register('Outsider');
  const guest = await connect();
  assert.equal((await ack(guest, 'catalog:join')).success, true);
  for (const name of ['message:send', 'chat:join', 'typing:start', 'chat:read']) assert.equal((await ack(guest, name)).error.code, 'UNAUTHORIZED');
  assert.equal((await connect('invalid', true)).data.code, 'UNAUTHORIZED');
  assert.equal((await connect(jwt.sign({ sub: buyer.user.id }, process.env.JWT_SECRET, { expiresIn: -2 }), true)).data.code, 'UNAUTHORIZED');
  const sellerSocket = await connect(seller.accessToken);
  const buyerSocket = await connect(buyer.accessToken);
  const otherSocket = await connect(outsider.accessToken);
  const listingCreated = event(guest, 'listing:created');
  const form = new FormData();
  const fields = { brand: 'Nike', article: 'Air Max', category: 'casual', condition: 'good', size: '42', color: 'black', description: 'Sepatu dalam kondisi baik.', price: '450000' };
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0])], { type: 'image/jpeg' }), 'shoe.jpg');
  const createdResponse = await fetch(`${baseUrl}/shoes`, { method: 'POST', headers: { Authorization: `Bearer ${seller.accessToken}` }, body: form });
  assert.equal(createdResponse.status, 201);
  const shoe = (await createdResponse.json()).data;
  assert.equal((await listingCreated).shoe.id, shoe.id);
  assert.equal((await ack(guest, 'listing:join', { shoeId: shoe.id })).success, true);
  const createdForBuyer = event(buyerSocket, 'chat:created');
  const createdForSeller = event(sellerSocket, 'chat:created');
  const first = await json('/chats', buyer.accessToken, { shoeId: shoe.id });
  assert.equal(first.status, 201);
  const chatId = first.body.data.id;
  assert.equal((await createdForBuyer).id, chatId);
  assert.equal((await createdForSeller).id, chatId);
  let repeated = 0;
  buyerSocket.on('chat:created', () => { repeated += 1; });
  sellerSocket.on('chat:created', () => { repeated += 1; });
  assert.equal((await json('/chats', buyer.accessToken, { shoeId: shoe.id })).status, 200);
  await delay();
  assert.equal(repeated, 0);
  assert.equal((await ack(otherSocket, 'chat:join', { chatId })).error.code, 'FORBIDDEN');
  assert.equal((await ack(otherSocket, 'message:send', { chatId, clientMessageId: randomUUID(), text: 'Tidak boleh' })).error.code, 'CHAT_NOT_FOUND');
  assert.equal((await ack(buyerSocket, 'chat:join', { chatId })).success, true);
  const notification = event(sellerSocket, 'notification:new');
  const unread = event(sellerSocket, 'unread:update');
  const payload = { chatId, clientMessageId: randomUUID(), text: 'Halo' };
  let messageCount = 0;
  buyerSocket.on('message:new', () => { messageCount += 1; });
  const sent = await ack(buyerSocket, 'message:send', payload);
  assert.equal(sent.success, true);
  assert.equal((await notification).message.id, sent.data.message.id);
  assert.deepEqual(await unread, { totalUnread: await chatService.totalUnread(seller.user.id), chatId, unreadCount: 1 });
  await ack(buyerSocket, 'message:send', payload);
  await delay();
  assert.equal(messageCount, 1);
  const readUpdated = event(buyerSocket, 'chat:read:updated');
  const cleared = event(sellerSocket, 'unread:update');
  assert.equal((await ack(sellerSocket, 'chat:read', { chatId })).data.unreadCount, 0);
  assert.deepEqual(await readUpdated, { chatId, readerId: seller.user.id, lastReadMessageId: null });
  assert.equal((await cleared).totalUnread, 0);
  assert.equal(await chatService.totalUnread(seller.user.id), 0);
  await ack(sellerSocket, 'chat:join', { chatId });
  let selfTyping = 0;
  buyerSocket.on('typing:update', () => { selfTyping += 1; });
  for (const [name, isTyping] of [['typing:start', true], ['typing:stop', false]]) {
    const typing = event(sellerSocket, 'typing:update');
    assert.equal((await ack(buyerSocket, name, { chatId })).success, true);
    assert.deepEqual(await typing, { chatId, userId: buyer.user.id, isTyping });
  }
  assert.equal(selfTyping, 0);
  const presence = [];
  const unrelatedPresence = [];
  sellerSocket.on('presence:update', (value) => presence.push(value));
  otherSocket.on('presence:update', (value) => unrelatedPresence.push(value));
  await delay();
  presence.length = 0;
  const secondClient = clientIo(baseUrl, { auth: { token: buyer.accessToken }, transports: ['websocket'], forceNew: true, reconnection: false, autoConnect: false });
  sockets.push(secondClient);
  const snapshot = event(secondClient, 'presence:update', (value) => value.userId === seller.user.id);
  const connected = event(secondClient, 'connect');
  secondClient.connect();
  await connected;
  const buyerSecond = secondClient;
  assert.equal((await snapshot).online, true);
  await delay();
  assert.equal(presence.filter((value) => value.userId === buyer.user.id).length, 0);
  await ack(buyerSocket, 'typing:start', { chatId });
  const stopped = event(sellerSocket, 'typing:update', (value) => !value.isTyping);
  buyerSocket.disconnect();
  assert.equal((await stopped).isTyping, false);
  await delay();
  assert.equal(presence.filter((value) => value.userId === buyer.user.id && !value.online).length, 0);
  const offline = event(sellerSocket, 'presence:update', (value) => value.userId === buyer.user.id && !value.online);
  buyerSecond.disconnect();
  await offline;
  await delay();
  assert.equal(unrelatedPresence.length, 0);
  const shortToken = jwt.sign({ sub: buyer.user.id }, process.env.JWT_SECRET, { expiresIn: 2 });
  const expiring = await connect(shortToken);
  const disconnected = event(expiring, 'disconnect');
  await disconnected;
  assert.equal(expiring.connected, false);
  // Exercise the expiry guard before its timer runs, with the real ACK path.
  const guarded = await connect(buyer.accessToken);
  io.sockets.sockets.get(guarded.id).tokenExpiresAt = Date.now() - 1;
  const guardDisconnect = event(guarded, 'disconnect');
  assert.equal((await ack(guarded, 'chat:join', { chatId })).error.code, 'TOKEN_EXPIRED');
  await guardDisconnect;
  for (const name of ['listing:updated', 'listing:status', 'listing:deleted']) {
    const publicEvent = event(guest, name);
    const participantEvent = event(sellerSocket, name);
    if (name === 'listing:updated') {
      const update = new FormData();
      Object.entries({ ...fields, price: '400000', retainedImageUrls: JSON.stringify([shoe.imgUrl1]) }).forEach(([key, value]) => update.append(key, value));
      const response = await fetch(`${baseUrl}/shoes/${shoe.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${seller.accessToken}` }, body: update });
      assert.equal(response.status, 200);
    } else if (name === 'listing:status') assert.equal((await json(`/shoes/${shoe.id}/status`, seller.accessToken, { status: 'sold' }, 'PATCH')).status, 200);
    else assert.equal((await json(`/shoes/${shoe.id}`, seller.accessToken, null, 'DELETE')).status, 204);
    const value = await publicEvent;
    assert.deepEqual(await participantEvent, value);
    assert.equal(value.shoeId, shoe.id);
    assert.deepEqual(Object.keys(value).sort(), (name === 'listing:status' ? ['shoeId', 'status', 'updatedAt'] : ['shoeId', name === 'listing:deleted' ? 'deletedAt' : 'updatedAt']).sort());
    if (name === 'listing:status') assert.equal(value.status, 'sold');
  }
  for (let index = 0; index < 60; index += 1) await ack(guest, 'catalog:leave');
  assert.equal((await ack(guest, 'catalog:join')).error.code, 'RATE_LIMITED');
  await delay();
  const active = sockets.filter((socket) => socket.connected).length;
  const extras = [];
  for (let index = active; index < 8; index += 1) extras.push(await connect());
  assert.equal((await connect(null, true)).data.code, 'RATE_LIMITED');
  extras[0].disconnect();
  await delay();
  assert.equal((await connect()).connected, true);
});
