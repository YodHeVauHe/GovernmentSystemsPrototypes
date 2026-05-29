import { IconFileCertificate, IconFingerprint } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DocumentUploader } from './DocumentUploader';
import { SettingsTabFrame } from './SettingsTabFrame';
import type { AccountSnapshot } from './types';

type DocumentsSettingsTabProps = {
  account: AccountSnapshot;
  onSaveDocument: (type: string, label: string, fileName: string, mimeType: string, storageRef: string) => void;
  onSubmitVerification: () => void;
};

export function DocumentsSettingsTab({ account, onSaveDocument, onSubmitVerification }: DocumentsSettingsTabProps) {
  const status = account.profile.verification_status;
  const isSubmittableStatus = status === 'draft_profile' || status === 'needs_more_information';
  const canSubmit = account.verification_progress ? account.verification_progress.can_submit && isSubmittableStatus : isSubmittableStatus;
  const missingRequirements = [
    ...(account.verification_progress?.missing_fields || []),
    ...(account.verification_progress?.missing_documents || []),
  ];

  return (
    <SettingsTabFrame
      icon={<IconFileCertificate className="size-5 text-[#3ecf8e]" />}
      title="Verification Documents"
      description="Upload official credentials and credentials letters to verify identity and authority."
    >
      <div className="flex items-start gap-3 rounded-xl border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 p-4">
        <IconFingerprint className="mt-0.5 size-5 shrink-0 animate-pulse text-[#3ecf8e]" />
        <div>
          <div className="text-sm font-semibold text-foreground">{account.requirements.label}</div>
          <p className="mt-1 text-xs leading-relaxed text-foreground-light">{account.requirements.description}</p>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        {account.requirements.requiredDocuments.map(docReq => {
          const submittedDoc = account.documents.find(document => document.type === docReq.type);
          return (
            <DocumentUploader
              key={docReq.type}
              type={docReq.type}
              label={docReq.label}
              accepts={docReq.accepts}
              submittedDoc={submittedDoc}
              onUploadComplete={(fileName, mimeType, storageRef) => {
                onSaveDocument(docReq.type, docReq.label, fileName, mimeType, storageRef);
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Submit for Review</h3>
          <p className="mt-0.5 text-xs text-foreground-light">
            {canSubmit
              ? 'Once all required documents are uploaded, submit your account for administrator authorization.'
              : missingRequirements.length > 0
                ? `Complete missing requirements first: ${missingRequirements.slice(0, 4).join(', ')}`
                : account.verification_progress?.message || 'This account is not currently ready for verification submission.'}
          </p>
        </div>
        <Button
          disabled={!canSubmit}
          onClick={onSubmitVerification}
          className="shrink-0 bg-[#3ecf8e] px-5 font-semibold text-black shadow-md transition-all hover:bg-[#3ecf8e]/95 disabled:opacity-50"
        >
          {status === 'submitted_for_review'
            ? 'Verification Pending Review'
            : canSubmit
              ? 'Submit for Admin Review'
              : 'Complete Requirements First'}
        </Button>
      </div>
    </SettingsTabFrame>
  );
}
