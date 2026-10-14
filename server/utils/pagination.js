const ApiError = require('./api-error');

function parseInteger(value, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  return Number(value);
}

function parsePagination(query, defaults = { limit: 12, maxLimit: 50 }) {
  const page = parseInteger(query.page, 1);
  const limit = parseInteger(query.limit, defaults.limit);
  const details = [];
  if (!page || page < 1) details.push({ field: 'page', message: 'page harus integer minimal 1' });
  if (!limit || limit < 1 || limit > defaults.maxLimit) {
    details.push({ field: 'limit', message: `limit harus antara 1 dan ${defaults.maxLimit}` });
  }
  if (details.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Data tidak valid', details);
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parsePagination };
