import { db, start } from './index';

start().catch(async err => {
  console.error('[STARTUP] Failed to start backend:', err);
  await db.close();
  process.exit(1);
});
