import { IconId } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SettingsTabFrame } from './SettingsTabFrame';
import type { AccountProfileDraft, UpdateProfileDraft } from './types';

type ProfileSettingsTabProps = {
  profileDraft: AccountProfileDraft;
  onUpdateDraft: UpdateProfileDraft;
  onSaveProfile: () => void;
};

export function ProfileSettingsTab({ profileDraft, onUpdateDraft, onSaveProfile }: ProfileSettingsTabProps) {
  return (
    <SettingsTabFrame
      icon={<IconId className="size-5 text-[#3ecf8e]" />}
      title="Profile Settings"
      description="Configure your identity details and account category to ensure appropriate platform authorization."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs font-semibold text-foreground-light">Account Category</Label>
          <select
            value={profileDraft.account_category || 'public_developer'}
            onChange={event => onUpdateDraft('account_category', event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors focus:border-[#3ecf8e] focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/30"
          >
            <option value="government_employee">Government Employee (MDA)</option>
            <option value="mda_api_owner">MDA API Owner</option>
            <option value="private_company">Private Company</option>
            <option value="business_name">Registered Business Name</option>
            <option value="public_developer">Public / Independent Developer</option>
            <option value="civil_society">Civil Society Organization</option>
            <option value="research_institution">Research / Academic Institution</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground-light">National ID Number (NIN)</Label>
          <Input
            value={profileDraft.nin || ''}
            onChange={event => onUpdateDraft('nin', event.target.value)}
            className="border-border bg-background text-foreground focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/30"
            placeholder="e.g. CM8100..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground-light">Card Number</Label>
          <Input
            value={profileDraft.national_id_number || ''}
            onChange={event => onUpdateDraft('national_id_number', event.target.value)}
            className="border-border bg-background text-foreground focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/30"
            placeholder="e.g. 10928..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs font-semibold text-foreground-light">Phone Contact</Label>
          <Input
            value={profileDraft.contact_phone || ''}
            onChange={event => onUpdateDraft('contact_phone', event.target.value)}
            className="border-border bg-background text-foreground focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/30"
            placeholder="e.g. +256 700 000000"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs font-semibold text-foreground-light">Physical Address</Label>
          <Textarea
            value={profileDraft.address || ''}
            onChange={event => onUpdateDraft('address', event.target.value)}
            rows={3}
            className="border-border bg-background text-foreground focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/30"
            placeholder="Plot, Street, City, Kampala"
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={onSaveProfile} className="bg-[#3ecf8e] px-6 font-semibold text-black shadow-md transition-all duration-200 hover:bg-[#3ecf8e]/95">
          Save Profile
        </Button>
      </div>
    </SettingsTabFrame>
  );
}
