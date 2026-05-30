import assert from 'assert';
import { encryptAtRest } from './crypto-at-rest';

const originalNodeEnv = process.env.NODE_ENV;
const originalDemoMode = process.env.GOVHUB_DEMO_MODE;
const originalEncryptionKey = process.env.GOVHUB_DATA_ENCRYPTION_KEY;

try {
  process.env.NODE_ENV = 'production';
  process.env.GOVHUB_DEMO_MODE = 'true';
  delete process.env.GOVHUB_DATA_ENCRYPTION_KEY;

  assert.throws(
    () => encryptAtRest('sensitive-value'),
    /GOVHUB_DATA_ENCRYPTION_KEY is required in production/
  );
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalDemoMode === undefined) delete process.env.GOVHUB_DEMO_MODE;
  else process.env.GOVHUB_DEMO_MODE = originalDemoMode;
  if (originalEncryptionKey === undefined) delete process.env.GOVHUB_DATA_ENCRYPTION_KEY;
  else process.env.GOVHUB_DATA_ENCRYPTION_KEY = originalEncryptionKey;
}
