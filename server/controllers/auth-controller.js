const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UniqueConstraintError } = require('sequelize');
const { User } = require('../models');
const env = require('../config/env');
const ApiError = require('../utils/api-error');
const asyncHandler = require('../utils/async-handler');
const { selfUser } = require('../utils/serializers');
const { validateRegister, validateLogin } = require('../validators/auth');

function tokenLifetimeSeconds() {
  const unit = String(env.jwtExpiresIn).match(/^(\d+)([smhd])$/);
  if (!unit) return 86400;
  return Number(unit[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[unit[2]]);
}

function authResponse(user) {
  if (env.jwtSecret.length < 32) throw new ApiError(500, 'SERVER_MISCONFIGURED', 'Konfigurasi autentikasi server belum lengkap');
  return {
    user: selfUser(user),
    accessToken: jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn }),
    tokenType: 'Bearer',
    expiresIn: tokenLifetimeSeconds(),
  };
}

const register = asyncHandler(async (req, res) => {
  const input = validateRegister(req.body);
  try {
    const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
    const user = await User.create({ name: input.name, email: input.email, passwordHash });
    res.status(201).json({ success: true, data: authResponse(user) });
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar');
    throw error;
  }
});

const login = asyncHandler(async (req, res) => {
  const input = validateLogin(req.body);
  const user = await User.scope('withPassword').findOne({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
  }
  res.json({ success: true, data: authResponse(user) });
});

const me = asyncHandler(async (req, res) => res.json({ success: true, data: selfUser(req.user) }));

module.exports = { register, login, me, authResponse };
