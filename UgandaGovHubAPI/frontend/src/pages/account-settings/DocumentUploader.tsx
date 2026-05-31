import { useState } from 'react';
import { IconCheck, IconFileText, IconUpload } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';
import type { AccountDocument } from './types';

type DocumentUploaderProps = {
  label: string;
  accepts: string;
  submittedDoc?: AccountDocument;
  onUploadComplete: (fileName: string, mimeType: string) => void;
};

export function DocumentUploader({
  label,
  accepts,
  submittedDoc,
  onUploadComplete,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localFile, setLocalFile] = useState<{ name: string; size: string } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setLocalFile({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    });

    let currentProgress = 0;
    const interval = window.setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        window.clearInterval(interval);
        setUploading(false);
        onUploadComplete(file.name, file.type || 'application/pdf');
      }
      setProgress(currentProgress);
    }, 100);
  };

  if (submittedDoc && !uploading) {
    return (
      <div className="rounded-lg border border-border bg-background/40 p-4 transition-all hover:bg-background/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3ecf8e]/10 text-[#3ecf8e]">
              <IconFileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{label}</div>
              <div className="max-w-[200px] truncate font-mono text-xs text-foreground-light sm:max-w-md">
                {submittedDoc.file_name} - {submittedDoc.mime_type}
              </div>
            </div>
          </div>
          <div className="mt-2 flex shrink-0 items-center justify-between gap-3 sm:mt-0 sm:justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#3ecf8e]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3ecf8e]">
              <IconCheck className="size-3.5" />
              Submitted
            </span>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background">
              <input type="file" className="hidden" accept={accepts} onChange={handleFileChange} />
              Replace File
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background/20 p-4">
      <div className="mb-2 text-sm font-semibold text-foreground">{label}</div>

      {uploading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/50 p-6 text-center">
          <Spinner className="mb-2 size-6 text-[#3ecf8e]" />
          <div className="text-xs font-medium text-foreground">{localFile?.name || 'Selected file'}</div>
          <div className="mt-1 text-[10px] text-foreground-light">{localFile?.size}</div>

          <div className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-[#3ecf8e] transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 text-[10px] font-bold text-[#3ecf8e]">{progress}%</div>
        </div>
      ) : (
        <label className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/20 p-6 text-center transition-all hover:border-[#3ecf8e]/50 hover:bg-background/50">
          <input type="file" className="hidden" accept={accepts} onChange={handleFileChange} />
          <IconUpload className="mb-2 size-6 text-foreground-light transition-colors group-hover:text-[#3ecf8e]" />
          <div className="text-xs font-medium text-foreground transition-colors group-hover:text-foreground">
            Click to upload {label.toLowerCase()}
          </div>
          <div className="mt-1 text-[10px] text-foreground-light">Accepts: {accepts}</div>
        </label>
      )}
    </div>
  );
}
