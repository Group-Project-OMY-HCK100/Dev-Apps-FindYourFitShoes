const { rejectUnknownFields, validationError } = require('./common');

const CATEGORIES = ['running', 'casual', 'basketball', 'formal', 'sneakers', 'other'];
const CONDITIONS = ['like_new', 'good', 'fair'];
const COLORS = ['black', 'white', 'gray', 'red', 'blue', 'green', 'yellow', 'brown', 'beige', 'purple', 'pink', 'orange', 'neon', 'multicolor', 'other'];
const STATUSES = ['available', 'sold'];
const MUTABLE_FIELDS = ['brand', 'article', 'category', 'condition', 'size', 'color', 'description', 'price'];

function validateListing(body, { update = false } = {}) {
  rejectUnknownFields(body, update ? [...MUTABLE_FIELDS, 'retainedImageUrls'] : MUTABLE_FIELDS);
  const values = {
    brand: typeof body.brand === 'string' ? body.brand.trim() : '',
    article: typeof body.article === 'string' ? body.article.trim() : '',
    category: body.category,
    condition: body.condition,
    size: Number(body.size),
    color: body.color,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    price: Number(body.price),
  };
  const details = [];
  if (values.brand.length < 2 || values.brand.length > 60) details.push({ field: 'brand', message: 'brand harus 2–60 karakter' });
  if (values.article.length < 2 || values.article.length > 120) details.push({ field: 'article', message: 'article harus 2–120 karakter' });
  if (!CATEGORIES.includes(values.category)) details.push({ field: 'category', message: 'category tidak valid' });
  if (!CONDITIONS.includes(values.condition)) details.push({ field: 'condition', message: 'condition tidak valid' });
  if (!Number.isFinite(values.size) || values.size < 35 || values.size > 50 || values.size * 2 % 1 !== 0) details.push({ field: 'size', message: 'size harus 35–50 dengan kelipatan 0,5' });
  if (!COLORS.includes(values.color)) details.push({ field: 'color', message: 'color tidak valid' });
  if (values.description.length < 10 || values.description.length > 2000) details.push({ field: 'description', message: 'description harus 10–2.000 karakter' });
  if (!Number.isInteger(values.price) || values.price < 1 || values.price > 100000000) details.push({ field: 'price', message: 'price harus integer 1–100.000.000' });
  if (details.length) throw validationError(details);
  return values;
}

function validateStatus(body) {
  rejectUnknownFields(body, ['status']);
  if (!STATUSES.includes(body.status)) throw validationError([{ field: 'status', message: 'status harus available atau sold' }]);
  return body.status;
}

function parseRetainedImageUrls(value) {
  if (typeof value !== 'string') throw validationError([{ field: 'retainedImageUrls', message: 'retainedImageUrls wajib berupa JSON-string array' }]);
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw validationError([{ field: 'retainedImageUrls', message: 'retainedImageUrls bukan JSON valid' }]); }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw validationError([{ field: 'retainedImageUrls', message: 'retainedImageUrls harus array string' }]);
  if (new Set(parsed).size !== parsed.length) throw validationError([{ field: 'retainedImageUrls', message: 'retainedImageUrls tidak boleh duplikat' }]);
  return parsed;
}

module.exports = { CATEGORIES, CONDITIONS, COLORS, MUTABLE_FIELDS, validateListing, validateStatus, parseRetainedImageUrls };
