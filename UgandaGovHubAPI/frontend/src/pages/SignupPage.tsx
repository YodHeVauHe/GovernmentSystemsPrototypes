import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconInfoCircle, IconInnerShadowTop } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { MDAS_LIST, useUser, type UserRole } from '@/context/UserContext';
import { hasValidationErrors, validateSignupForm, type SignupValidationErrors } from '@/lib/auth-validation';

type AccountType =
  | 'government_employee'
  | 'mda_api_owner'
  | 'private_company'
  | 'business_name'
  | 'public_developer'
  | 'civil_society'
  | 'research_institution';

const accountTypes: Array<{
  value: AccountType;
  label: string;
  description: string;
  roleOptions: UserRole[];
  organizationLabel: string;
  requiresMda: boolean;
}> = [
  {
    value: 'public_developer',
    label: 'Public Developer',
    description: 'Individual developer applying with NIN and National ID verification.',
    roleOptions: ['developer'],
    organizationLabel: 'Individual / project name',
    requiresMda: false,
  },
  {
    value: 'private_company',
    label: 'Private Company',
    description: 'Registered company applying with URSB, TIN, and authorization documents.',
    roleOptions: ['developer'],
    organizationLabel: 'Registered company name',
    requiresMda: false,
  },
  {
    value: 'business_name',
    label: 'Business Name',
    description: 'Registered business name applying with BRN and proprietor details.',
    roleOptions: ['developer'],
    organizationLabel: 'Registered business name',
    requiresMda: false,
  },
  {
    value: 'civil_society',
    label: 'Civil Society',
    description: 'NGO or civil society organization applying with registration evidence.',
    roleOptions: ['developer'],
    organizationLabel: 'Organization name',
    requiresMda: false,
  },
  {
    value: 'research_institution',
    label: 'Research Institution',
    description: 'University or research institution applying for an approved public-interest use case.',
    roleOptions: ['developer', 'reviewer'],
    organizationLabel: 'Institution name',
    requiresMda: false,
  },
  {
    value: 'government_employee',
    label: 'Government Employee',
    description: 'MDA staff applying with staff ID, supervisor, and authorization details.',
    roleOptions: ['developer', 'reviewer'],
    organizationLabel: 'Ministry, Department, or Agency',
    requiresMda: true,
  },
  {
    value: 'mda_api_owner',
    label: 'MDA API Owner',
    description: 'Authorized MDA officer applying to manage APIs owned by their institution.',
    roleOptions: ['api_owner'],
    organizationLabel: 'Owning MDA',
    requiresMda: true,
  },
];

const LOGIN_REDIRECT_DELAY_MS = 1400;
const DEFAULT_MDA_ID = 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3';

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useUser();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    account_type: 'public_developer' as AccountType,
    requested_role: 'developer' as UserRole,
    requested_mda_id: '',
    requested_organization: '',
    requested_purpose: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignupValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const selectedType = useMemo(
    () => accountTypes.find(type => type.value === form.account_type) || accountTypes[0],
    [form.account_type]
  );
  const selectedMda = useMemo(
    () => MDAS_LIST.find(mda => mda.id === (form.requested_mda_id || DEFAULT_MDA_ID)),
    [form.requested_mda_id]
  );

  const clearFieldError = (field: keyof SignupValidationErrors) => {
    setFieldErrors(current => ({ ...current, [field]: undefined }));
  };

  const update = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    if (key in fieldErrors) {
      clearFieldError(key as keyof SignupValidationErrors);
    }
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetSignal(signal => signal + 1);
  };

  const updateAccountType = (value: AccountType) => {
    const nextType = accountTypes.find(type => type.value === value) || accountTypes[0];
    setForm(current => ({
      ...current,
      account_type: value,
      requested_role: nextType.roleOptions[0],
      requested_mda_id: nextType.requiresMda ? current.requested_mda_id || DEFAULT_MDA_ID : '',
    }));
    clearFieldError('requested_mda_id');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const nextFieldErrors = validateSignupForm({ ...form, turnstileToken }, { requiresMda: selectedType.requiresMda });
    setFieldErrors(nextFieldErrors);
    if (hasValidationErrors(nextFieldErrors)) return;

    setSubmitting(true);
    try {
      await signup({
        ...form,
        requested_mda_id: selectedType.requiresMda ? form.requested_mda_id : '',
        turnstileToken,
      });
      toast.success('Account request submitted', {
        description: 'Your account was created. Sign in to complete verification from account settings.',
      });
      setTimeout(() => navigate('/login'), LOGIN_REDIRECT_DELAY_MS);
    } catch (err: any) {
      setError(err.message || 'Unable to create account.');
      resetTurnstile();
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-4 py-8 text-[#ededed]">
      <form onSubmit={submit} noValidate className="relative z-10 w-full max-w-xl space-y-3 rounded-lg border border-[#2e2e2e]/80 bg-[#141414]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <IconInnerShadowTop className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Request account access</h1>
            <p className="text-xs text-[#8b8b8b]">Select the account category that fits you.</p>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="space-y-1.5">
          <Label htmlFor="account_type">Account category</Label>
          <select
            id="account_type"
            value={form.account_type}
            onChange={event => updateAccountType(event.target.value as AccountType)}
            className="h-9 w-full rounded-md border border-[#2e2e2e] bg-[#181818] px-3 text-sm"
          >
            {accountTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <p className="text-xs text-[#8b8b8b]">{selectedType.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full legal name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              aria-invalid={Boolean(fieldErrors.full_name)}
              aria-describedby={fieldErrors.full_name ? 'full-name-error' : undefined}
              onChange={event => update('full_name', event.target.value)}
              required
            />
            <FieldError id="full-name-error">{fieldErrors.full_name}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              onChange={event => update('email', event.target.value)}
              required
            />
            <FieldError id="email-error">{fieldErrors.email}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={10}
              value={form.password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              onChange={event => update('password', event.target.value)}
              required
            />
            <FieldError id="password-error">{fieldErrors.password}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requested_role">Requested privilege</Label>
            <select
              id="requested_role"
              value={form.requested_role}
              onChange={event => update('requested_role', event.target.value)}
              className="h-9 w-full rounded-md border border-[#2e2e2e] bg-[#181818] px-3 text-sm"
            >
              {selectedType.roleOptions.map(role => (
                <option key={role} value={role}>
                  {role === 'api_owner' ? 'API Owner' : role === 'reviewer' ? 'Compliance Reviewer' : 'Developer'}
                </option>
              ))}
            </select>
          </div>
          {selectedType.requiresMda && (
            <div className="space-y-1.5">
              <Label htmlFor="requested_mda_id">Assigned MDA</Label>
              <Select value={form.requested_mda_id || DEFAULT_MDA_ID} onValueChange={value => update('requested_mda_id', value)}>
                <SelectTrigger
                  id="requested_mda_id"
                  className="w-full border-[#2e2e2e] bg-[#181818] text-[#ededed]"
                  aria-invalid={Boolean(fieldErrors.requested_mda_id)}
                  aria-describedby={fieldErrors.requested_mda_id ? 'requested-mda-error' : undefined}
                >
                  <SelectValue>{selectedMda?.shortName || 'Select MDA'}</SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#2e2e2e] bg-[#181818] text-[#ededed]">
                  {MDAS_LIST.map(mda => (
                    <SelectItem key={mda.id} value={mda.id}>
                      {mda.name} ({mda.shortName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="requested-mda-error">{fieldErrors.requested_mda_id}</FieldError>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="requested_organization">{selectedType.organizationLabel}</Label>
            <Input
              id="requested_organization"
              value={form.requested_organization}
              aria-invalid={Boolean(fieldErrors.requested_organization)}
              aria-describedby={fieldErrors.requested_organization ? 'requested-organization-error' : undefined}
              onChange={event => update('requested_organization', event.target.value)}
              required
            />
            <FieldError id="requested-organization-error">{fieldErrors.requested_organization}</FieldError>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-[#3ecf8e]">
            <IconInfoCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>Finish verification in Account Settings with NIN/ID, URSB/BRN/TIN, or staff authorization evidence.</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="requested_purpose">Access purpose</Label>
            <Textarea
              id="requested_purpose"
              value={form.requested_purpose}
              aria-invalid={Boolean(fieldErrors.requested_purpose)}
              aria-describedby={fieldErrors.requested_purpose ? 'requested-purpose-error' : undefined}
              onChange={event => update('requested_purpose', event.target.value)}
              required
            />
            <FieldError id="requested-purpose-error">{fieldErrors.requested_purpose}</FieldError>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="space-y-1.5">
            <Label>Human verification</Label>
            <TurnstileWidget
              action="signup"
              resetSignal={turnstileResetSignal}
              onToken={token => {
                setTurnstileToken(token);
                if (token) clearFieldError('turnstileToken');
              }}
              onError={message => setFieldErrors(current => ({ ...current, turnstileToken: message }))}
            />
            <FieldError>{fieldErrors.turnstileToken}</FieldError>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner className="size-4" />}
              Create account for review
            </Button>
            <Link className="text-sm text-[#3ecf8e] hover:text-white" to="/login">Already have an account?</Link>
          </div>
        </div>
      </form>
    </main>
  );
}
