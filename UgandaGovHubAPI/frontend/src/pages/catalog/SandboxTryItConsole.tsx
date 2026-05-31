import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconLock, IconPlayerPlay, IconTerminal2 } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { API_BASE } from '@/lib/api-base';
import { redactHeaderMap } from '@/lib/header-redaction';
import { formatHttpStatusLabel, isSuccessStatus } from '@/lib/http-status';
import { generatePublicId } from '@/lib/utils';
import { useUser } from '../../context/UserContext';
import {
  SandboxConsoleBody,
  buildBodyExample,
  coerceParameterValue,
  getSchemaDefault,
  getServerBasePath,
  type SandboxParameterRow,
} from './api-detail-helpers';

export function redactSandboxRequestHeaders(headers: Record<string, string>) {
  return redactHeaderMap(headers);
}

export function SandboxTryItConsole({ api, endpoints, spec }: { api: any, endpoints: any[], spec: any }) {
  const { user, mdaId } = useUser();
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [apiKeyOption, setApiKeyOption] = useState<'custom' | 'none'>('custom');
  const [customApiKey, setCustomApiKey] = useState('');
  const [activeEndpointIdx, setActiveEndpointIdx] = useState<number>(0);
  const [parameters, setParameters] = useState<SandboxParameterRow[]>([]);
  const [bodyText, setBodyText] = useState('');
  const [bodyContentType, setBodyContentType] = useState('application/json');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const activeEp = endpoints[activeEndpointIdx];
  const canSendBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeEp?.method);
  const basePath = useMemo(() => getServerBasePath(spec, api.id), [spec, api.id]);

  // Fetch approved requests to load generated keys
  const fetchApprovedKeys = useCallback(() => {
    fetch(`${API_BASE}/api/access`)
      .then(res => res.json())
      .then(data => {
        // Filter approved for active representing MDA and current API
        const approved = data.filter((r: any) =>
          r.api_id === api.id &&
          (mdaId ? r.consumer_mda_id === mdaId : r.consumer_user_id === user?.id) &&
          r.status === 'APPROVED' &&
          r.api_key_preview &&
          (r.api_key_status || 'ACTIVE') === 'ACTIVE' &&
          !r.api_key_revoked_at &&
          (!r.api_key_expires_at || new Date(r.api_key_expires_at).getTime() > Date.now())
        );
        setApprovedRequests(approved);
      })
      .catch(err => console.error(err));
  }, [api.id, mdaId, user?.id]);

  useEffect(() => {
    fetchApprovedKeys();
    setResponse(null);
  }, [fetchApprovedKeys]);

  useEffect(() => {
    if (!activeEp) return;

    const rows = (activeEp.data.parameters || [])
      .filter((param: any) => {
        const name = param?.name;
        // Filter out null, undefined, empty strings, and strings that are only whitespace
        return name != null && name !== '' && String(name).trim().length > 0;
      })
      .map((param: any) => {
        const name = String(param.name ?? '').trim();
        const value = String(param.example ?? getSchemaDefault(param.schema, name));
        return {
          key: `${param.in}:${name}`,
          name,
          in: param.in,
          required: param.required,
          description: param.description ? String(param.description) : undefined,
          schema: param.schema,
          value,
          enabled: param.required || value !== '',
        } satisfies SandboxParameterRow;
      });

    const bodyExample = buildBodyExample(activeEp.data.requestBody, spec);
    setParameters(rows);
    setBodyContentType(bodyExample.contentType);
    setBodyText(
      typeof bodyExample.value === 'string'
        ? bodyExample.value
        : JSON.stringify(bodyExample.value, null, 2)
    );
    setResponse(null);
  }, [activeEndpointIdx, activeEp, spec]);

  const updateParameter = (key: string, patch: Partial<SandboxParameterRow>) => {
    setParameters(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
  };

  // Stable correlation ID base (doesn't change on re-render)
  const correlationIdBase = useRef(generatePublicId('tx_client'));

  // Resolve current API key value for request headers.
  const resolvedKey = useMemo(() => {
    return apiKeyOption === 'custom' ? customApiKey.trim() : '';
  }, [apiKeyOption, customApiKey]);
  const canSendRequest = Boolean(activeEp) && (apiKeyOption === 'none' || resolvedKey.length > 0);

  // Auto-generated default headers for the sandbox request builder.
  const autoHeaders = useMemo((): SandboxParameterRow[] => {
    const rows: SandboxParameterRow[] = [
      {
        key: '__auto:correlation-id',
        name: 'X-Correlation-ID',
        in: 'header',
        required: true,
        description: 'Auto-generated correlation ID',
        value: correlationIdBase.current,
        enabled: true,
      },
    ];
    if (canSendBody) {
      rows.push({
        key: '__auto:content-type',
        name: 'Content-Type',
        in: 'header',
        required: true,
        description: 'Request body content type',
        value: bodyContentType,
        enabled: true,
      });
    }
    if (resolvedKey) {
      rows.push({
        key: '__auto:govhub-api-key',
        name: 'X-GovHub-API-Key',
        in: 'header',
        required: apiKeyOption !== 'none',
        description: 'Sandbox authentication key',
        value: resolvedKey,
        enabled: true,
      });
    }
    return rows;
  }, [canSendBody, bodyContentType, resolvedKey, apiKeyOption]);

  const parameterGroups = useMemo(() => ({
    path: parameters.filter(param => param.in === 'path'),
    query: parameters.filter(param => param.in === 'query'),
    header: parameters.filter(param => param.in === 'header'),
    cookie: parameters.filter(param => param.in === 'cookie'),
  }), [parameters]);

  const applySampleValues = (updates: Record<string, string>) => {
    setParameters(prev => prev.map(row => updates[row.name] !== undefined ? {
      ...row,
      value: updates[row.name],
      enabled: true,
    } : row));

    setBodyText(prev => {
      if (!prev.trim()) return prev;
      try {
        const parsed = JSON.parse(prev);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return prev;
        return JSON.stringify({ ...parsed, ...updates }, null, 2);
      } catch {
        return prev;
      }
    });
  };

  const buildTargetUrl = () => {
    let requestPath = activeEp.path;
    parameterGroups.path.forEach(param => {
      requestPath = requestPath.replace(
        `{${param.name}}`,
        encodeURIComponent(param.value)
      );
    });

    const url = new URL(`${basePath}${requestPath}`, API_BASE);
    parameterGroups.query
      .filter(param => param.enabled && param.value !== '')
      .forEach(param => url.searchParams.set(param.name, param.value));

    return url.toString();
  };

  const targetUrl = activeEp ? buildTargetUrl() : '';

  const handleSend = () => {
    if (!activeEp) return;

    setLoading(true);
    setResponse(null);

    // Resolve API Key
    const key = apiKeyOption === 'none' ? '' : resolvedKey;

    const correlationId = generatePublicId('tx_client');

    let requestBody: BodyInit | undefined;
    if (canSendBody && bodyText.trim()) {
      if (bodyContentType.includes('json')) {
        try {
          requestBody = JSON.stringify(JSON.parse(bodyText));
        } catch (err: any) {
          setLoading(false);
          setResponse({
            status: 0,
            statusText: 'Invalid Request Body',
            body: { error: err.message }
          });
          return;
        }
      } else {
        requestBody = bodyText;
      }
    }

    const headers: Record<string, string> = {
      'X-Correlation-ID': correlationId
    };

    if (bodyText.trim() && canSendBody) headers['Content-Type'] = bodyContentType;
    if (key) headers['X-GovHub-API-Key'] = key;
    parameterGroups.header
      .filter(param => param.enabled && param.value !== '')
      .forEach(param => {
        headers[param.name] = String(coerceParameterValue(param.value, param.schema));
      });

    const cookieHeader = parameterGroups.cookie
      .filter(param => param.enabled && param.value !== '')
      .map(param => `${param.name}=${param.value}`)
      .join('; ');
    if (cookieHeader) headers.Cookie = cookieHeader;

    const sentHeaders = { ...headers };

    fetch(targetUrl, {
      method: activeEp.method,
      headers,
      body: requestBody
    })
    .then(async (res) => {
      const status = res.status;
      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, name) => {
        headersObj[name] = val;
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      setResponse({
        status,
        statusText: res.statusText,
        headers: redactHeaderMap(headersObj),
        requestHeaders: redactSandboxRequestHeaders(sentHeaders),
        body: data
      });
    })
    .catch(err => {
      setResponse({
        status: 0,
        statusText: 'Network Connection Failed',
        body: { error: err.message }
      });
    })
    .finally(() => setLoading(false));
  };

  // Helper selectors for quick seeding/presenting in sandbox
  const loadProfile = (profile: string) => {
    if (profile === 'valid-nira') {
      applySampleValues({ nin: 'CM99021234567X', given_name: 'JOHN', surname: 'DOE' });
    } else if (profile === 'invalid-nira') {
      applySampleValues({ nin: 'CM00000000000X' });
    } else if (profile === 'expired-nira') {
      applySampleValues({ nin: 'CM99021234567E' });
    } else if (profile === 'compliant-ura') {
      applySampleValues({ tin: '1000123456' });
    } else if (profile === 'noncompliant-ura') {
      applySampleValues({ tin: '9999999999' });
    } else if (profile === 'valid-permit') {
      applySampleValues({ permitNumber: 'WP30219', permit_number: 'WP30219' });
    } else if (profile === 'suspended-permit') {
      applySampleValues({ permitNumber: 'WP30219susp', permit_number: 'WP30219susp' });
    }
  };

  const renderParameterSection = (title: string, rows: SandboxParameterRow[], autoRows?: SandboxParameterRow[]) => {
    if (!rows.length && !autoRows?.length) return null;
    const allRows = [...(autoRows ?? []), ...rows];
    return (
      <div className="rounded-md border border-[#2e2e2e] overflow-hidden">
        <div className="grid grid-cols-[32px_minmax(0,1fr)] sm:grid-cols-[32px_minmax(0,1.05fr)_minmax(180px,1.15fr)] bg-[#1c1c1c] border-b border-[#2e2e2e] text-[10px] uppercase tracking-wider font-mono text-[#8b8b8b]">
          <div className="px-2 py-2">On</div>
          <div className="px-3 py-2 border-l border-[#2e2e2e] truncate">{title}</div>
          <div className="hidden sm:block px-3 py-2 border-l border-[#2e2e2e]">Value</div>
        </div>
        {allRows.map(row => {
          const isAuto = row.key.startsWith('__auto:');
          return (
          <div key={row.key} className={`grid grid-cols-[32px_minmax(0,1fr)] sm:grid-cols-[32px_minmax(0,1.05fr)_minmax(180px,1.15fr)] border-b border-[#2e2e2e] last:border-b-0 ${isAuto ? 'bg-[#1a1a1a]' : 'bg-[#141414]'}`}>
            <div className="px-2 py-2 flex items-center justify-center">
              {isAuto ? (
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  className="rounded border-[#2e2e2e] bg-[#1c1c1c] text-[#3ecf8e] opacity-70 focus:ring-0 focus:ring-offset-0"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={row.required}
                  onChange={e => updateParameter(row.key, { enabled: e.target.checked })}
                  className="rounded border-[#2e2e2e] bg-[#1c1c1c] text-[#3ecf8e] focus:ring-0 focus:ring-offset-0"
                />
              )}
            </div>
            <div className="px-3 py-2 border-l border-[#2e2e2e] min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`min-w-0 max-w-full font-mono text-[11px] sm:text-[12px] truncate ${isAuto ? 'text-[#3ecf8e]/80' : 'text-white'}`} title={row.name}>{row.name}</span>
                {row.required && <span className="shrink-0 rounded border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-300">Required</span>}
              </div>
              {row.description && !isAuto && (
                <div className="mt-0.5 text-[10px] text-[#8b8b8b] truncate" title={row.description}>
                  {row.description}
                </div>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1 px-2 pb-2 sm:py-2 sm:border-l sm:border-[#2e2e2e]">
              {isAuto ? (
                <div className="w-full min-h-[30px] px-2 py-1.5 flex items-center bg-[#0a0a0a]/50 border border-[#2e2e2e]/50 text-[12px] text-[#8b8b8b] font-mono rounded-md break-all leading-5">
                  {row.value}
                </div>
              ) : (
                <input
                  type={row.schema?.type === 'number' || row.schema?.type === 'integer' ? 'number' : 'text'}
                  value={row.value}
                  onChange={e => updateParameter(row.key, { value: e.target.value, enabled: true })}
                  className="w-full h-[30px] px-2 bg-[#0a0a0a] border border-[#2e2e2e] text-[12px] text-white font-mono rounded-md focus:outline-none focus:border-[#444]"
                />
              )}
            </div>
          </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start text-left w-full">
      {/* Controls Column */}
      <div className="flex-1 w-full lg:basis-1/2 lg:min-w-0 flex flex-col gap-6">
        {/* Compact Authentication */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 rounded-lg border border-[#2e2e2e] bg-[#141414] shadow-md">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2e2e2e] bg-[#1c1c1c]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b] flex items-center gap-1.5">
                <IconLock className="w-4 h-4 text-[#3ecf8e]" />
                Authentication
              </span>
            </div>
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-3">
              <select
                value={apiKeyOption}
                onChange={e => setApiKeyOption(e.target.value as any)}
                className="h-[30px] px-2 bg-[#1c1c1c] border border-[#2e2e2e] text-[12px] text-white rounded-md focus:outline-none focus:border-[#444]"
              >
                <option value="custom">Custom Key</option>
                <option value="none">No Key (Anonymous)</option>
              </select>
              {apiKeyOption === 'custom' && (
                <input
                  type="text"
                  value={customApiKey}
                  onChange={e => setCustomApiKey(e.target.value)}
                  placeholder="Enter API key..."
                  className="flex-1 min-w-[120px] h-[30px] px-2 bg-[#0a0a0a] border border-[#2e2e2e] text-[12px] text-white font-mono rounded-md focus:outline-none focus:border-[#444]"
                />
              )}
              {approvedRequests.length > 0 ? (
                <span className="text-[11px] text-[#3ecf8e] font-mono truncate max-w-[260px]">
                  {`${approvedRequests[0].api_key_preview} approved. Paste the full key to call.`}
                </span>
              ) : (
                <span className="text-[11px] text-orange-400">No active approved key record</span>
              )}
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !canSendRequest}
            className="h-[32px] w-full shrink-0 sm:w-auto sm:min-w-[128px] px-3 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-black font-semibold rounded-md text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? <Spinner className="h-3.5 w-3.5 text-black" /> : <IconPlayerPlay className="w-3.5 h-3.5 fill-black" />}
            Send Request
          </button>
        </div>

        {/* Target Endpoint */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-mono uppercase tracking-wider text-[#8b8b8b]">Target Endpoint</label>
          <div className="flex flex-col gap-2 border border-[#2e2e2e] rounded-lg overflow-hidden bg-[#1c1c1c]">
            {endpoints.map((ep, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveEndpointIdx(idx);
                  setResponse(null);
                }}
                className={`p-3 text-left flex items-center gap-3 transition-colors ${
                  activeEndpointIdx === idx ? 'bg-[#222] border-l-2 border-[#3ecf8e]' : 'hover:bg-[#2e2e2e]/30'
                }`}
              >
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded
                  ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-[#3ecf8e]'}`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-[13.5px] text-[#ededed]">{ep.path}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input Form Section */}
        {activeEp && (
          <div className="p-5 rounded-lg border border-[#2e2e2e] bg-[#141414] shadow-md flex flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-[#2e2e2e] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-[13px] font-mono uppercase tracking-wider text-[#8b8b8b]">Request Parameters</h4>

              {/* Presets dropdown for presentation ease */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[#8b8b8b] shrink-0">Presets:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {api.id === 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6' && (
                    <>
                      <button onClick={() => loadProfile('valid-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Valid</button>
                      <button onClick={() => loadProfile('invalid-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">No Match</button>
                      <button onClick={() => loadProfile('expired-nira')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Expired</button>
                    </>
                  )}
                  {api.id === 'api-ura-13897843-012d-4951-8b06-374fff183c3e' && (
                    <>
                      <button onClick={() => loadProfile('compliant-ura')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Compliant</button>
                      <button onClick={() => loadProfile('noncompliant-ura')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Non-Comp</button>
                    </>
                  )}
                  {api.id === 'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7' && (
                    <>
                      <button onClick={() => loadProfile('valid-permit')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Valid</button>
                      <button onClick={() => loadProfile('suspended-permit')} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Suspended</button>
                    </>
                  )}
                  {api.id === 'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac' && (
                    <>
                      <button onClick={() => applySampleValues({ nin: 'CM99021234567X', tin: '1000123456', permit_number: 'WP30219' })} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Eligible</button>
                      <button onClick={() => applySampleValues({ nin: 'CM00000000000X', tin: '1000123456', permit_number: 'WP30219' })} className="px-2 py-0.5 bg-[#2e2e2e] hover:bg-[#333] border border-[#444] rounded text-[11px] text-white">Ineligible</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs based on Path */}
            <div className="flex flex-col gap-4">
              {renderParameterSection('Variables', parameterGroups.path)}
              {renderParameterSection('Cookies', parameterGroups.cookie)}
              {renderParameterSection('Headers', parameterGroups.header, autoHeaders)}
              {renderParameterSection('Query Parameters', parameterGroups.query)}

              {canSendBody && activeEp.data.requestBody && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-mono text-[#8b8b8b]">Request Body</label>
                    <select
                      value={bodyContentType}
                      onChange={e => setBodyContentType(e.target.value)}
                      className="h-[28px] px-2 bg-[#1c1c1c] border border-[#2e2e2e] text-[12px] text-white rounded-md focus:outline-none focus:border-[#444]"
                    >
                      {Object.keys(activeEp.data.requestBody.content || { 'application/json': {} }).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[170px] p-3 bg-[#0a0a0a] border border-[#2e2e2e] text-[12.5px] text-white font-mono rounded-md focus:outline-none focus:border-[#444] resize-y"
                  />
                </div>
              )}

              <div>
                <label className="block text-[12px] font-mono text-[#8b8b8b] mb-1">Request URL</label>
                <div className="px-3 py-2 bg-[#0a0a0a] border border-[#2e2e2e] rounded-md text-[12px] text-[#3ecf8e] font-mono break-all">
                  {targetUrl}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Response Column */}
      <div className="w-full lg:basis-1/2 lg:min-w-0 flex flex-col gap-4 lg:sticky lg:top-0">
        <div className="rounded-lg border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2e2e2e] bg-[#1c1c1c]">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-white">
              <IconTerminal2 className="w-3.5 h-3.5 text-[#3ecf8e]" />
              Sandbox Response Console
            </span>
            {response && (
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded
                ${isSuccessStatus(response.status) ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                STATUS: {formatHttpStatusLabel(response.status, response.statusText)}
              </span>
            )}
          </div>

          <div className="p-4 bg-[#0a0a0a] flex-1 font-mono text-[13px] overflow-auto max-h-[calc(100dvh-210px)] flex flex-col">
            {loading ? (
              <div className="m-auto flex w-full max-w-md flex-col gap-4">
                <div className="flex items-center justify-center">
                  <Spinner className="size-8 text-[#3ecf8e]" />
                </div>
                <div className="space-y-2 rounded-md border border-[#2e2e2e] p-3">
                  <Skeleton className="h-3 w-32 bg-[#242424]" />
                  <Skeleton className="h-8 w-full bg-[#141414]" />
                  <Skeleton className="h-8 w-5/6 bg-[#141414]" />
                </div>
                <div className="space-y-2 rounded-md border border-[#2e2e2e] p-3">
                  <Skeleton className="h-3 w-36 bg-[#242424]" />
                  <Skeleton className="h-24 w-full bg-[#141414]" />
                </div>
              </div>
            ) : response ? (
              <div className="flex flex-col gap-4 text-left">
                {/* Request Headers Display */}
                {response.requestHeaders && Object.keys(response.requestHeaders).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1.5">Request Headers</div>
                    <div className="w-full border border-[#2e2e2e] rounded-md overflow-hidden">
                      {Object.entries(response.requestHeaders).map(([key, val], idx) => (
                        <div key={key} className={`grid grid-cols-[minmax(180px,0.9fr)_minmax(0,2fr)] ${idx > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
                          <div className="min-w-0 px-3 py-1.5 text-[11px] font-mono text-[#3ecf8e] bg-[#1c1c1c] border-r border-[#2e2e2e] break-words">{key}</div>
                          <div className="min-w-0 px-3 py-1.5 text-[11px] font-mono text-gray-300 bg-[#0a0a0a] break-words">{val as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1">
                    <span className="text-[11px]">Request Headers</span>
                    <span className="text-[11px] text-[#555] ml-2">No headers</span>
                  </div>
                )}
                {/* Response Headers Display */}
                {Object.keys(response.headers || {}).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1.5">Response Headers</div>
                    <div className="w-full border border-[#2e2e2e] rounded-md overflow-hidden max-h-[240px] overflow-y-auto overflow-x-hidden">
                      {Object.entries(response.headers).map(([key, val], idx) => (
                        <div key={key} className={`grid grid-cols-[minmax(180px,0.9fr)_minmax(0,2fr)] ${idx > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
                          <div className="min-w-0 px-3 py-1.5 text-[11px] font-mono text-[#3ecf8e] bg-[#1c1c1c] border-r border-[#2e2e2e] break-words">{key}</div>
                          <div className="min-w-0 px-3 py-1.5 text-[11px] font-mono text-gray-300 bg-[#0a0a0a] break-words">{val as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1">
                    <span className="text-[11px]">Response Headers</span>
                    <span className="text-[11px] text-[#555] ml-2">No headers</span>
                  </div>
                )}
                {/* Body Display */}
                <div>
                  <div className="text-[10px] text-[#8b8b8b] uppercase tracking-wider font-semibold mb-1">Body</div>
                  <SandboxConsoleBody body={response.body} status={response.status} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center m-auto text-[#8b8b8b] text-[13px] max-w-[280px]">
                <IconTerminal2 className="w-7 h-7 mb-2 text-[#3ecf8e]" />
                <span className="text-center">Select your sandbox credentials, fill parameters, and trigger execution to view results.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
