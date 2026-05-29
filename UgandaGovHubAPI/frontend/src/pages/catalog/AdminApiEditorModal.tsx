import { useState } from 'react';
import { IconDeviceFloppy, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api-base';
import { useNotifications } from '../../context/NotificationContext';

export function AdminApiEditorModal({
  api,
  spec,
  onClose,
  onSaved,
}: {
  api: any;
  spec: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const [form, setForm] = useState({
    name: api.name || '',
    sector: api.sector || '',
    description: api.description || '',
    lifecycle_status: api.lifecycle_status || 'Draft',
    sensitivity_level: api.sensitivity_level || 'Medium',
    compliance_status: api.compliance_status || 'Draft',
    contact_office: api.contact_office || '',
    technical_owner: api.technical_owner || '',
    sla_target: api.sla_target || '',
    docs_visibility: api.docs_visibility || '',
  });
  const [initialSpecText] = useState(() => JSON.stringify(spec, null, 2));
  const [specText, setSpecText] = useState(initialSpecText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/catalog/${api.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(specText !== initialSpecText ? { openapi_spec: specText } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update API');
      }
      addNotification({
        type: 'api',
        title: 'API updated',
        message: `${form.name || api.name} metadata was updated.`,
      });
      toast.success('API updated', {
        description: `${form.name || api.name} was saved successfully.`,
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update API';
      setError(message);
      toast.error('API update failed', {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-left">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e]">
          <div>
            <h2 className="text-[16px] font-medium text-white">Edit API</h2>
            <p className="text-[12px] text-[#8b8b8b] mt-0.5">Update registry metadata and the current OpenAPI document.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 p-6 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Name</label>
              <input value={form.name} onChange={e => updateField('name', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Sector</label>
                <input value={form.sector} onChange={e => updateField('sector', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]" />
              </div>
              <div>
                <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Lifecycle</label>
                <select value={form.lifecycle_status} onChange={e => updateField('lifecycle_status', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]">
                  <option>Draft</option>
                  <option>Beta</option>
                  <option>Production</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Sensitivity</label>
                <select value={form.sensitivity_level} onChange={e => updateField('sensitivity_level', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Compliance</label>
                <select value={form.compliance_status} onChange={e => updateField('compliance_status', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]">
                  <option>Draft</option>
                  <option>Under Review</option>
                  <option>Approved for Sandbox</option>
                  <option>Approved for Production</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => updateField('description', e.target.value)} className="w-full h-24 p-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px] resize-none" />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Contact Office</label>
              <input value={form.contact_office} onChange={e => updateField('contact_office', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Technical Owner</label>
              <input value={form.technical_owner} onChange={e => updateField('technical_owner', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">SLA Target</label>
              <input value={form.sla_target} onChange={e => updateField('sla_target', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">Docs Visibility</label>
              <select value={form.docs_visibility} onChange={e => updateField('docs_visibility', e.target.value)} className="w-full h-9 px-3 rounded-md bg-[#141414] border border-[#2e2e2e] text-white text-[13px]">
                <option value="">Default from classification</option>
                <option value="public">Public</option>
                <option value="authenticated">Approved users</option>
                <option value="restricted">Restricted access groups</option>
              </select>
              <p className="mt-1.5 text-[11px] leading-4 text-[#8b8b8b]">
                Controls whether `/docs/{api.id}` is public, approved-user only, or restricted to privileged access groups.
              </p>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col">
            <label className="block text-[11px] uppercase font-mono text-[#8b8b8b] mb-1.5">OpenAPI Document</label>
            <textarea
              value={specText}
              onChange={e => setSpecText(e.target.value)}
              spellCheck={false}
              className="min-h-[520px] flex-1 rounded-md bg-[#0a0a0a] border border-[#2e2e2e] p-4 font-mono text-[12px] leading-relaxed text-[#ededed] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#2e2e2e]">
          <p className="text-[12px] text-red-400">{error}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="h-9 px-4 border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] rounded-md text-[13px]">
              Cancel
            </button>
            <button disabled={saving} type="submit" className="h-9 px-4 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] flex items-center gap-2 disabled:opacity-50">
              <IconDeviceFloppy className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
