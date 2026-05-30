import assert from 'assert/strict';
import { validateOpenApiSpec } from './versioning';

const validSpec = `
openapi: 3.0.3
info:
  title: Example API
  version: 2.1.0
  description: Example description
paths:
  /status:
    get:
      responses:
        "200":
          description: OK
    parameters: []
  /verify:
    post:
      responses:
        "200":
          description: OK
`;

const validation = validateOpenApiSpec(validSpec);
assert.deepEqual(validation.metadata, {
  title: 'Example API',
  version: '2.1.0',
  description: 'Example description',
  openapiVersion: '3.0.3',
  endpointsCount: 2,
});

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title:
    text: Example API
  version: 1.0.0
paths: {}
`),
  /"info.title" must be a non-empty string/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version:
    major: 1
paths: {}
`),
  /"info.version" must be a non-empty string/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version: "..."
paths: {}
`),
  /"info.version" must contain at least one ASCII letter or number/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
`),
  /missing "paths" object/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
paths:
  - /status
`),
  /"paths" must be an object/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
paths:
  /status: disabled
`),
  /path item "\/status" must be an object/
);

assert.throws(
  () => validateOpenApiSpec(`
openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
paths:
  /status:
    get: disabled
`),
  /operation "get \/status" must be an object/
);

console.log('openapi validation tests passed');
