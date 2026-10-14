const aiService = require('../services/ai-service');
const asyncHandler = require('../utils/async-handler');
const { rejectUnknownFields, validationError } = require('../validators/common');

const search = asyncHandler(async (req, res) => {
  rejectUnknownFields(req.body, ['query', 'filterOverrides', 'limit']);
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  const limit = req.body.limit === undefined ? 12 : Number(req.body.limit);
  const overrides = req.body.filterOverrides === undefined ? {} : req.body.filterOverrides;
  const details = [];
  if (query.length < 3 || query.length > 300) details.push({ field: 'query', message: 'query harus 3–300 karakter' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) details.push({ field: 'limit', message: 'limit harus integer 1–20' });
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) details.push({ field: 'filterOverrides', message: 'filterOverrides harus object' });
  else {
    const invalidKeys = Object.keys(overrides).filter((key) => !aiService.FILTER_KEYS.includes(key));
    invalidKeys.forEach((field) => details.push({ field: `filterOverrides.${field}`, message: 'filter override tidak didukung' }));
    aiService.validateOverrides(overrides)
      .filter((field) => !invalidKeys.includes(field))
      .forEach((field) => details.push({ field: `filterOverrides.${field}`, message: 'nilai filter override tidak valid' }));
  }
  if (details.length) throw validationError(details);
  res.json({ success: true, data: await aiService.search(query, overrides, limit) });
});

module.exports = { search };
