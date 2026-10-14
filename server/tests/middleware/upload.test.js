const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImage } = require('../../middleware/upload');

test('detectImage memeriksa magic bytes, bukan ekstensi', () => {
  assert.equal(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])).mime, 'image/jpeg');
  assert.equal(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).mime, 'image/png');
  assert.equal(detectImage(Buffer.from('RIFF1234WEBP')).mime, 'image/webp');
  assert.equal(detectImage(Buffer.from('not an image')), null);
});
