const ApiError = require('../utils/api-error');

function requireMultipart(req, _res, next) {
  if (!req.is('multipart/form-data')) return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Endpoint ini membutuhkan multipart/form-data'));
  next();
}

module.exports = { requireMultipart };
