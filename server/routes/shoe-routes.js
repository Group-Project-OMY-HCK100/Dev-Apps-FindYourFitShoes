const express = require('express');
const controller = require('../controllers/shoe-controller');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rate-limit');
const { imagesUpload, validateImageContents } = require('../middleware/upload');
const { requireMultipart } = require('../middleware/content-type');

const router = express.Router();
router.get('/shoes', controller.list);
router.get('/shoes/my-shoes', authenticate, controller.mine);
router.get('/shoes/:id', controller.detail);
router.post('/shoes', authenticate, uploadLimiter, requireMultipart, imagesUpload, validateImageContents, controller.create);
router.put('/shoes/:id', authenticate, uploadLimiter, requireMultipart, imagesUpload, validateImageContents, controller.update);
router.patch('/shoes/:id/status', authenticate, controller.changeStatus);
router.delete('/shoes/:id', authenticate, controller.remove);

module.exports = router;
