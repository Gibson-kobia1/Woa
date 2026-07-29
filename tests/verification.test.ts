import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidDigitCode } from '../src/utils/validation';

test('validates numeric code lengths correctly', () => {
  assert.equal(isValidDigitCode('1234', 4), true);
  assert.equal(isValidDigitCode('1234', 6), false);
  assert.equal(isValidDigitCode('123456', 6), true);
});
