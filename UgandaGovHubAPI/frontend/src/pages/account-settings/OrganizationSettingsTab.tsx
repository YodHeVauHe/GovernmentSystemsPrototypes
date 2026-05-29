import { IconBuildingBank } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTabFrame } from './SettingsTabFrame';
import type { AccountProfileDraft, UpdateProfileDraft } from './types';

type OrganizationSettingsTabProps = {
  profileDraft: AccountProfileDraft;
  onUpdateDraft: UpdateProfileDraft;
  onSaveProfile: () => void;
};

export function OrganizationSettingsTab({ profileDraft, onUpdateDraft, onSaveProfile }: OrganizationSettingsTabProps) {
  return (
    <SettingsTabFrame
      icon={<IconBuildingBank className="size-5 text-[#3ecf8e]" />}
      title="Organization & MDA Details"
      description="Register company and governmental details to establish corporate verification and access level."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#3ecf8e]">Corporate Identifiers</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ProfileInput label="Organization / Agency Name" value={profileDraft.organization_name} placeholder="e.g. Ministry of ICT and National Guidance" onChange={value => onUpdateDraft('organization_name', value)} wide />
            <ProfileInput label="Organization Type" value={profileDraft.organization_type} placeholder="e.g. Ministry, Agency, Private LLC" onChange={value => onUpdateDraft('organization_type', value)} />
            <ProfileInput label="URSB Registration Number" value={profileDraft.ursb_number} placeholder="URSB-XXX-XXX" onChange={value => onUpdateDraft('ursb_number', value)} />
            <ProfileInput label="BRN (Business Registration Number)" value={profileDraft.brn} onChange={value => onUpdateDraft('brn', value)} />
            <ProfileInput label="URA TIN (Tax Identification Number)" value={profileDraft.tin} placeholder="100XXXXXXXX" onChange={value => onUpdateDraft('tin', value)} />
          </div>
        </div>

        <div className="border-t border-border pt-6 md:col-span-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#3ecf8e]">Professional Credentials</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ProfileInput label="Department / Unit" value={profileDraft.department} placeholder="e.g. IT Department" onChange={value => onUpdateDraft('department', value)} />
            <ProfileInput label="Job Title" value={profileDraft.job_title} placeholder="e.g. Senior Software Engineer" onChange={value => onUpdateDraft('job_title', value)} />
            <ProfileInput label="Staff ID or Appointment Reference" value={profileDraft.staff_id} placeholder="e.g. MOICT-IT-092" onChange={value => onUpdateDraft('staff_id', value)} wide />
          </div>
        </div>

        <div className="border-t border-border pt-6 md:col-span-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#3ecf8e]">Supervisor Authorization</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ProfileInput label="Supervisor Name" value={profileDraft.supervisor_name} placeholder="e.g. Commissioner E-Government" onChange={value => onUpdateDraft('supervisor_name', value)} />
            <ProfileInput label="Supervisor Email" value={profileDraft.supervisor_email} placeholder="supervisor@ict.go.ug" onChange={value => onUpdateDraft('supervisor_email', value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={onSaveProfile} className="bg-[#3ecf8e] px-6 font-semibold text-black shadow-md transition-all duration-200 hover:bg-[#3ecf8e]/95">
          Save Organization Details
        </Button>
      </div>
    </SettingsTabFrame>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  onChange,
  wide = false,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? 'md:col-span-2' : ''}`}>
      <Label className="text-xs font-semibold text-foreground-light">{label}</Label>
      <Input
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        className="border-border bg-background text-foreground focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/30"
        placeholder={placeholder}
      />
    </div>
  );
}
