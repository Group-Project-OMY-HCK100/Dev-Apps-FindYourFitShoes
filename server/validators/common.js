const ApiError = require('../utils/api-error');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validationError(details, message = 'Data tidak valid') {
  return new ApiError(422, 'VALIDATION_ERROR', message, details);
}

function assertUuid(value, field) {
  if (!isUuid(value)) throw validationError([{ field, message: `${field} harus UUID valid` }]);
  return value;
}

function rejectUnknownFields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError([{ field: 'body', message: 'body harus object' }]);
  }
  const forbidden = Object.keys(input).filter((key) => !allowed.includes(key));
  if (forbidden.length) {
    throw validationError(forbidden.map((field) => ({ field, message: `${field} tidak diizinkan` })));
  }
}

module.exports = { isUuid, assertUuid, rejectUnknownFields, validationError };
