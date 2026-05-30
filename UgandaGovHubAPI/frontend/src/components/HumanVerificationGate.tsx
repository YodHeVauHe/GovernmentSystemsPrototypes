import { useCallback, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { API_BASE } from '@/lib/api-base';
import {
  HUMAN_VERIFICATION_STORAGE_KEY,
  shouldBypassTurnstileServerVerification,
} from '@/lib/turnstile-config';

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
    <main className="flex min-h-dvh items-center justify-center bg-[#181818] px-4 text-[#ededed]">
      <section className="w-full max-w-sm rounded-lg border border-[#2e2e2e] bg-[#141414] p-6 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Verify you are human</h1>
            <p className="text-sm text-[#8b8b8b]">Uganda GovHub API Portal</p>
          </div>
        </div>

        <div className="mt-5">
          <TurnstileWidget
            action="app_load"
            resetSignal={resetSignal}
            onToken={verifyToken}
            onError={message => setError(message)}
          />
        </div>

        {verifying && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#8b8b8b]">
            <Spinner className="size-4 text-[#3ecf8e]" />
            <span>Verifying challenge</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {error && (
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={retry}>
            Retry verification
          </Button>
        )}
      </section>
    </main>
  );
}
