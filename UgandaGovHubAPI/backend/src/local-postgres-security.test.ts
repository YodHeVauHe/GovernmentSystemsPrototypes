import assert from 'assert';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd(), '..');
const dockerCompose = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
const localPostgresScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'local-postgres.mjs'), 'utf8');

assert.equal(
  dockerCompose.includes('"5432:5432"'),
  false,
  'docker-compose local Postgres must not bind the database to every network interface.',
);

assert.match(
  dockerCompose,
  /127\.0\.0\.1:\$\{GOVHUB_POSTGRES_PORT:-5432\}:5432/,
  'docker-compose local Postgres should bind only to localhost by default.',
);

assert.equal(
  localPostgresScript.includes("'5432:5432'") || localPostgresScript.includes('"5432:5432"'),
  false,
  'local-postgres script must not publish Postgres on every network interface.',
);

assert.match(
  localPostgresScript,
  /127\.0\.0\.1:\$\{databasePort\}:5432/,
  'local-postgres script should bind Postgres only to localhost by default.',
);
