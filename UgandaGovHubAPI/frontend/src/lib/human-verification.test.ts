import assert from 'node:assert/strict';
import { fetchHumanVerification } from './human-verification';

async function rejectsWithTimeout() {
  const neverResolvingFetch: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });

  await assert.rejects(
    () => fetchHumanVerification({
      apiBase: 'https://example.test',
      token: 'token',
      timeoutMs: 10,
      fetchImpl: neverResolvingFetch,
    }),
    /Human verification took too long/,
  );
}

await rejectsWithTimeout();

console.log('human verification timeout tests passed');
