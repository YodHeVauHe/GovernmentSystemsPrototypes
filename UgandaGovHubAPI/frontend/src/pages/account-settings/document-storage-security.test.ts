import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const accountSettingsPage = fs.readFileSync(path.join(currentDir, '..', 'AccountSettingsPage.tsx'), 'utf8');
const documentsSettingsTab = fs.readFileSync(path.join(currentDir, 'DocumentsSettingsTab.tsx'), 'utf8');
const documentUploader = fs.readFileSync(path.join(currentDir, 'DocumentUploader.tsx'), 'utf8');

assert.equal(
  accountSettingsPage.includes('storage_ref'),
  false,
  'Account settings must not over-post document storage_ref values to the backend.',
);

assert.equal(
  documentUploader.includes('s3://'),
  false,
  'Document upload UI must not fabricate internal storage locator schemes.',
);

assert.equal(
  documentsSettingsTab.includes('storageRef'),
  false,
  'Document settings should pass only public document metadata from uploader to API save handler.',
);
