import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const signupPage = fs.readFileSync(path.join(currentDir, 'pages', 'SignupPage.tsx'), 'utf8');

assert.equal(
  signupPage.includes('max-w-3xl'),
  false,
  'Signup form should not use the wider max-w-3xl shell.'
);

assert.equal(
  signupPage.includes('className="w-full max-w-2xl space-y-5'),
  true,
  'Signup form should use a narrower max-w-2xl shell while remaining full-width on small screens.'
);

assert.equal(
  signupPage.includes("toast.success('Account request submitted'") && signupPage.includes('setTimeout(() => navigate'),
  true,
  'Signup should show a success toast before redirecting to the login screen.'
);
