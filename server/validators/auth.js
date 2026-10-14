const { rejectUnknownFields, validationError } = require('./common');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateRegister(body) {
  rejectUnknownFields(body, ['name', 'email', 'password']);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const details = [];
  if (name.length < 2 || name.length > 80) details.push({ field: 'name', message: 'name harus 2–80 karakter' });
  if (!EMAIL_PATTERN.test(email) || email.length > 320) details.push({ field: 'email', message: 'email tidak valid' });
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (passwordBytes < 8 || passwordBytes > 72) details.push({ field: 'password', message: 'password harus 8–72 byte UTF-8' });
  if (details.length) throw validationError(details);
  return { name, email, password };
}

function validateLogin(body) {
  rejectUnknownFields(body, ['email', 'password']);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const details = [];
  if (!EMAIL_PATTERN.test(email)) details.push({ field: 'email', message: 'email tidak valid' });
  if (!password) details.push({ field: 'password', message: 'password wajib diisi' });
  if (details.length) throw validationError(details);
  return { email, password };
}

module.exports = { normalizeEmail, validateRegister, validateLogin };
