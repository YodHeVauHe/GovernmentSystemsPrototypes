import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IconCopy } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';
import { canCopyOneTimeApiKey } from '../view-helpers';

export function DashboardDialogs({
  oneTimeApiKey,
  oneTimeApiKeyCopied,
  oneTimeApiKeyOpenRef,
  setOneTimeApiKey,
  setOneTimeApiKeyCopied,
  handleCopyOneTimeApiKey,
  keyActionConfirmation,
  keyActionBusy,
  setKeyActionConfirmation,
  keyActionTitle,
  keyActionIsDelete,
  keyActionRequest,
  confirmKeyAction,
  keyActionButtonLabel,
}: any) {
  return (
    <>
            <AlertDialog
              open={Boolean(oneTimeApiKey)}
              onOpenChange={open => {
                if (!open) {
                  oneTimeApiKeyOpenRef.current = false;
                  setOneTimeApiKey(null);
                  setOneTimeApiKeyCopied(false);
                }
              }}
            >
              <AlertDialogContent className="border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Copy API Key Now</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#b5b5b5]">
                    This sandbox key is shown once. After this window is closed, the full key cannot be copied again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {oneTimeApiKey && (
                  <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px]">
                    <div className="font-semibold text-white">{oneTimeApiKey.apiName}</div>
                    <div className="mt-3 break-all rounded-md border border-[#2e2e2e] bg-[#101010] p-3 font-mono text-[#3ecf8e]">
                      {oneTimeApiKeyCopied ? oneTimeApiKey.apiKeyPreview || 'Copied' : oneTimeApiKey.apiKey}
                    </div>
                    {oneTimeApiKey.expiresAt && (
                      <div className="mt-2 text-[#8b8b8b]">
                        Expires {new Date(oneTimeApiKey.expiresAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-[#2e2e2e] bg-[#141414] text-[#ededed] hover:bg-[#2e2e2e] hover:text-white">
                    Close
                  </AlertDialogCancel>
                  <button
                    type="button"
                    onClick={handleCopyOneTimeApiKey}
                    disabled={!canCopyOneTimeApiKey(oneTimeApiKey?.apiKey, oneTimeApiKeyCopied)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-4 text-sm font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconCopy className="h-4 w-4" />
                    {oneTimeApiKeyCopied ? 'Copied' : 'Copy key'}
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={Boolean(keyActionConfirmation)}
              onOpenChange={open => {
                if (!open && !keyActionBusy) setKeyActionConfirmation(null);
              }}
            >
              <AlertDialogContent className="border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]">
                <AlertDialogHeader>
                  <AlertDialogTitle>{keyActionTitle}</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#b5b5b5]">
                    {keyActionIsDelete
                      ? 'The key will be removed from active channels and cannot be used again. The access request remains available in audit logs.'
                      : 'Existing clients using this key will be blocked immediately. The access request remains available in audit logs.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {keyActionRequest && (
                  <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px]">
                    <div className="font-semibold text-white">{keyActionRequest.api_name || 'Selected API'}</div>
                    <div className="mt-1 text-[#8b8b8b]">{keyActionRequest.mda_name || keyActionRequest.consumer_name || 'Selected consumer'}</div>
                    <div className="mt-2 font-mono text-[#3ecf8e]">{keyActionRequest.api_key_preview}</div>
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={keyActionBusy}
                    className="border-[#2e2e2e] bg-[#141414] text-[#ededed] hover:bg-[#2e2e2e] hover:text-white"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <button
                    type="button"
                    onClick={confirmKeyAction}
                    disabled={keyActionBusy}
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      keyActionIsDelete
                        ? 'bg-red-500 text-white hover:bg-red-400'
                        : 'bg-orange-400 text-black hover:bg-orange-300'
                    }`}
                  >
                    {keyActionBusy && <Spinner className="size-4" />}
                    {keyActionButtonLabel}
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
    </>
  );
}
