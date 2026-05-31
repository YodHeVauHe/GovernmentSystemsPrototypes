import { IconCircleCheck, IconClipboardCheck } from '@tabler/icons-react';
import { SettingsTabFrame } from './SettingsTabFrame';
import type { AccountSnapshot } from './types';
import {
  hasMissingOrganizationFields,
  hasMissingProfileFields,
  hasMissingVerificationDocuments,
  resolveNextVerificationTab,
} from './verification-flow';

type VerificationStep = {
  title: string;
  desc: string;
  isActive: boolean;
  isCompleted: boolean;
};

export function SetupFlowTab({ account }: { account: AccountSnapshot }) {
  const status = account.profile.verification_status;
  const missingProfileFields = hasMissingProfileFields(account);
  const missingOrganizationFields = hasMissingOrganizationFields(account);
  const missingDocuments = hasMissingVerificationDocuments(account);
  const nextTab = resolveNextVerificationTab(account);
  const documentsComplete = account.requirements.requiredDocuments.length === 0 || !missingDocuments;

  const steps: VerificationStep[] = [
    {
      title: 'Account Registration',
      desc: 'Create an account and choose the correct category: government employee, company, business, public developer, civil society, or research institution.',
      isActive: false,
      isCompleted: true,
    },
    {
      title: 'Profile Details',
      desc: 'Complete profile and organization fields. Public developers provide NIN and National ID details; organizations provide URSB/BRN/TIN details where applicable.',
      isActive: nextTab === 'profile',
      isCompleted: (status !== 'draft_profile' && status !== 'needs_more_information') || !missingProfileFields,
    },
    {
      title: 'Organization and MDA Details',
      desc: 'Complete company, business, MDA, staff, department, supervisor, and authorization fields that apply to the selected account category.',
      isActive: nextTab === 'organization',
      isCompleted: (status !== 'draft_profile' && status !== 'needs_more_information') || !missingOrganizationFields,
    },
    {
      title: 'Evidence Verification Documents',
      desc: 'Submit document metadata for the required evidence. This prototype simulates document verification by collecting file metadata.',
      isActive: nextTab === 'documents' && missingDocuments,
      isCompleted: documentsComplete,
    },
    {
      title: 'Submit for Admin Review',
      desc: 'Submit the account for administrator review. Until approval, the account remains a registered applicant.',
      isActive: nextTab === 'documents' && Boolean(account.verification_progress?.can_submit),
      isCompleted: ['submitted_for_review', 'verified', 'suspended', 'rejected'].includes(status),
    },
    {
      title: 'Identity and Organization Verification',
      desc: 'Platform administrator verifies identity or organization documents, assigns appropriate security roles and MDA permissions, then approves/verifies the account.',
      isActive: status === 'submitted_for_review',
      isCompleted: status === 'verified',
    },
    {
      title: 'API Gateway Integration Access',
      desc: 'Once verified, request keys and credentials for specific Government APIs from the catalog. Each API access is approved independently.',
      isActive: status === 'verified',
      isCompleted: false,
    },
  ];

  return (
    <SettingsTabFrame
      icon={<IconClipboardCheck className="size-5 text-[#3ecf8e]" />}
      title="Verification Stepper"
      description="Track your progress towards completing full verification on the GovHub platform."
    >
      <div className="relative ml-4 space-y-6 border-l border-border py-2 pl-6">
        {steps.map((step, index) => (
          <div key={step.title} className="relative">
            <div className={`absolute -left-[35px] top-0.5 flex h-[18px] w-[18px] items-center justify-center text-[9px] font-bold leading-none transition-all ${
              step.isCompleted
                ? 'text-[#3ecf8e]'
                : step.isActive
                  ? 'rounded-full border border-[#3ecf8e] bg-background text-[#3ecf8e] ring-4 ring-[#3ecf8e]/10'
                  : 'rounded-full border border-border bg-background text-foreground-muted'
            }`}>
              {step.isCompleted ? <IconCircleCheck className="size-[18px]" strokeWidth={2.25} /> : index + 1}
            </div>

            <div className={`space-y-1 ${step.isActive ? 'opacity-100' : step.isCompleted ? 'opacity-90' : 'opacity-60'}`}>
              <h3 className={`flex items-center gap-2 text-sm font-semibold ${step.isActive ? 'text-[#3ecf8e]' : 'text-foreground'}`}>
                {step.title}
                {step.isActive && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ecf8e] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3ecf8e]" />
                  </span>
                )}
              </h3>
              <p className="max-w-2xl text-xs leading-relaxed text-foreground-light">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </SettingsTabFrame>
  );
}
