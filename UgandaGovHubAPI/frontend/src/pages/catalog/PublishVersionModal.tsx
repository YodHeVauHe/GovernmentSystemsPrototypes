import { useState } from 'react';
import { IconCheck, IconCode, IconGitBranch, IconLink, IconUpload, IconX } from '@tabler/icons-react';
import { Spinner } from '@/components/ui/spinner';
import { API_BASE } from '@/lib/api-base';

export function PublishVersionModal({
  apiId,
  onClose,
  onPublished,
}: {
  apiId: string;
  onClose: () => void;
  onPublished: (version: string) => void;
}) {
  const [sourceTab, setSourceTab] = useState<'url' | 'file' | 'text'>('url');
  const [specUrl, setSpecUrl] = useState('');
  const [specText, setSpecText] = useState('');
  const [notes, setNotes] = useState('');
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [loadedFileName, setLoadedFileName] = useState('');

  const loadFile = async (file?: File) => {
    if (!file) return;
    setLoadedFileName(file.name);
    setSpecText(await file.text());
    setNotes(`Published from ${file.name}`);
  };

  const publish = async () => {
    setPublishing(true);
    setError('');
    const requestSource = { sourceTab, specText, specUrl };

    try {
      const validateResponse = await fetch(`${API_BASE}/api/catalog/validate-spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specUrl: requestSource.sourceTab === 'url' ? requestSource.specUrl : undefined,
          specText: requestSource.sourceTab === 'url' ? undefined : requestSource.specText,
        }),
      });
      const parsed = await validateResponse.json();
      if (!validateResponse.ok || !parsed.valid) {
        throw new Error(parsed.error || 'Failed to validate OpenAPI document.');
      }

      const response = await fetch(`${API_BASE}/api/catalog/${apiId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openapi_spec: requestSource.sourceTab === 'url' ? undefined : requestSource.specText,
          specUrl: requestSource.sourceTab === 'url' ? requestSource.specUrl : undefined,
          status: 'Published',
          make_current: makeCurrent,
          notes: notes || (requestSource.sourceTab === 'url' ? `Published from ${requestSource.specUrl}` : 'Published from inline OpenAPI source'),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to publish version.');
      }

      onPublished(result.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish version.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = sourceTab === 'url' ? Boolean(specUrl.trim()) : Boolean(specText.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-2xl shadow-2xl flex max-h-[90vh] flex-col overflow-hidden text-left">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e]">
          <div>
            <h2 className="text-[16px] font-medium text-white">Publish API Version</h2>
            <p className="text-[12px] text-[#8b8b8b] mt-0.5">Load an OpenAPI document from a URL, upload, or raw source.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex bg-[#141414] p-1 rounded-lg border border-[#2e2e2e] text-[13px]">
            <button
              type="button"
              onClick={() => { setSourceTab('url'); setError(''); }}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${sourceTab === 'url' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconLink className="w-3.5 h-3.5" /> URL
            </button>
            <button
              type="button"
              onClick={() => { setSourceTab('file'); setError(''); }}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${sourceTab === 'file' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconUpload className="w-3.5 h-3.5" /> Upload
            </button>
            <button
              type="button"
              onClick={() => { setSourceTab('text'); setError(''); }}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${sourceTab === 'text' ? 'bg-[#2e2e2e] text-white border border-[#3e3e3e]' : 'text-[#8b8b8b] hover:text-white'}`}
            >
              <IconCode className="w-3.5 h-3.5" /> Raw
            </button>
          </div>

          {sourceTab === 'url' && (
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">OpenAPI URL</label>
              <input
                type="url"
                value={specUrl}
                onChange={event => setSpecUrl(event.target.value)}
                placeholder="https://example.go.ug/openapi.yaml"
                className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>
          )}

          {sourceTab === 'file' && (
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">OpenAPI Upload</label>
              <label
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  loadFile(event.dataTransfer.files?.[0]);
                }}
                className="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] p-7 text-center transition-colors hover:border-[#3ecf8e]"
              >
                <input
                  type="file"
                  accept=".yaml,.yml,.json"
                  onChange={event => loadFile(event.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <IconUpload className="mb-2 h-8 w-8 text-[#8b8b8b]" />
                <span className="text-[13px] font-medium text-white">Drop YAML/JSON here or choose a file</span>
                <span className="mt-1 text-[11px] text-[#8b8b8b]">OpenAPI source import, validated before publishing</span>
              </label>
              {loadedFileName && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#141414] p-2 text-[11px] font-mono text-[#3ecf8e]">
                  <IconCheck className="h-3.5 w-3.5" /> {loadedFileName} loaded ({specText.length} characters)
                </div>
              )}
            </div>
          )}

          {sourceTab === 'text' && (
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Raw OpenAPI Source</label>
              <textarea
                value={specText}
                onChange={event => setSpecText(event.target.value)}
                placeholder="openapi: 3.0.3&#10;info:&#10;  title: Updated API&#10;  version: 1.1.0"
                spellCheck={false}
                className="h-56 w-full resize-none rounded-md border border-[#2e2e2e] bg-[#0a0a0a] p-3 font-mono text-[12px] leading-relaxed text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Release Notes</label>
              <input
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="What changed in this version?"
                className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-[12px] text-[#ededed]">
              <input
                type="checkbox"
                checked={makeCurrent}
                onChange={event => setMakeCurrent(event.target.checked)}
                className="rounded border-[#2e2e2e] bg-[#141414] text-[#3ecf8e]"
              />
              Make current
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-[12px] text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#2e2e2e] px-6 py-4">
          <button type="button" onClick={onClose} className="h-9 px-4 border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] rounded-md text-[13px]">
            Cancel
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={!canPublish || publishing}
            className="h-9 px-4 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-md text-[13px] flex items-center gap-2 disabled:opacity-50"
          >
            {publishing ? <Spinner className="h-4 w-4" /> : <IconGitBranch className="h-4 w-4" />}
            Validate & Publish
          </button>
        </div>
      </div>
    </div>
  );
}
