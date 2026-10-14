const express = require('express');
const controller = require('../controllers/auth-controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rate-limit');

const router = express.Router();
router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
router.get('/auth/me', authenticate, controller.me);

module.exports = router;
