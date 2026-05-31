import assert from 'assert';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd(), '..');
const projectGitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');

assert.match(
  projectGitignore,
  /^\.env\*$/m,
  'Project .gitignore must ignore root production-style env files such as .env.production.local.',
);

assert.match(
  projectGitignore,
  /^backend\/\.env\*$/m,
  'Project .gitignore must ignore all backend env variants, not only backend/.env.',
);

assert.match(
  projectGitignore,
  /^frontend\/\.env\*$/m,
  'Project .gitignore must ignore all frontend env variants, not only frontend/.env.',
);

assert.match(
  projectGitignore,
  /^!\.env\.example$/m,
  'Project .gitignore must keep root env examples trackable.',
);

assert.match(
  projectGitignore,
  /^!backend\/\.env\.example$/m,
  'Project .gitignore must keep backend env examples trackable.',
);

assert.match(
  projectGitignore,
  /^!frontend\/\.env\.example$/m,
  'Project .gitignore must keep frontend env examples trackable.',
);
