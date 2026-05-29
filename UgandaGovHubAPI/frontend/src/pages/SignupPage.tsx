import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconInnerShadowTop } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { MDAS_LIST, useUser, type UserRole } from '@/context/UserContext';

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
  const [submitting, setSubmitting] = useState(false);

  const selectedType = useMemo(
    () => accountTypes.find(type => type.value === form.account_type) || accountTypes[0],
    [form.account_type]
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const updateAccountType = (value: AccountType) => {
    const nextType = accountTypes.find(type => type.value === value) || accountTypes[0];
    setForm(current => ({
      ...current,
      account_type: value,
      requested_role: nextType.roleOptions[0],
      requested_mda_id: nextType.requiresMda ? current.requested_mda_id || 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' : '',
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signup({
        ...form,
        requested_mda_id: selectedType.requiresMda ? form.requested_mda_id : '',
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#181818] px-4 py-8 text-[#ededed]">
      <form onSubmit={submit} className="w-full max-w-3xl space-y-5 rounded-lg border border-[#2e2e2e] bg-[#141414] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#3ecf8e]/10 text-[#3ecf8e]">
            <IconInnerShadowTop className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Request account access</h1>
            <p className="text-sm text-[#8b8b8b]">Choose the account category that matches your legal identity or organization.</p>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="space-y-2">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full legal name</Label>
            <Input id="full_name" value={form.full_name} onChange={event => update('full_name', event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={event => update('email', event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" minLength={10} value={form.password} onChange={event => update('password', event.target.value)} required />
          </div>
          <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="requested_mda_id">Assigned MDA</Label>
              <select
                id="requested_mda_id"
                value={form.requested_mda_id || 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3'}
                onChange={event => update('requested_mda_id', event.target.value)}
                className="h-9 w-full rounded-md border border-[#2e2e2e] bg-[#181818] px-3 text-sm"
              >
                {MDAS_LIST.map(mda => <option key={mda.id} value={mda.id}>{mda.name} ({mda.shortName})</option>)}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="requested_organization">{selectedType.organizationLabel}</Label>
            <Input id="requested_organization" value={form.requested_organization} onChange={event => update('requested_organization', event.target.value)} required />
          </div>
        </div>

        <div className="rounded-md border border-[#2e2e2e] bg-[#181818] p-4 text-sm text-[#b5b5b5]">
          After account creation, you will complete verification in Account Settings. Public developers submit NIN and National ID images. Companies and businesses submit URSB/BRN/TIN evidence. Government employees submit staff and authorization details.
        </div>

        <div className="space-y-2">
          <Label htmlFor="requested_purpose">Access purpose</Label>
          <Textarea id="requested_purpose" value={form.requested_purpose} onChange={event => update('requested_purpose', event.target.value)} required />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner className="size-4" />}
            Create account for review
          </Button>
          <Link className="text-sm text-[#3ecf8e] hover:text-white" to="/login">Already have an account?</Link>
        </div>
      </form>
    </main>
  );
}
