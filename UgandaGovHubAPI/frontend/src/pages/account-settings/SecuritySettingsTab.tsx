import { IconLock } from '@tabler/icons-react';
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
            <Button onClick={onStartMfaSetup} disabled={mfaBusy} className="bg-[#3ecf8e] text-black hover:bg-[#3ecf8e]/95">
              {mfaBusy && <Spinner className="size-4" />}
              Start MFA Setup
            </Button>
          )}
        </div>

        {!user?.mfa_enabled && mfaSetup && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#3ecf8e]">Authenticator secret</div>
              <div className="mt-2 break-all font-mono text-sm text-foreground">{mfaSetup.secret}</div>
              <div className="mt-2 break-all font-mono text-[11px] text-foreground-light">{mfaSetup.otpauth_url}</div>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="mfa_enable_code">Verification code</Label>
              <Input id="mfa_enable_code" inputMode="numeric" value={mfaCode} onChange={event => onSetMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
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
