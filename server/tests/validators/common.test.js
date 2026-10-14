const test = require('node:test');
const assert = require('node:assert/strict');
const { isUuid, assertUuid } = require('../../validators/common');

test('validasi UUID menerima UUID kontrak dan menolak integer', () => {
  assert.equal(isUuid('20000000-0000-4000-8000-000000000001'), true);
  assert.equal(isUuid('42'), false);
  assert.throws(() => assertUuid('42', 'shoeId'), (error) => error.code === 'VALIDATION_ERROR');
});
