import { IconCopy, IconExternalLink, IconLock } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Multi-factor authentication</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-foreground-light">
              Require a six-digit authenticator code after password sign-in.
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold">
              {user?.mfa_enabled ? 'Enabled' : 'Not enabled'}
            </div>
          </div>

          {!user?.mfa_enabled && !mfaSetup && (
            <div className="w-full max-w-xs space-y-2 md:text-right">
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
        </div>

        {!user?.mfa_enabled && mfaSetup && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4">
              <div className="text-sm font-semibold text-foreground">Set up your authenticator app</div>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-foreground-light">
                <li><span className="font-semibold text-foreground">1.</span> Open Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, Authy, or another TOTP authenticator app.</li>
                <li><span className="font-semibold text-foreground">2.</span> Add a new account. If your app supports setup links, use the link below. Otherwise choose manual setup and paste the setup key.</li>
                <li><span className="font-semibold text-foreground">3.</span> Your app will show a changing six-digit code. Enter that code in the verification field, then enable MFA.</li>
              </ol>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#3ecf8e]">Manual setup key</div>
                <p className="mt-1 text-xs leading-5 text-foreground-light">
                  Use this when your authenticator app asks for a setup key or secret.
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
                <div className="text-xs font-semibold uppercase tracking-wider text-[#3ecf8e]">Authenticator setup link</div>
                <p className="mt-1 text-xs leading-5 text-foreground-light">
                  On phones or password managers, this link can open the authenticator setup screen directly.
                </p>
                <div className="mt-3 max-h-20 overflow-auto break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground-light">
                  {mfaSetup.otpauth_url}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={mfaSetup.otpauth_url}>
                      <IconExternalLink className="size-4" />
                      Open setup link
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyMfaValue(mfaSetup.otpauth_url, 'Setup link')}
                  >
                    <IconCopy className="size-4" />
                    Copy link
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-w-sm space-y-2">
              <Label htmlFor="mfa_enable_code">Six-digit code from your authenticator app</Label>
              <Input
                id="mfa_enable_code"
                inputMode="numeric"
                placeholder="123456"
                value={mfaCode}
                onChange={event => onSetMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <p className="text-xs leading-5 text-foreground-light">
                The code changes every 30 seconds. Use the current code shown in your authenticator app.
              </p>
            </div>
            <Button onClick={onEnableMfa} disabled={mfaBusy || mfaCode.length !== 6} className="bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/95">
              {mfaBusy && <Spinner className="size-4" />}
              Enable MFA
            </Button>
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
              <Input id="mfa_disable_code" inputMode="numeric" value={mfaCode} onChange={event => onSetMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
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
