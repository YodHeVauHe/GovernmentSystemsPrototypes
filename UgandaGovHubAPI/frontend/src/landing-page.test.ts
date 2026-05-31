import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getSearchFallbackPathname,
  getShellTitle,
  isKnownAppRoute,
  isPublicAppRoute,
  isSearchableAppRoute,
} from './app-routes';
import { landingCtas, landingPitchDeck } from './pages/landing-content';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appShell = fs.readFileSync(path.join(currentDir, 'App.tsx'), 'utf8');
const landingPageSource = fs.readFileSync(path.join(currentDir, 'pages', 'LandingPage.tsx'), 'utf8');

assert.equal(isKnownAppRoute('/'), true, 'The landing page should be a known app route.');
assert.equal(isKnownAppRoute('/catalog'), true, 'The catalog should keep a first-class route.');
assert.equal(isKnownAppRoute('/docs/nira-identity'), true, 'API docs detail routes should remain known.');
assert.equal(isKnownAppRoute('/unknown'), false, 'Unknown routes should still fall through to NotFound.');

assert.equal(isPublicAppRoute('/'), true, 'The pitch deck landing page should be public.');
assert.equal(isPublicAppRoute('/docs'), true, 'The public docs index should remain public.');
assert.equal(isPublicAppRoute('/docs/nira-identity'), true, 'Public API docs should remain public.');
assert.equal(isPublicAppRoute('/catalog'), false, 'The catalog should still require an approved account.');
assert.equal(isPublicAppRoute('/dashboard'), false, 'The dashboard should remain protected.');

assert.equal(getShellTitle('/catalog'), 'API Catalog', 'The catalog shell title should move to /catalog.');
assert.equal(getShellTitle('/'), 'Uganda GovHub API', 'The landing page should have its own product title.');

assert.equal(isSearchableAppRoute('/'), false, 'Landing-page search should not hijack catalog search.');
assert.equal(isSearchableAppRoute('/catalog'), true, 'Catalog search should move to /catalog.');
assert.equal(getSearchFallbackPathname(), '/catalog', 'Header search should redirect non-searchable pages to the catalog.');

assert.equal(
  appShell.includes('<HumanVerificationGate>\n            <AppShell />\n          </HumanVerificationGate>'),
  false,
  'The root pitch deck should not be hidden behind the global human-verification gate.'
);

assert.ok(landingPitchDeck.length >= 6, 'The landing page should read like a real pitch deck, not a thin hero.');
assert.deepEqual(
  landingPitchDeck.map(slide => slide.id),
  ['problem', 'solution', 'why-now', 'proof', 'trust-model', 'pilot-path'],
  'Pitch deck slides should cover the core decision story in order.'
);

for (const slide of landingPitchDeck) {
  assert.ok(slide.eyebrow.length > 0, `Slide ${slide.id} should include an eyebrow.`);
  assert.ok(slide.title.length > 0, `Slide ${slide.id} should include a title.`);
  assert.ok(slide.detail.length >= 140, `Slide ${slide.id} should explain the point in useful detail.`);
  assert.ok(slide.points.length >= 3, `Slide ${slide.id} should include concrete support points.`);
}

const completeDeckCopy = [
  ...landingPitchDeck.flatMap(slide => [slide.title, slide.detail, ...slide.points, slide.visual.caption]),
].join('\n');

assert.match(
  completeDeckCopy,
  /Ministry of ICT and National Guidance/,
  'The pitch should clearly frame the value for the Ministry of ICT and National Guidance.'
);

assert.match(
  completeDeckCopy,
  /Government of Uganda/,
  'The pitch should clearly frame the value for the Government of Uganda.'
);

assert.equal(
  /\b(you|your|yours)\b/i.test(completeDeckCopy),
  false,
  'Pitch copy should avoid direct second-person wording.'
);

assert.ok(
  landingPageSource.includes('object-contain'),
  'Screenshot cards should render full product screenshots without cropping.'
);

assert.equal(
  landingPageSource.includes('className="aspect-[16/10] w-full object-cover object-top"'),
  false,
  'Screenshot cards should not use object-cover framing that cuts off the UI.'
);

assert.deepEqual(
  landingCtas.map(cta => cta.href),
  ['/signup', '/login', '/catalog'],
  'Landing CTAs should guide new users, returning users, and approved catalog users.'
);
