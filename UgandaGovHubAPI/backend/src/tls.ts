import fs from 'fs';
import http from 'http';
import https from 'https';
import type { Application } from 'express';

export type TlsConfig = {
  enabled: boolean;
  options: {
    cert?: Buffer;
    key?: Buffer;
  };
};

export function getTlsConfig(env: NodeJS.ProcessEnv = process.env): TlsConfig {
  const certPath = env.GOVHUB_TLS_CERT_PATH;
  const keyPath = env.GOVHUB_TLS_KEY_PATH;
  if (!certPath && !keyPath) return { enabled: false, options: {} };
  if (!certPath || !keyPath) {
    throw new Error('Both GOVHUB_TLS_CERT_PATH and GOVHUB_TLS_KEY_PATH are required to enable TLS.');
  }
  return {
    enabled: true,
    options: {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
  };
}

export function createTransportServer(app: Application, env: NodeJS.ProcessEnv = process.env) {
  const tls = getTlsConfig(env);
  return tls.enabled ? https.createServer(tls.options as https.ServerOptions, app) : http.createServer(app);
}
