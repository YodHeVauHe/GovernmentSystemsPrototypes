import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const { scripts } = packageJson;

test('local dev prepares dependencies before launching app servers', () => {
  assert.equal(scripts.dev, 'npm run dev:prepare && npm run dev:services');
  assert.equal(scripts['dev:prepare'], 'npm run db:up && npm run db:wait && npm run seed');
  assert.equal(scripts['dev:services'], 'concurrently "npm run dev:frontend" "npm run dev:backend"');
  assert.equal(scripts.demo, 'npm run dev');
});

test('local dev waits for the Docker Postgres container before seeding', () => {
  assert.equal(scripts['db:up'], 'node scripts/local-postgres.mjs up');
  assert.equal(scripts['db:wait'], 'node scripts/local-postgres.mjs wait');
  assert.equal(scripts['db:down'], 'node scripts/local-postgres.mjs down');
  assert.equal(scripts['db:logs'], 'node scripts/local-postgres.mjs logs');
});

test('local Docker scripts do not force a machine-specific DOCKER_HOST', () => {
  assert.doesNotMatch(scripts['db:up'], /DOCKER_HOST=/);
  assert.doesNotMatch(scripts['db:wait'], /DOCKER_HOST=/);
  assert.doesNotMatch(scripts['db:down'], /DOCKER_HOST=/);
  assert.doesNotMatch(scripts['db:logs'], /DOCKER_HOST=/);
});
