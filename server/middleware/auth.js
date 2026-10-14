const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/api-error');

function extractBearer(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function authenticate(req, _res, next) {
  try {
    if (env.jwtSecret.length < 32) throw new ApiError(500, 'SERVER_MISCONFIGURED', 'Konfigurasi autentikasi server belum lengkap');
    const token = extractBearer(req.headers.authorization);
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Token autentikasi diperlukan');
    let payload;
    try { payload = jwt.verify(token, env.jwtSecret); } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED';
      throw new ApiError(401, code, code === 'TOKEN_EXPIRED' ? 'Token telah kedaluwarsa' : 'Token tidak valid');
    }
    const user = await User.findByPk(payload.sub);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Token tidak valid');
    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error) { next(error); }
}

module.exports = { authenticate, extractBearer };
