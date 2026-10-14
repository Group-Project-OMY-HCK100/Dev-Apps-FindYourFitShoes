const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateRegister } = require('../../validators/auth');

test('normalizeEmail melakukan trim dan lowercase', () => {
  assert.equal(normalizeEmail('  Raka@Example.COM '), 'raka@example.com');
});

test('validateRegister menerima input kontrak yang valid', () => {
  assert.deepEqual(validateRegister({ name: ' Raka ', email: 'RAKA@example.com', password: 'rahasia123' }), {
    name: 'Raka', email: 'raka@example.com', password: 'rahasia123',
  });
});

test('validateRegister mengukur password sebagai byte UTF-8', () => {
  assert.throws(
    () => validateRegister({ name: 'Raka', email: 'raka@example.com', password: '😀'.repeat(19) }),
    (error) => error.code === 'VALIDATION_ERROR' && error.details.some((item) => item.field === 'password'),
  );
});
