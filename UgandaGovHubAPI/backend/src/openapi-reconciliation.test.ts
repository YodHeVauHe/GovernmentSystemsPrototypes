import assert from 'assert/strict';
import { shouldRemoveOpenApiFile } from './openapi-reconciliation';

const knownPaths = new Set(['nira-identity.yaml']);

assert.equal(shouldRemoveOpenApiFile('nira-identity.yaml', knownPaths), false);
assert.equal(shouldRemoveOpenApiFile('generated-orphan.yaml', knownPaths), true);
assert.equal(shouldRemoveOpenApiFile('api-reg-dc0ab166-b497-4da5-b78d-7bfad6cf9b32.yaml', knownPaths), false);
assert.equal(shouldRemoveOpenApiFile('notes.txt', knownPaths), false);

console.log('openapi reconciliation tests passed');
