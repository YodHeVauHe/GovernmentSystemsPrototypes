import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sandboxMiddleware } from './middleware/sandbox';
import { identityRouter } from './routes/identity';
import { taxRouter } from './routes/tax';
import { businessRouter } from './routes/business';
import { accessRouter } from './routes/access';
import { drivingPermitRouter } from './routes/driving-permit';
import { compositeRouter } from './routes/composite';
import { ensureApiVersionSchema } from './versioning';
import { ensureAdminSchema } from './admin';
import { ensureAuthSchema, ensureDefaultAdmin, ensureDemoUsers } from './auth';
import { adminUsersRouter, authRouter } from './routes/auth';
import { ensureAccountVerificationSchema } from './account-verification';
import { ensureDocsSchema } from './docs-access';
import { docsRouter } from './routes/docs';
import { initAuditColumnCache } from './audit';
import { createTransportServer, getTlsConfig } from './tls';
import { createDb } from './db';
import { syncProductionDemoCatalog } from './seed-production-demo-catalog';
import { findStoredSandboxOpenApiResponseExample } from './sandbox-openapi-response';
import { ensureCatalogSchema } from './catalog-schema';
import { openApiAssetsRouter } from './routes/openapi-assets';
import { catalogRouter } from './routes/catalog';

dotenv.config();

export const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';

const allowedOrigins = (process.env.GOVHUB_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  exposedHeaders: [
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
}));
app.use(async (req, res, next) => {
  const tlsEnabled = getTlsConfig().enabled || process.env.GOVHUB_TRUST_TLS_TERMINATION === 'true';
  if (tlsEnabled) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: process.env.GOVHUB_JSON_LIMIT || '1mb' }));

export const db = createDb();

app.use(openApiAssetsRouter(db));
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', service: 'Uganda GovHub API Mock Sandbox' });
});

app.use('/api/auth', authRouter(db));
app.use('/api/admin/users', adminUsersRouter(db));
app.use('/api/docs', docsRouter(db));
app.use('/api/catalog', catalogRouter(db));
app.use('/api/access', accessRouter(db));

app.use('/api/v1', sandboxMiddleware(db));
app.use('/api/v1', async (req, res, next) => {
  const example = await findStoredSandboxOpenApiResponseExample(
    db,
    res.locals.sandboxApiId,
    req.originalUrl,
    req.method,
  );
  if (example !== null) return res.json(example);
  next();
});
app.use('/api/v1/identity', identityRouter);
app.use('/api/v1/tax', taxRouter);
app.use('/api/v1/business', businessRouter);
app.use('/api/v1/transport/driving-permit', drivingPermitRouter);
app.use('/api/v1/service-uganda', compositeRouter);
app.use('/api/v1', async (req, res) => {
  res.json({
    requestId: res.getHeader('X-Correlation-ID'),
    status: 'ok',
    sandbox: true,
    message: 'Dynamic sandbox mock response generated from a registered OpenAPI server path.',
    path: req.originalUrl,
    method: req.method,
  });
});

export let server: ReturnType<typeof createTransportServer>;
let initialized: Promise<void> | null = null;

export function initializeApp() {
  if (!initialized) {
    initialized = (async () => {
      await ensureCatalogSchema(db);
      await ensureAuthSchema(db);
      await ensureAdminSchema(db);
      await ensureApiVersionSchema(db);
      await ensureDefaultAdmin(db);
      await ensureDemoUsers(db);
      await ensureAccountVerificationSchema(db);
      await ensureDocsSchema(db);
      if (process.env.GOVHUB_SYNC_DEMO_CATALOG !== 'false') {
        await syncProductionDemoCatalog(db);
      }
      await initAuditColumnCache(db);
    })();
  }
  return initialized;
}

export async function start() {
  await initializeApp();

  server = createTransportServer(app).listen(port, host, () => {
    const protocol = getTlsConfig().enabled ? 'https' : 'http';
    console.log(`Backend running at ${protocol}://${host}:${port}`);
  });
  return server;
}
