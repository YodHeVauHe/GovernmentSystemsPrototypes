import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getTurnstileSiteKey } from '@/lib/turnstile-config';

type TurnstileAction = 'app_load' | 'login' | 'signup';

interface TurnstileWidgetProps {
  action: TurnstileAction;
  className?: string;
  resetSignal?: number;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScript: Promise<void> | null = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScript) return turnstileScript;

  turnstileScript = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });
    document.head.appendChild(script);
  });

  return turnstileScript;
}

export function TurnstileWidget({ action, className, resetSignal = 0, onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const previousResetSignal = useRef(resetSignal);
  const [isReady, setIsReady] = useState(Boolean(window.turnstile));
  const [loadError, setLoadError] = useState('');
  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useEffect(() => {
    let mounted = true;
    loadTurnstileScript()
      .then(() => {
        if (mounted) setIsReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        const message = 'Human verification could not load. Check your connection and try again.';
        setLoadError(message);
        onErrorRef.current?.(message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !window.turnstile || !containerRef.current || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      action,
      callback: (token: string) => onTokenRef.current(token),
      'expired-callback': () => onTokenRef.current(''),
      'error-callback': () => {
        onTokenRef.current('');
        onErrorRef.current?.('Human verification failed to complete. Please retry the challenge.');
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, isReady, siteKey]);

  useEffect(() => {
    if (previousResetSignal.current === resetSignal) return;
    previousResetSignal.current = resetSignal;
    onTokenRef.current('');
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  return (
    <div className={cn('min-h-[76px] w-full overflow-x-auto', className)}>
      {!isReady && !loadError && (
        <div className="flex min-h-[76px] w-full max-w-[300px] items-center justify-center rounded-md border border-[#2e2e2e] bg-[#181818]">
          <Spinner className="size-5 text-[#3ecf8e]" />
          <span className="sr-only">Preparing human verification</span>
        </div>
      )}
      {loadError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </div>
      )}
      <div ref={containerRef} className={cn('w-fit max-w-full', !isReady && 'hidden')} />
    </div>
  );
}
