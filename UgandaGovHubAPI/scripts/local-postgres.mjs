import { spawn, spawnSync } from 'node:child_process';
import { accessSync, closeSync, constants, existsSync, mkdirSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const containerName = process.env.GOVHUB_POSTGRES_CONTAINER || 'uganda-govhub-postgres';
const imageName = process.env.GOVHUB_POSTGRES_IMAGE || 'postgres:16-alpine';
const databaseName = process.env.GOVHUB_POSTGRES_DB || 'govhub';
const databaseUser = process.env.GOVHUB_POSTGRES_USER || 'govhub_admin';
const databasePassword = process.env.GOVHUB_POSTGRES_PASSWORD || 'GovHubAdmin#PV3ycqEB';
const databasePort = process.env.GOVHUB_POSTGRES_PORT || '5432';
const waitAttempts = Number.parseInt(process.env.GOVHUB_POSTGRES_WAIT_ATTEMPTS || '30', 10);
const waitDelayMs = Number.parseInt(process.env.GOVHUB_POSTGRES_WAIT_MS || '1000', 10);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function commandExists(command) {
  return spawnSync('sh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
    stdio: 'pipe',
  }).status === 0;
}

function runtimeDir() {
  if (process.env.XDG_RUNTIME_DIR) return process.env.XDG_RUNTIME_DIR;
  if (typeof process.getuid === 'function') return `/run/user/${process.getuid()}`;
  return '';
}

function rootlessDockerEnv() {
  const dir = runtimeDir();
  if (!dir) return undefined;

  return {
    ...process.env,
    XDG_RUNTIME_DIR: dir,
    DOCKER_HOST: `unix://${path.join(dir, 'docker.sock')}`,
  };
}

function dockerEnvCandidates() {
  const candidates = [];
  const seen = new Set();

  function add(label, env) {
    const key = env.DOCKER_HOST || '<default>';
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ label, env });
  }

  if (process.env.DOCKER_HOST) add(`DOCKER_HOST=${process.env.DOCKER_HOST}`, { ...process.env });
  add('Docker default socket', { ...process.env, DOCKER_HOST: undefined });

  const rootless = rootlessDockerEnv();
  if (rootless) add(`rootless Docker socket ${rootless.DOCKER_HOST}`, rootless);

  return candidates;
}

function dockerInfo(candidate) {
  return spawnSync('docker', ['info'], {
    env: candidate.env,
    encoding: 'utf8',
    stdio: 'pipe',
  }).status === 0;
}

function findRunningDocker() {
  for (const candidate of dockerEnvCandidates()) {
    if (dockerInfo(candidate)) return candidate;
  }

  return undefined;
}

function waitForDocker(maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = findRunningDocker();
    if (candidate) return candidate;
    sleep(1000);
  }

  return undefined;
}

function tryCommand(label, command, args) {
  if (!commandExists(command)) return undefined;

  console.log(`[docker] Trying ${label}...`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 15000,
  });

  if (result.error) {
    console.log(`[docker] ${label} failed: ${result.error.message}`);
  } else if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    console.log(`[docker] ${label} did not start Docker.${message ? ` ${message}` : ''}`);
  }

  return waitForDocker(8);
}

function canWriteDirectory(dir) {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function tryRootlessDocker() {
  if (!commandExists('dockerd-rootless.sh')) return undefined;

  const dir = runtimeDir();
  if (!dir || !existsSync(dir) || !canWriteDirectory(dir)) {
    console.log(`[docker] Cannot start rootless Docker because ${dir || 'XDG_RUNTIME_DIR'} is not writable.`);
    return undefined;
  }

  const logDir = path.join(os.tmpdir(), 'uganda-govhub-docker');
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'dockerd-rootless.log');
  const logFd = openSync(logPath, 'a');

  console.log('[docker] Trying rootless Docker daemon...');
  const child = spawn('dockerd-rootless.sh', [], {
    detached: true,
    env: { ...process.env, XDG_RUNTIME_DIR: dir },
    stdio: ['ignore', logFd, logFd],
  });
  closeSync(logFd);
  child.unref();

  const candidate = waitForDocker(30);
  if (!candidate) {
    console.log(`[docker] Rootless Docker did not become ready. See ${logPath}`);
  }

  return candidate;
}

function tryPasswordlessSystemDocker() {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    return (
      tryCommand('system Docker service via systemctl', 'systemctl', ['start', 'docker']) ||
      tryCommand('system Docker service via service', 'service', ['docker', 'start'])
    );
  }

  if (!commandExists('sudo')) return undefined;

  return (
    tryCommand('passwordless sudo systemctl start docker', 'sudo', ['-n', 'systemctl', 'start', 'docker']) ||
    tryCommand('passwordless sudo service docker start', 'sudo', ['-n', 'service', 'docker', 'start'])
  );
}

function ensureDocker() {
  const running = findRunningDocker();
  if (running) {
    console.log(`[docker] Docker is running via ${running.label}.`);
    return running;
  }

  console.log('[docker] Docker is not running. Trying to start it for local development...');
  const started =
    tryCommand('user Docker service via systemctl', 'systemctl', ['--user', 'start', 'docker']) ||
    tryRootlessDocker() ||
    tryPasswordlessSystemDocker();

  if (started) {
    console.log(`[docker] Docker is ready via ${started.label}.`);
    return started;
  }

  throw new Error(
    [
      'Docker is installed, but GovHub could not start a reachable Docker daemon automatically.',
      'Tried user systemd, rootless dockerd, and passwordless system Docker startup.',
      'If this machine requires a privileged Docker service, configure rootless Docker or passwordless Docker service startup for local development.',
    ].join(' '),
  );
}

function runDocker(args, env, options = {}) {
  const result = spawnSync('docker', args, {
    env,
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  return result.status || 0;
}

function up() {
  const { env } = ensureDocker();
  const startStatus = runDocker(['start', containerName], env);
  if (startStatus === 0) return;

  const runStatus = runDocker(
    [
      'run',
      '--name',
      containerName,
      '-e',
      `POSTGRES_USER=${databaseUser}`,
      '-e',
      `POSTGRES_PASSWORD=${databasePassword}`,
      '-e',
      `POSTGRES_DB=${databaseName}`,
      '-e',
      'POSTGRES_INITDB_ARGS=--no-sync',
      '-p',
      `127.0.0.1:${databasePort}:5432`,
      '-v',
      'uganda_govhub_postgres_data:/var/lib/postgresql/data',
      '-d',
      imageName,
      'postgres',
      '-c',
      'fsync=off',
    ],
    env,
  );

  process.exit(runStatus);
}

function wait() {
  const { env } = ensureDocker();

  for (let attempt = 1; attempt <= waitAttempts; attempt += 1) {
    const status = runDocker(
      ['exec', containerName, 'pg_isready', '-U', databaseUser, '-d', databaseName],
      env,
      { stdio: 'pipe' },
    );

    if (status === 0) {
      console.log(`[db:wait] Postgres is ready in ${containerName}.`);
      return;
    }

    console.log(`[db:wait] Waiting for Postgres (${attempt}/${waitAttempts}).`);
    sleep(waitDelayMs);
  }

  console.error(`[db:wait] Postgres did not become ready in ${containerName}.`);
  process.exit(1);
}

function down() {
  const { env } = ensureDocker();
  process.exit(runDocker(['stop', containerName], env));
}

function logs() {
  const { env } = ensureDocker();
  process.exit(runDocker(['logs', '-f', containerName], env));
}

const action = process.argv[2];

try {
  if (action === 'up') up();
  else if (action === 'wait') wait();
  else if (action === 'down') down();
  else if (action === 'logs') logs();
  else {
    console.error('Usage: node scripts/local-postgres.mjs <up|wait|down|logs>');
    process.exit(1);
  }
} catch (error) {
  console.error(`[local-postgres] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
