const { rateLimit } = require('express-rate-limit');

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
    }),
  });
}

module.exports = {
  authLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: 20, message: 'Terlalu banyak percobaan autentikasi' }),
  uploadLimiter: limiter({ windowMs: 60 * 60 * 1000, limit: 60, message: 'Terlalu banyak upload' }),
  aiLimiter: limiter({ windowMs: 60 * 1000, limit: 10, message: 'Terlalu banyak permintaan AI search' }),
};
