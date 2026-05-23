import assert from 'assert/strict';
import { generateApiKey, generatePublicId } from './ids';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const auditId = generatePublicId('audit');
assert.match(auditId, new RegExp(`^audit_${uuidPattern.source.slice(1, -1)}$`));
assert.doesNotMatch(auditId, /^audit-\d+/);

const requestId = generatePublicId('req');
assert.match(requestId, new RegExp(`^req_${uuidPattern.source.slice(1, -1)}$`));
assert.doesNotMatch(requestId, /^req-\d+/);

const apiKey = generateApiKey();
assert.match(apiKey, /^ghk_[0-9a-f]{64}$/);
assert.doesNotMatch(apiKey, /^govhub_test_/);
assert.notEqual(apiKey, generateApiKey());

console.log('id generation tests passed');
