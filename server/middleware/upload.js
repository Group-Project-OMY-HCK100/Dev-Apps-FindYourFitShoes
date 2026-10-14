const multer = require('multer');
const ApiError = require('../utils/api-error');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 20 },
});

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: 'png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

function validateImageContents(req, _res, next) {
  try {
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    for (const file of req.files || []) {
      const detected = detectImage(file.buffer);
      if (!detected || !allowedMimes.has(file.mimetype) || file.mimetype !== detected.mime) {
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Gambar harus berformat JPEG, PNG, atau WebP yang valid');
      }
      file.detectedType = detected;
    }
    next();
  } catch (error) { next(error); }
}

module.exports = { imagesUpload: upload.array('images', 5), validateImageContents, detectImage };
