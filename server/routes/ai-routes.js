const express = require('express');
const controller = require('../controllers/ai-controller');
const { aiLimiter } = require('../middleware/rate-limit');

const router = express.Router();
router.post('/ai/search', aiLimiter, controller.search);

module.exports = router;
