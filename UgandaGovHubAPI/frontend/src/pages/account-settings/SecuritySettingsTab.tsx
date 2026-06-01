import { useEffect, useState } from 'react';
import { IconCopy, IconExternalLink, IconLock } from '@tabler/icons-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import type { AuthUser } from '@/context/UserContext';
import { SettingsTabFrame } from './SettingsTabFrame';

type SecuritySettingsTabProps = {
  user: AuthUser | null;
  mfaSetup: { secret: string; otpauth_url: string } | null;
  mfaCode: string;
  mfaPassword: string;
  mfaBusy: boolean;
  onSetMfaCode: (value: string) => void;
  onSetMfaPassword: (value: string) => void;
  onStartMfaSetup: () => void;
  onEnableMfa: () => void;
  onDisableMfa: () => void;
};

function buildAuthenticatorSetupUri(user: AuthUser | null, mfaSetup: { secret: string; otpauth_url: string }) {
  const issuer = 'Uganda GovHub API';
  const accountName = user?.email || 'GovHub account';
  const params = new URLSearchParams({
    secret: mfaSetup.secret.replace(/\s/g, ''),
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${encodeURIComponent(`${issuer}:${accountName}`)}?${params.toString()}`;
}

export function SecuritySettingsTab({
  user,
  mfaSetup,
  mfaCode,
  mfaPassword,
  mfaBusy,
  onSetMfaCode,
  onSetMfaPassword,
  onStartMfaSetup,
  onEnableMfa,
  onDisableMfa,
}: SecuritySettingsTabProps) {
  const [mfaQrCodeUrl, setMfaQrCodeUrl] = useState('');
  const authenticatorSetupUri = mfaSetup ? buildAuthenticatorSetupUri(user, mfaSetup) : '';

  useEffect(() => {
    let isMounted = true;

    if (!authenticatorSetupUri) {
      setMfaQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(authenticatorSetupUri, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 220,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => {
        if (isMounted) setMfaQrCodeUrl(url);
      })
      .catch(() => {
        if (isMounted) setMfaQrCodeUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [authenticatorSetupUri]);

  const copyMfaValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  return (
    <SettingsTabFrame
      icon={<IconLock className="size-5 text-[#3ecf8e]" />}
      title="Account Security"
      description="Manage sign-in controls for your GovHub account."
    >
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Multi-factor authentication</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-foreground-light">
              Require a six-digit authenticator code after password sign-in.
            </p>
          </div>
          <div className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
            user?.mfa_enabled
              ? 'border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#3ecf8e]'
              : 'border-red-400/30 bg-red-500/10 text-red-300'
          }`}>
            {user?.mfa_enabled ? 'Enabled' : 'Not enabled'}
          </div>
        </div>

        {!user?.mfa_enabled && !mfaSetup && (
          <div className="mt-4 w-full max-w-xs space-y-1.5 md:ml-auto md:text-right">
            <Label htmlFor="mfa_setup_password" className="md:justify-end">Confirm password</Label>
            <Input
              id="mfa_setup_password"
              type="password"
              value={mfaPassword}
              onChange={event => onSetMfaPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Button onClick={onStartMfaSetup} disabled={mfaBusy || !mfaPassword} className="w-full bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/95">
              {mfaBusy && <Spinner className="size-4" />}
              Start MFA Setup
            </Button>
          </div>
        )}

        {!user?.mfa_enabled && mfaSetup && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4">
              <div className="text-sm font-semibold text-foreground">Set up your authenticator app</div>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-foreground-light">
                <li><span className="font-semibold text-foreground">1.</span> Open Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, Authy, or another TOTP authenticator app.</li>
                <li><span className="font-semibold text-foreground">2.</span> Add a new account and scan the QR code below. If you cannot scan it, use the setup link or paste the manual setup key.</li>
                <li><span className="font-semibold text-foreground">3.</span> Your app will show a changing six-digit code. Enter that code in the verification field, then enable MFA.</li>
              </ol>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#3ecf8e]">Manual setup key</div>
                  <p className="mt-1 text-xs leading-5 text-foreground-light">
                    Use this if your authenticator app asks for a setup key or secret.
                  </p>
                  <div className="mt-3 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
                    {mfaSetup.secret}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => copyMfaValue(mfaSetup.secret, 'Setup key')}
                  >
                    <IconCopy className="size-4" />
                    Copy setup key
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <Label htmlFor="mfa_enable_code">Six-digit code from your authenticator app</Label>
                  <OtpCodeInput
                    id="mfa_enable_code"
                    value={mfaCode}
                    onChange={onSetMfaCode}
                  />
                  <p className="mt-2 text-xs leading-5 text-foreground-light">
                    The code changes every 30 seconds. Use the current code shown in your authenticator app.
                  </p>
                  <Button onClick={onEnableMfa} disabled={mfaBusy || mfaCode.length !== 6} className="mt-3 bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/95">
                    {mfaBusy && <Spinner className="size-4" />}
                    Enable MFA
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#3ecf8e]">Authenticator QR code</div>
                <p className="mt-1 text-xs leading-5 text-foreground-light">
                  Scan this with your authenticator app to add GovHub automatically.
                </p>
                {mfaQrCodeUrl ? (
                  <div className="relative mt-3 inline-flex rounded-lg border border-border bg-white p-3">
                    <img
                      src={mfaQrCodeUrl}
                      alt="QR code for authenticator app setup"
                      className="size-56"
                    />
                    <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 border-white bg-white shadow-sm">
                      <img
                        src="/favicon.svg"
                        alt=""
                        aria-hidden="true"
                        className="size-8 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground-light">
                    QR code is unavailable. Use the setup link or manual setup key instead.
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={authenticatorSetupUri}>
                      <IconExternalLink className="size-4" />
                      Open setup link
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyMfaValue(authenticatorSetupUri, 'Setup link')}
                  >
                    <IconCopy className="size-4" />
                    Copy link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.mfa_enabled && (
          <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mfa_disable_password">Password</Label>
              <Input id="mfa_disable_password" type="password" value={mfaPassword} onChange={event => onSetMfaPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfa_disable_code">Authenticator code</Label>
              <OtpCodeInput id="mfa_disable_code" value={mfaCode} onChange={onSetMfaCode} />
            </div>
            <div className="md:col-span-2">
              <Button variant="destructive" onClick={onDisableMfa} disabled={mfaBusy || !mfaPassword || mfaCode.length !== 6}>
                {mfaBusy && <Spinner className="size-4" />}
                Disable MFA
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsTabFrame>
  );
}
