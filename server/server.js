const http = require('http');
const { Server } = require('socket.io');
const env = require('./config/env');
const { sequelize } = require('./models');
const { createApp } = require('./app');
const { registerSockets } = require('./sockets');

function buildServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigins,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 100 * 1024,
  });
  app.set('io', io);
  registerSockets(io);
  return { app, httpServer, io };
}

async function start() {
  if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET wajib diisi dengan minimal 32 karakter');
  await sequelize.authenticate();
  const { httpServer, io } = buildServer();
  httpServer.listen(env.port, () => console.log(`SoleSwap API berjalan di port ${env.port}`));

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Menerima ${signal}, menutup server...`);
    const fallback = setTimeout(() => process.exit(1), 10000);
    fallback.unref();
    io.close(async () => {
      try {
        await sequelize.close();
        clearTimeout(fallback);
        process.exit(0);
      } catch (error) {
        console.error('Gagal menutup server:', error.message);
        process.exit(1);
      }
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Server gagal dimulai:', error.message);
    process.exit(1);
  });
}

module.exports = { buildServer, start };
