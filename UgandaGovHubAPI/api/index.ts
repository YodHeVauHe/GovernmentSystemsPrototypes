import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app, initializeApp } from '../backend/src/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  return app(req, res);
}
