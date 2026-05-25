import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconInnerShadowTop } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/context/UserContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password, mfaRequired ? mfaCode : undefined);
      navigate(user.status === 'APPROVED' ? '/dashboard' : '/account-status');
    } catch (err: any) {
      if (err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError('');
      } else {
        setError(err.message || 'Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#181818] px-4 text-[#ededed]">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg border border-[#2e2e2e] bg-[#141414] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <IconInnerShadowTop className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Sign in</h1>
            <p className="text-sm text-[#8b8b8b]">Uganda GovHub API Portal</p>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} required />
        </div>
        {mfaRequired && (
          <div className="space-y-2">
            <Label htmlFor="mfa_code">Authenticator code</Label>
            <Input
              id="mfa_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={event => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in...' : mfaRequired ? 'Verify and sign in' : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-[#8b8b8b]">
          Need access? <Link className="text-[#3ecf8e] hover:text-white" to="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
