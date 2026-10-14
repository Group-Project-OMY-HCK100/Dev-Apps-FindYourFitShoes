const express = require('express');
const controller = require('../controllers/chat-controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use('/chats', authenticate);
router.post('/chats', controller.create);
router.get('/chats', controller.list);
router.get('/chats/:id', controller.detail);
router.get('/chats/:id/messages', controller.messages);
router.patch('/chats/:id/read', controller.read);

module.exports = router;
