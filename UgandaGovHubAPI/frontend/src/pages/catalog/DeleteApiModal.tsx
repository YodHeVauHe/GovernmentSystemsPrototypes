import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconTrash, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { API_BASE } from '@/lib/api-base';
import { useNotifications } from '../../context/NotificationContext';

export function DeleteApiModal({ api, onClose }: { api: any; onClose: () => void }) {
  const { addNotification } = useNotifications();
  const [status, setStatus] = useState<'confirming' | 'deleting' | 'success'>('confirming');
  const [error, setError] = useState('');

  const deleteApi = async () => {
    setStatus('deleting');
    setError('');

    try {
    const response = await fetch(`${API_BASE}/api/catalog/${api.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete API');
      }
      addNotification({
        type: 'api',
        title: 'API deleted',
        message: `${api.name} was removed from the API catalog.`,
      });
      toast.success('API deleted', {
        description: `${api.name} was removed from the catalog.`,
      });
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete API';
      setStatus('confirming');
      setError(message);
      toast.error('API delete failed', {
        description: message,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e]">
          <div>
            <h2 className="text-[16px] font-medium text-white">Delete API</h2>
            <p className="text-[12px] text-[#8b8b8b] mt-0.5">This action removes the registry entry and access requests.</p>
          </div>
          {status !== 'success' && (
            <button onClick={onClose} className="text-[#8b8b8b] hover:text-white transition-colors">
              <IconX className="w-5 h-5" />
            </button>
          )}
        </div>

        {status === 'success' ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-500/20 text-[#3ecf8e] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-[16px] font-medium text-white mb-2">API Deleted</h3>
            <p className="text-[14px] text-[#8b8b8b] mb-6">
              <span className="text-white font-medium">{api.name}</span> has been removed from the GovHub API catalog.
            </p>
            <Link to="/" className="flex w-full h-[36px] items-center justify-center bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-medium rounded-md text-[13px] transition-all">
              Done
            </Link>
          </div>
        ) : (
          <div className="p-6 text-left">
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-red-500/10 p-2 text-red-300">
                  <IconTrash className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-white">{api.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#8b8b8b]">
                    Deleting this API also removes its versions and access requests. Audit logs remain for governance history.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-950/20 p-3 text-[12px] text-red-400">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-5">
              <button type="button" onClick={onClose} className="flex-1 h-[36px] border border-[#2e2e2e] hover:bg-[#2e2e2e] text-[#ededed] font-medium rounded-md text-[13px] transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={status === 'deleting'}
                onClick={deleteApi}
                className="flex-1 h-[36px] bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-200 font-medium rounded-md text-[13px] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {status === 'deleting' && <Spinner className="size-4" />}
                Delete API
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
