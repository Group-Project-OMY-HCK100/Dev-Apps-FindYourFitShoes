const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const ApiError = require('../utils/api-error');

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

function ensureConfigured() {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Layanan penyimpanan gambar belum dikonfigurasi');
  }
}

async function uploadOne(file) {
  ensureConfigured();
  try {
    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'soleswap/shoes', resource_type: 'image', format: file.detectedType?.extension },
        (error, result) => (error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id })),
      );
      Readable.from(file.buffer).pipe(stream);
    });
  } catch {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Gagal mengunggah gambar');
  }
}

async function destroy(publicId) {
  if (!publicId || !env.cloudinary.cloudName) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true }); } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error('Cloudinary cleanup failed:', publicId, error.message);
  }
}

async function uploadMany(files) {
  const uploaded = [];
  try {
    for (const file of files) uploaded.push(await uploadOne(file));
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => destroy(item.publicId)));
    throw error;
  }
}

async function cleanupMany(publicIds) {
  await Promise.allSettled(publicIds.filter(Boolean).map(destroy));
}

module.exports = { uploadMany, cleanupMany };
