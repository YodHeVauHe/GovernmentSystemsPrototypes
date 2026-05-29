import { useEffect } from 'react';
import { IconTerminal2, IconX } from '@tabler/icons-react';
import { SandboxTryItConsole } from './SandboxTryItConsole';

export function SandboxClientModal({
  open,
  onClose,
  api,
  endpoints,
  spec,
}: {
  open: boolean;
  onClose: () => void;
  api: any;
  endpoints: any[];
  spec: any;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 px-3 pt-10 sm:px-5">
      <button
        type="button"
        aria-label="Close sandbox simulator"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sandbox Console Simulator"
        className="relative z-[81] flex h-[calc(100dvh-48px)] w-full max-w-[1390px] flex-col overflow-hidden rounded-t-lg border border-[#2e2e2e] bg-[#181818] shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#2e2e2e] bg-[#141414] px-4 py-3 lg:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <IconTerminal2 className="h-4 w-4 shrink-0 text-[#3ecf8e]" />
              <h2 className="truncate text-[15px] font-semibold text-white">Sandbox Console Simulator</h2>
              <span className="inline-flex shrink-0 items-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[11px] font-mono uppercase text-[#3ecf8e]">
                {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[#8b8b8b]">
              {api.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] transition-colors hover:bg-[#2e2e2e] hover:text-white"
            aria-label="Close sandbox simulator"
          >
            <IconX className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <SandboxTryItConsole api={api} endpoints={endpoints} spec={spec} />
        </div>
      </section>
    </div>
  );
}
