import assert from 'assert';
import { schemaExample } from '../lib/openapi-examples';

const cyclicSpec = {
  components: {
    schemas: {
      Node: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          child: { $ref: '#/components/schemas/Node' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    },
  },
};

const cyclicExample = schemaExample(
  { $ref: '#/components/schemas/Node' },
  cyclicSpec,
  'node',
  { stringFallback: 'string' },
);

assert.deepEqual(
  cyclicExample,
  { value: 'string', children: [] },
  'OpenAPI example generation must stop at circular refs instead of overflowing the stack.',
);

const boundedArrayExample = schemaExample(
  { type: 'array', items: { $ref: '#/components/schemas/Node' } },
  cyclicSpec,
  'nodes',
  { stringFallback: 'string' },
);

assert.deepEqual(
  boundedArrayExample,
  [{ value: 'string', children: [] }],
  'OpenAPI array examples should keep safe non-cyclic fields while dropping recursive children.',
);
