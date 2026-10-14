const test = require('node:test');
const assert = require('node:assert/strict');
const { validateListing, parseRetainedImageUrls } = require('../../validators/shoe');

const valid = {
  brand: 'Nike', article: 'Air Max 90', category: 'casual', condition: 'good',
  size: '42.5', color: 'black', description: 'Kondisi masih sangat baik.', price: '450000',
};

test('validateListing mengonversi size dan price multipart', () => {
  const result = validateListing(valid);
  assert.equal(result.size, 42.5);
  assert.equal(result.price, 450000);
});

test('validateListing menolak field status pada create', () => {
  assert.throws(() => validateListing({ ...valid, status: 'sold' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('parseRetainedImageUrls menjaga urutan dan menolak duplikat', () => {
  assert.deepEqual(parseRetainedImageUrls('["https://a.test/1.jpg","https://a.test/2.jpg"]'), ['https://a.test/1.jpg', 'https://a.test/2.jpg']);
  assert.throws(() => parseRetainedImageUrls('["same","same"]'), (error) => error.code === 'VALIDATION_ERROR');
});
