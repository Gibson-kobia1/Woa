import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveApplicationId } from '../src/utils/applicationId.js';

test('prefers the submitted application id and falls back to the tracked id', () => {
  assert.equal(resolveActiveApplicationId('app-1', 'app-2', 'fallback'), 'app-1');
  assert.equal(resolveActiveApplicationId('', 'app-2', 'fallback'), 'app-2');
  assert.equal(resolveActiveApplicationId(null, null, 'fallback'), 'fallback');
});
