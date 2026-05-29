import assert from 'assert/strict';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const testDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(testDir, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) return [];
    if (entry.name.endsWith('.test.ts')) return [];
    return [path];
  });
}

const forbiddenLoadingCopy = [
  'Loading...',
  'Loading account settings...',
  'Loading API docs...',
  'Loading API documentation...',
  'Sending...',
  'Submitting...',
  'Publishing...',
  'Deleting...',
  'Saving...',
  'Approving...',
  'Revoking...',
  'Signing in...',
  'Interrogating mock registry sandbox...',
];

for (const file of sourceFiles(sourceDir)) {
  const source = readFileSync(file, 'utf8');
  const displayPath = relative(sourceDir, file);

  for (const phrase of forbiddenLoadingCopy) {
    assert.equal(
      source.includes(phrase),
      false,
      `${displayPath} should use Spinner or Skeleton instead of visible "${phrase}" copy`
    );
  }

  assert.equal(
    /\bIcon(?:Loader|Refresh)\b/.test(source),
    false,
    `${displayPath} should use the shadcn Spinner instead of Tabler loader icons`
  );

  if (displayPath !== 'components/ui/skeleton.tsx') {
    assert.equal(
      /animate-pulse\s+rounded(?:-full|-lg)?\s+bg/.test(source),
      false,
      `${displayPath} should render Skeleton instead of hand-written pulse blocks`
    );
  }
}

console.log('loading UI source checks passed');
