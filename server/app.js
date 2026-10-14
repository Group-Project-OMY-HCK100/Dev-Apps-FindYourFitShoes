const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const ApiError = require('./utils/api-error');
const authRoutes = require('./routes/auth-routes');
const shoeRoutes = require('./routes/shoe-routes');
const chatRoutes = require('./routes/chat-routes');
const aiRoutes = require('./routes/ai-routes');
const { notFound, errorHandler } = require('./middleware/error-handler');

function isAllowedOrigin(origin) {
  return !origin || env.clientOrigins.includes(origin);
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.nodeEnv === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      const allowed = isAllowedOrigin(origin);
      callback(allowed ? null : new ApiError(403, 'FORBIDDEN', 'Origin tidak diizinkan'), allowed);
    },
    credentials: false,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use((req, _res, next) => {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    next();
  });

  app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', service: 'soleswap-api' } }));
  app.use(authRoutes, shoeRoutes, chatRoutes, aiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, isAllowedOrigin };
