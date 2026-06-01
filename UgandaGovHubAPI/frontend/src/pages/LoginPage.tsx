import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconInnerShadowTop } from '@tabler/icons-react';
import { OctagonXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { useUser } from '@/context/UserContext';
import { hasValidationErrors, validateLoginForm, type LoginValidationErrors } from '@/lib/auth-validation';

const MFA_SETUP_ROUTE = '/account/settings?tab=security';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const clearFieldError = (field: keyof LoginValidationErrors) => {
    setFieldErrors(current => ({ ...current, [field]: undefined }));
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetSignal(signal => signal + 1);
  };

  const returnToPasswordStep = () => {
    setMfaRequired(false);
    setMfaCode('');
    setFieldErrors({});
    setError('');
    resetTurnstile();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const nextFieldErrors = validateLoginForm({ email, password, mfaRequired, mfaCode, turnstileToken });
    setFieldErrors(nextFieldErrors);
    if (hasValidationErrors(nextFieldErrors)) return;

    setSubmitting(true);
    try {
      const user = await login({
        email: email.trim(),
        password,
        mfaCode: mfaRequired ? mfaCode : undefined,
        turnstileToken,
      });
      if (user.status !== 'APPROVED') {
        navigate('/account-status');
      } else if (!user.mfa_enabled) {
        navigate(MFA_SETUP_ROUTE);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setMfaCode('');
        setError('');
      } else {
        setError(err.message || 'Unable to sign in.');
        if (!mfaRequired) resetTurnstile();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-4 text-[#ededed]">
      <form onSubmit={submit} noValidate className="relative z-10 w-full max-w-[355px] space-y-5 rounded-lg border border-[#2e2e2e]/80 bg-[#141414]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <IconInnerShadowTop className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{mfaRequired ? 'Enter MFA code' : 'Sign in'}</h1>
            <p className="text-sm text-[#8b8b8b]">
              {mfaRequired ? `Code for ${email.trim()}` : 'Uganda GovHub API Portal'}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <OctagonXIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!mfaRequired && (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                onChange={event => {
                  setEmail(event.target.value);
                  clearFieldError('email');
                }}
                required
              />
              <FieldError id="email-error">{fieldErrors.email}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                onChange={event => {
                  setPassword(event.target.value);
                  clearFieldError('password');
                }}
                required
              />
              <FieldError id="password-error">{fieldErrors.password}</FieldError>
            </div>
          </>
        )}
        {mfaRequired ? (
          <div className="space-y-2">
            <Label htmlFor="mfa_code">Authenticator code</Label>
            <OtpCodeInput
              id="mfa_code"
              value={mfaCode}
              ariaInvalid={Boolean(fieldErrors.mfaCode)}
              ariaDescribedBy={fieldErrors.mfaCode ? 'mfa-code-error' : undefined}
              onChange={value => {
                setMfaCode(value);
                clearFieldError('mfaCode');
              }}
              required
            />
            <FieldError id="mfa-code-error">{fieldErrors.mfaCode}</FieldError>
            <p className="text-xs leading-5 text-[#8b8b8b]">
              Open your authenticator app and enter the current six-digit code.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Human verification</Label>
            <TurnstileWidget
              action="login"
              resetSignal={turnstileResetSignal}
              onToken={token => {
                setTurnstileToken(token);
                if (token) clearFieldError('turnstileToken');
              }}
              onError={message => setFieldErrors(current => ({ ...current, turnstileToken: message }))}
            />
            <FieldError>{fieldErrors.turnstileToken}</FieldError>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Spinner className="size-4" />}
          {mfaRequired ? 'Verify and sign in' : 'Sign in'}
        </Button>
        {mfaRequired ? (
          <Button type="button" variant="ghost" className="w-full" onClick={returnToPasswordStep}>
            Use a different account
          </Button>
        ) : (
          <p className="text-center text-sm text-[#8b8b8b]">
            Need access? <Link className="text-[#3ecf8e] hover:text-white" to="/signup">Create an account</Link>
          </p>
        )}
      </form>
    </main>
  );
}
