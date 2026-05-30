import assert from 'assert/strict';
import { positiveIntegerEnv } from './env';

const originalValue = process.env.GOVHUB_TEST_NUMBER;

try {
  delete process.env.GOVHUB_TEST_NUMBER;
  assert.equal(positiveIntegerEnv('GOVHUB_TEST_NUMBER', 10), 10);

  process.env.GOVHUB_TEST_NUMBER = '25';
  assert.equal(positiveIntegerEnv('GOVHUB_TEST_NUMBER', 10), 25);

  process.env.GOVHUB_TEST_NUMBER = 'not-a-number';
  assert.equal(positiveIntegerEnv('GOVHUB_TEST_NUMBER', 10), 10);

  process.env.GOVHUB_TEST_NUMBER = '0';
  assert.equal(positiveIntegerEnv('GOVHUB_TEST_NUMBER', 10), 10);

  process.env.GOVHUB_TEST_NUMBER = '-5';
  assert.equal(positiveIntegerEnv('GOVHUB_TEST_NUMBER', 10), 10);
} finally {
  if (originalValue === undefined) {
    delete process.env.GOVHUB_TEST_NUMBER;
  } else {
    process.env.GOVHUB_TEST_NUMBER = originalValue;
  }
}

console.log('env helper tests passed');
