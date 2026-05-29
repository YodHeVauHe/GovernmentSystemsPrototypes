import { useEffect, useMemo, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { API_BASE } from '@/lib/api-base';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';

export function RequestAccessModal({ api, onClose, onSubmitted }: { api: any, onClose: () => void, onSubmitted?: () => void }) {
  const { user, mdaId, mdas } = useUser();
  const { addNotification } = useNotifications();
  const [purpose, setPurpose] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [volumeTier, setVolumeTier] = useState('Low (< 1,000 / month)');
  const [environment, setEnvironment] = useState('sandbox');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState('');

  const fields = useMemo(() => api.personal_data_categories
    ? api.personal_data_categories.split(',').map((f: string) => f.trim())
    : [], [api.personal_data_categories]);

  useEffect(() => {
    setSelectedFields(fields);
  }, [fields]);

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    setError('');

    fetch(`${API_BASE}/api/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_id: api.id,
        consumer_mda_id: mdaId || null,
        purpose,
        requested_fields: selectedFields.join(', '),
        volume_tier: volumeTier,
        legal_basis: legalBasis,
        environment
      })
    })
    .then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to submit access request.');
      }
      return body;
    })
    .then(() => {
      const requesterName = requestingMda?.shortName || user?.requested_organization || user?.full_name || 'Your account';
      addNotification({
        type: 'access',
        title: 'Access request submitted',
        message: `${requesterName} requested access to ${api.name}.`,
      });
      setStatus('success');
      onSubmitted?.();
    })
    .catch(err => {
      const message = err instanceof Error ? err.message : 'Failed to submit access request.';
      setError(message);
      setStatus('idle');
      toast.error('Access request failed', { description: message });
    });
  };

  const requestingMda = mdas.find(m => m.id === mdaId);
  const requesterLabel = requestingMda ? `${requestingMda.name} (${requestingMda.shortName})` : user?.requested_organization || user?.full_name || 'your account';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e]">
          <div>
            <h2 className="text-[16px] font-medium text-white">Request API Access</h2>
            <p className="text-[12px] text-[#8b8b8b] mt-0.5">
              Requesting access as <span className="text-[#3ecf8e] font-semibold">{requesterLabel}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="p-8 text-center overflow-y-auto">
            <div className="w-12 h-12 bg-green-500/20 text-[#3ecf8e] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-[16px] font-medium text-white mb-2">Request Submitted</h3>
            <p className="text-[14px] text-[#8b8b8b] mb-6">
              Your access request for <span className="text-white font-medium">{api.name}</span> has been submitted for audit and administrative approval.
            </p>
            <button onClick={onClose} className="w-full h-[36px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] transition-all">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4 text-left">
            <div>
              <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Target API</label>
              <div className="h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white flex items-center font-medium">
                {api.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Environment</label>
                <select
                  value={environment}
                  onChange={e => setEnvironment(e.target.value)}
                  className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#444]"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Restricted)</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Volume Tier</label>
                <select
                  value={volumeTier}
                  onChange={e => setVolumeTier(e.target.value)}
                  className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] rounded-md text-[13px] text-white focus:outline-none focus:border-[#444]"
                >
                  <option>Low (&lt; 1,000 / month)</option>
                  <option>Medium (1,000 - 10,000 / month)</option>
                  <option>High (&gt; 10,000 / month)</option>
                </select>
              </div>
            </div>

            {fields.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-[#ededed] mb-2 font-mono uppercase tracking-wider text-[#8b8b8b]">Data Fields Requested</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#141414] border border-[#2e2e2e] rounded-md max-h-[120px] overflow-y-auto">
                  {fields.map((field: string) => (
                    <label key={field} className="flex items-center gap-2 text-[13px] text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field)}
                        onChange={() => handleFieldToggle(field)}
                        className="rounded border-[#2e2e2e] bg-[#1c1c1c] text-[#3ecf8e] focus:ring-0 focus:ring-offset-0"
                      />
                      {field}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="access-legal-basis" className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Statutory or Lawful Basis</label>
              <input
                id="access-legal-basis"
                aria-label="Statutory or Lawful Basis"
                required
                type="text"
                value={legalBasis}
                onChange={e => setLegalBasis(e.target.value)}
                placeholder="E.g. Section 43 of Public Procurement Act, or Ministry Mandate..."
                className="w-full h-[36px] px-3 bg-[#141414] border border-[#2e2e2e] text-[13px] text-white focus:outline-none focus:border-[#444] rounded-md"
              />
            </div>

            <div>
              <label htmlFor="access-purpose" className="block text-[12px] font-medium text-[#ededed] mb-1.5 font-mono uppercase tracking-wider text-[#8b8b8b]">Purpose & Access Statement</label>
              <textarea
                id="access-purpose"
                aria-label="Purpose & Access Statement"
                required
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Describe why your agency requires access to this dataset and how purpose limitation will be enforced..."
                className="w-full h-20 p-3 bg-[#141414] border border-[#2e2e2e] text-[13px] text-white focus:outline-none focus:border-[#444] rounded-md resize-none"
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-[12px] text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 h-[36px] border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] font-medium rounded-md text-[13px] transition-colors">
                Cancel
              </button>
              <button disabled={status === 'submitting'} type="submit" className="flex-1 h-[36px] bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] transition-colors disabled:opacity-50">
                <span className="inline-flex items-center justify-center gap-2">
                  {status === 'submitting' && <Spinner className="size-4 text-black" />}
                  Submit Request
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
