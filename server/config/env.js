const dotenv = require('dotenv');

dotenv.config();

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'test' ? 'test-secret-that-is-at-least-32-chars' : '');
const llmProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();

module.exports = {
  nodeEnv,
  port: parsePositiveInteger(process.env.PORT, 3000),
  socketMaxConnectionsPerIp: parsePositiveInteger(process.env.SOCKET_MAX_CONNECTIONS_PER_IP, 20),
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: Math.min(parsePositiveInteger(process.env.BCRYPT_ROUNDS, 12), 15),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  llm: {
    provider: llmProvider,
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    geminiBaseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
    geminiThinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'low',
    timeoutMs: parsePositiveInteger(process.env.AI_TIMEOUT_MS, 8000),
  },
};
