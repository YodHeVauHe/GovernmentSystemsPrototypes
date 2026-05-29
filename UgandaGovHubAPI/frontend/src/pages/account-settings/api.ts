import { API_BASE } from '@/lib/api-base';

export async function accountRequest<TBody = Record<string, unknown>>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Account request failed.');
  return body as TBody;
}
