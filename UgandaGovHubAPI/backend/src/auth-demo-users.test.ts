import assert from 'assert';
import { resolveDemoUserCredentials, shouldSeedDemoUsers } from './auth';

const requiredSeed = {
  envPrefix: 'GOVHUB_DEMO_DEVELOPER',
  fallbackEmail: 'demo.developer@govhub.go.ug',
  fallbackPassword: 'DemoDeveloper123!',
  requiredForProductionDemo: true,
};

const optionalSeed = {
  envPrefix: 'GOVHUB_DEMO_PUBLIC_DEVELOPER',
  fallbackEmail: 'demo.public.developer@example.com',
  fallbackPassword: 'DemoPublicDev123!',
};

assert.equal(shouldSeedDemoUsers({ GOVHUB_DEMO_MODE: 'true' } as NodeJS.ProcessEnv), true);
assert.equal(shouldSeedDemoUsers({ GOVHUB_DEMO_MODE: 'false' } as NodeJS.ProcessEnv), false);

assert.deepEqual(
  resolveDemoUserCredentials(requiredSeed, { GOVHUB_DEMO_MODE: 'true' } as NodeJS.ProcessEnv),
  { email: 'demo.developer@govhub.go.ug', password: 'DemoDeveloper123!' },
);

assert.deepEqual(
  resolveDemoUserCredentials(requiredSeed, {
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'true',
    GOVHUB_DEMO_DEVELOPER_EMAIL: 'presentation.dev@govhub.go.ug',
    GOVHUB_DEMO_DEVELOPER_PASSWORD: 'PresentationDeveloper123!',
  } as NodeJS.ProcessEnv),
  { email: 'presentation.dev@govhub.go.ug', password: 'PresentationDeveloper123!' },
);

assert.throws(
  () => resolveDemoUserCredentials(requiredSeed, {
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'true',
  } as NodeJS.ProcessEnv),
  /GOVHUB_DEMO_DEVELOPER_PASSWORD is required/
);

assert.equal(
  resolveDemoUserCredentials(optionalSeed, {
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'true',
  } as NodeJS.ProcessEnv),
  null,
);
