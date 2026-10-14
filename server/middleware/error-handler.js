const multer = require('multer');
const { UniqueConstraintError, ValidationError: SequelizeValidationError } = require('sequelize');
const ApiError = require('../utils/api-error');

function notFound(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} tidak ditemukan`));
}

function errorHandler(error, _req, res, _next) {
  let normalized = error;
  if (error instanceof multer.MulterError) {
    normalized = error.code === 'LIMIT_FILE_SIZE'
      ? new ApiError(413, 'FILE_TOO_LARGE', 'Ukuran setiap gambar maksimal 5 MB')
      : new ApiError(422, 'VALIDATION_ERROR', 'File upload tidak valid', [{ field: 'images', message: error.message }]);
  } else if (error instanceof SequelizeValidationError) {
    normalized = new ApiError(422, 'VALIDATION_ERROR', 'Data tidak valid', error.errors.map((item) => ({ field: item.path, message: item.message })));
  } else if (error instanceof UniqueConstraintError) {
    normalized = new ApiError(409, 'CONFLICT', 'Data yang sama sudah tersedia');
  } else if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    normalized = new ApiError(400, 'BAD_REQUEST', 'JSON tidak valid');
  } else if (error.type === 'entity.too.large') {
    normalized = new ApiError(413, 'FILE_TOO_LARGE', 'Request body terlalu besar');
  }

  const status = normalized.status || 500;
  const body = {
    success: false,
    error: {
      code: normalized.code || 'INTERNAL_SERVER_ERROR',
      message: status >= 500 ? 'Terjadi kesalahan pada server' : normalized.message,
    },
  };
  if (normalized.details?.length && status < 500) body.error.details = normalized.details;
  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(error);
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
