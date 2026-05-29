import { IconCheck, IconCode, IconLink, IconUpload } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';

type SourceTab = 'url' | 'file' | 'text';

type OpenApiImportStepProps = {
  activeSourceTab: SourceTab;
  specUrl: string;
  specText: string;
  loading: boolean;
  validationError: string;
  onSelectSourceTab: (tab: SourceTab) => void;
  onSpecUrlChange: (value: string) => void;
  onSpecTextChange: (value: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onValidateSpec: () => void;
};

export function OpenApiImportStep({
  activeSourceTab,
  specUrl,
  specText,
  loading,
  validationError,
  onSelectSourceTab,
  onSpecUrlChange,
  onSpecTextChange,
  onFileUpload,
  onValidateSpec,
}: OpenApiImportStepProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4">
        <p className="text-[13px] text-[#8b8b8b]">
          Import the API OpenAPI Specification file. The GovHub validation engine will extract structure and endpoints to prepare compliance sheets.
        </p>

        <div className="flex rounded-lg border border-[#2e2e2e] bg-[#141414] p-1 text-[13px]">
          <SourceTabButton active={activeSourceTab === 'url'} onClick={() => onSelectSourceTab('url')} icon={<IconLink className="h-3.5 w-3.5" />} label="Spec URL" />
          <SourceTabButton active={activeSourceTab === 'file'} onClick={() => onSelectSourceTab('file')} icon={<IconUpload className="h-3.5 w-3.5" />} label="Upload Spec" />
          <SourceTabButton active={activeSourceTab === 'text'} onClick={() => onSelectSourceTab('text')} icon={<IconCode className="h-3.5 w-3.5" />} label="Raw Code" />
        </div>

        {activeSourceTab === 'url' && (
          <div className="space-y-2">
            <label className="block font-mono text-[12px] uppercase tracking-wider text-[#8b8b8b]">OpenAPI URL</label>
            <input
              type="url"
              placeholder="https://raw.githubusercontent.com/OAS/main/spec.yaml"
              value={specUrl}
              onChange={event => onSpecUrlChange(event.target.value)}
              className="h-[38px] w-full rounded-md border border-[#2e2e2e] bg-[#141414] px-3 text-[13px] text-white transition-colors focus:border-[#3ecf8e] focus:outline-none"
            />
          </div>
        )}

        {activeSourceTab === 'file' && (
          <div className="space-y-2">
            <label className="block font-mono text-[12px] uppercase tracking-wider text-[#8b8b8b]">Upload YAML or JSON Specification</label>
            <div className="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] p-6 transition-colors hover:border-[#3ecf8e]">
              <input type="file" accept=".yaml,.yml,.json" onChange={onFileUpload} className="absolute inset-0 cursor-pointer opacity-0" />
              <IconUpload className="mb-2 h-8 w-8 text-[#8b8b8b]" />
              <span className="text-[13px] font-medium text-white">Click or drop YAML/JSON here</span>
              <span className="mt-1 text-[11px] text-[#8b8b8b]">Accepts standard .yaml, .yml, or .json</span>
            </div>
            {specText && (
              <div className="flex items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-2.5 font-mono text-[11px] text-[#3ecf8e]">
                <IconCheck className="h-3.5 w-3.5" /> Spec loaded cleanly ({specText.length} characters)
              </div>
            )}
          </div>
        )}

        {activeSourceTab === 'text' && (
          <div className="space-y-2">
            <label className="block font-mono text-[12px] uppercase tracking-wider text-[#8b8b8b]">Pasted Raw YAML/JSON Specification</label>
            <textarea
              placeholder="openapi: 3.0.0&#10;info:&#10;  title: Citizen Data Lookup API&#10;..."
              value={specText}
              onChange={event => onSpecTextChange(event.target.value)}
              rows={8}
              className="w-full resize-y rounded-md border border-[#2e2e2e] bg-[#141414] p-3 font-mono text-[13px] text-white transition-colors focus:border-[#3ecf8e] focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        {validationError && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-[12px] text-red-400">
            <span className="mb-0.5 block font-semibold">OpenAPI Validation Failed</span>
            {validationError}
          </div>
        )}

        <button
          type="button"
          onClick={onValidateSpec}
          disabled={loading || (activeSourceTab === 'url' ? !specUrl : !specText)}
          className="flex h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#3ecf8e] text-[13px] font-semibold text-black transition-colors hover:bg-[#3ecf8e]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner className="h-4 w-4 text-black" /> : <IconCheck className="h-4 w-4" />}
          Validate OpenAPI Specification
        </button>
      </div>
    </div>
  );
}

function SourceTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-all ${active ? 'border border-[#3e3e3e] bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
    >
      {icon} {label}
    </button>
  );
}
