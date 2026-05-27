import assert from 'assert/strict';
import { normalizeSql } from './db';

assert.equal(
  normalizeSql('SELECT spec_sha FROM api_versions WHERE api_id = ? AND is_current = 1'),
  'SELECT spec_sha FROM api_versions WHERE api_id = ? AND is_current = TRUE'
);

assert.equal(
  normalizeSql('UPDATE api_versions SET is_current = 0 WHERE api_id = ?'),
  'UPDATE api_versions SET is_current = FALSE WHERE api_id = ?'
);

console.log('db tests passed');
