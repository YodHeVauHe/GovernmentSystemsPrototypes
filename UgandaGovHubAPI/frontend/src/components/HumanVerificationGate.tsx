import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { API_BASE } from '@/lib/api-base';
import {
  HUMAN_VERIFICATION_STORAGE_KEY,
  shouldBypassTurnstileServerVerification,
} from '@/lib/turnstile-config';

function currentHostName() {
  return window.location.hostname || 'Uganda GovHub API Portal';
}

function readStoredVerification() {
  try {
    return window.sessionStorage.getItem(HUMAN_VERIFICATION_STORAGE_KEY) === 'verified';
  } catch {
    return false;
  }
}

function storeVerification() {
  try {
    window.sessionStorage.setItem(HUMAN_VERIFICATION_STORAGE_KEY, 'verified');
  } catch {
    // Private browsing modes can reject storage; the in-memory state still unlocks the current load.
  }
}

export function HumanVerificationGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(readStoredVerification);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const hostName = currentHostName();

  const retry = () => {
    setError('');
    setVerifying(false);
    setResetSignal(signal => signal + 1);
  };

  const verifyToken = useCallback(async (token: string) => {
    if (!token) return;
    setError('');
    if (shouldBypassTurnstileServerVerification()) {
      storeVerification();
      setIsVerified(true);
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/human-verification`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstile_token: token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Human verification failed. Please retry the challenge.');
      }
      storeVerification();
      setIsVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Human verification failed. Please retry the challenge.');
      setResetSignal(signal => signal + 1);
    } finally {
      setVerifying(false);
    }
  }, []);

  if (isVerified) return <>{children}</>;

  return (
    <main className="flex min-h-dvh flex-col bg-black px-6 text-[#ededed] sm:px-10">
      <section className="mx-auto flex w-full max-w-5xl flex-1 items-center py-16">
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10 rounded-md" />
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-[#8b8b8b]">
              Uganda GovHub API Portal
            </span>
          </div>

          <h1 className="mt-8 text-4xl font-semibold leading-tight text-white sm:text-5xl">{hostName}</h1>
          <h2 className="mt-4 text-2xl font-semibold text-[#ededed]">Performing security verification</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[#a3a3a3]">
            This website uses a security service to protect against malicious bots. This page is displayed while
            the website verifies you are not a bot.
          </p>

          <div className="mt-9">
            <TurnstileWidget
              action="app_load"
              resetSignal={resetSignal}
              onToken={verifyToken}
              onError={message => setError(message)}
            />
          </div>

          {verifying && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#a3a3a3]">
              <Spinner className="size-4 text-[#3ecf8e]" />
              <span>Verifying challenge</span>
            </div>
          )}

          {error && (
            <div className="mt-5 max-w-lg rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {error && (
            <Button type="button" variant="outline" className="mt-4 w-full max-w-[300px]" onClick={retry}>
              Retry verification
            </Button>
          )}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl border-t border-white/70 py-5 text-center text-xs text-[#a3a3a3]">
        <p>Ray ID: pending verification</p>
        <p className="mt-1">
          Performance and Security by <span className="text-[#8ab4f8]">Cloudflare</span>
          <span className="mx-2">|</span>
          <span className="text-[#8ab4f8]">Privacy</span>
        </p>
      </footer>
    </main>
  );
}
