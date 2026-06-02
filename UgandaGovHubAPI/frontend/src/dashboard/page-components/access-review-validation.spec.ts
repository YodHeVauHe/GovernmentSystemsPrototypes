import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeAccessReviewText } from './access-review-validation';

describe('sanitizeAccessReviewText', () => {
  it('trims reviewer notes before submission', () => {
    assert.equal(sanitizeAccessReviewText('  Confirm legal mandate alignment.  '), 'Confirm legal mandate alignment.');
  });

  it('rejects unsupported control characters', () => {
    assert.equal(sanitizeAccessReviewText('Invalid\u0001note'), null);
  });
});
