const { Op } = require('sequelize');
const { Shoe, User, sequelize } = require('../models');
const asyncHandler = require('../utils/async-handler');
const ApiError = require('../utils/api-error');
const { parsePagination } = require('../utils/pagination');
const { shoeSummary, shoeDetail } = require('../utils/serializers');
const { assertUuid, validationError } = require('../validators/common');
const { CATEGORIES, validateListing, validateStatus, parseRetainedImageUrls } = require('../validators/shoe');
const cloudinary = require('../services/cloudinary-service');
const listingEvents = require('../services/listing-events');

const sellerInclude = { model: User, as: 'seller', attributes: ['id', 'name'] };

function parseFilters(query, { mine = false } = {}) {
  const { page, limit, offset } = parsePagination(query);
  const status = query.status ?? 'all';
  const sort = query.sort ?? 'newest';
  const details = [];
  if (!['all', 'available', 'sold'].includes(status)) details.push({ field: 'status', message: 'status tidak valid' });
  if (!['newest', 'price_asc', 'price_desc'].includes(sort)) details.push({ field: 'sort', message: 'sort tidak valid' });
  if (query.category !== undefined && !CATEGORIES.includes(query.category)) details.push({ field: 'category', message: 'category tidak valid' });
  let size;
  if (query.size !== undefined) {
    size = Number(query.size);
    if (!Number.isFinite(size) || size < 35 || size > 50 || size * 2 % 1 !== 0) details.push({ field: 'size', message: 'size tidak valid' });
  }
  if (details.length) throw validationError(details);
  const where = {};
  if (status !== 'all') where.status = status;
  if (query.brand) where.brand = { [Op.iLike]: `%${String(query.brand).trim()}%` };
  if (size !== undefined) where.size = size;
  if (query.category) where.category = query.category;
  if (query.q) {
    const pattern = `%${String(query.q).trim()}%`;
    where[Op.or] = ['brand', 'article', 'description'].map((field) => ({ [field]: { [Op.iLike]: pattern } }));
  }
  const order = sort === 'price_asc'
    ? [['price', 'ASC'], ['id', 'DESC']]
    : sort === 'price_desc'
      ? [['price', 'DESC'], ['id', 'DESC']]
      : [['createdAt', 'DESC'], ['id', 'DESC']];
  return { where, order, page, limit, offset, mine };
}

async function listWith(filters, userId) {
  const where = { ...filters.where, ...(filters.mine ? { userId } : {}) };
  const { rows, count } = await Shoe.findAndCountAll({ where, include: [sellerInclude], order: filters.order, limit: filters.limit, offset: filters.offset, distinct: true });
  return {
    data: rows.map(shoeSummary),
    meta: { page: filters.page, limit: filters.limit, totalItems: count, totalPages: Math.ceil(count / filters.limit) },
  };
}

const list = asyncHandler(async (req, res) => {
  const result = await listWith(parseFilters(req.query));
  res.json({ success: true, ...result });
});

const mine = asyncHandler(async (req, res) => {
  const result = await listWith(parseFilters(req.query, { mine: true }), req.user.id);
  res.json({ success: true, ...result });
});

const detail = asyncHandler(async (req, res) => {
  assertUuid(req.params.id, 'id');
  const shoe = await Shoe.findByPk(req.params.id, { include: [sellerInclude] });
  if (!shoe) throw new ApiError(404, 'SHOE_NOT_FOUND', 'Sepatu tidak ditemukan');
  res.json({ success: true, data: shoeDetail(shoe) });
});

function imageAttributes(images) {
  const result = {};
  for (let index = 0; index < 5; index += 1) {
    result[`imgUrl${index + 1}`] = images[index]?.url || null;
    result[`imgPublicId${index + 1}`] = images[index]?.publicId || null;
  }
  return result;
}

const create = asyncHandler(async (req, res) => {
  const values = validateListing(req.body);
  const files = req.files || [];
  if (files.length < 1 || files.length > 5) throw validationError([{ field: 'images', message: 'images wajib berjumlah 1–5 file' }]);
  const uploaded = await cloudinary.uploadMany(files);
  let shoe;
  try {
    shoe = await sequelize.transaction(async (transaction) => Shoe.create(
      { ...values, userId: req.user.id, status: 'available', ...imageAttributes(uploaded) },
      { transaction },
    ));
  } catch (error) {
    await cloudinary.cleanupMany(uploaded.map((image) => image.publicId));
    throw error;
  }
  await shoe.reload({ include: [sellerInclude] });
  await listingEvents.created(req.app.get('io'), shoe);
  res.status(201).json({ success: true, data: shoeDetail(shoe) });
});

async function ownedShoe(id, userId, { includeDeleted = false } = {}) {
  assertUuid(id, 'id');
  const shoe = await Shoe.findByPk(id, { paranoid: !includeDeleted, include: [sellerInclude] });
  if (!shoe) throw new ApiError(404, 'SHOE_NOT_FOUND', 'Sepatu tidak ditemukan');
  if (shoe.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'Hanya pemilik yang dapat mengubah listing');
  return shoe;
}

const update = asyncHandler(async (req, res) => {
  const shoe = await ownedShoe(req.params.id, req.user.id);
  const values = validateListing(req.body, { update: true });
  const retainedUrls = parseRetainedImageUrls(req.body.retainedImageUrls);
  const oldImages = Array.from({ length: 5 }, (_, index) => ({ url: shoe[`imgUrl${index + 1}`], publicId: shoe[`imgPublicId${index + 1}`] })).filter((item) => item.url);
  const oldByUrl = new Map(oldImages.map((image) => [image.url, image]));
  const invalidUrl = retainedUrls.find((url) => !oldByUrl.has(url));
  if (invalidUrl) throw validationError([{ field: 'retainedImageUrls', message: 'URL retained bukan milik listing ini' }]);
  const files = req.files || [];
  const finalCount = retainedUrls.length + files.length;
  if (finalCount < 1 || finalCount > 5) throw validationError([{ field: 'images', message: 'Jumlah akhir gambar harus 1–5' }]);
  const uploaded = await cloudinary.uploadMany(files);
  const finalImages = [...retainedUrls.map((url) => oldByUrl.get(url)), ...uploaded];
  try {
    await sequelize.transaction(async (transaction) => shoe.update({ ...values, ...imageAttributes(finalImages) }, { transaction }));
  } catch (error) {
    await cloudinary.cleanupMany(uploaded.map((image) => image.publicId));
    throw error;
  }
  const removedPublicIds = oldImages.filter((image) => !retainedUrls.includes(image.url)).map((image) => image.publicId);
  await shoe.reload({ include: [sellerInclude] });
  await listingEvents.updated(req.app.get('io'), shoe);
  await cloudinary.cleanupMany(removedPublicIds);
  res.json({ success: true, data: shoeDetail(shoe) });
});

const changeStatus = asyncHandler(async (req, res) => {
  const shoe = await ownedShoe(req.params.id, req.user.id);
  const status = validateStatus(req.body);
  if (shoe.status !== status) await shoe.update({ status });
  await shoe.reload({ include: [sellerInclude] });
  await listingEvents.status(req.app.get('io'), shoe);
  res.json({ success: true, data: shoeDetail(shoe) });
});

const remove = asyncHandler(async (req, res) => {
  const shoe = await ownedShoe(req.params.id, req.user.id, { includeDeleted: true });
  if (!shoe.deletedAt) await shoe.destroy();
  await shoe.reload({ paranoid: false, include: [sellerInclude] });
  await listingEvents.deleted(req.app.get('io'), shoe);
  res.status(204).send();
});

module.exports = { list, mine, detail, create, update, changeStatus, remove, parseFilters };
