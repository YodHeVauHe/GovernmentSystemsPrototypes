import { useState } from 'react';
import { CodeSamples } from '@/components/CodeSamples';
import { isSuccessStatus } from '@/lib/http-status';
import {
  bodyFields,
  buildBodyExample,
  buildSampleUrl,
  endpointParameters,
  responseExample,
} from './api-detail-helpers';

export function EndpointBlock({ ep, spec, apiId }: { ep: any, spec: any, apiId: string }) {
  const responseCodes = Object.keys(ep.data.responses || {});
  const [activeTab, setActiveTab] = useState<string>(responseCodes[0] || '');

  const activeResponse = ep.data.responses?.[activeTab];
  const activeExample = responseExample(activeResponse, spec, ep, activeTab);
  const activeResponseIsSuccess = isSuccessStatus(activeTab);
  const requestBodyExample = buildBodyExample(ep.data.requestBody, spec).value;
  const sampleUrl = buildSampleUrl(spec, apiId, ep.path);
  const parameters = endpointParameters(ep);
  const requestFields = bodyFields(ep.data.requestBody, spec);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Left Column: Docs & Params */}
      <div className="flex-1 w-full lg:w-1/2">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[13px] font-mono font-bold px-2 py-0.5 rounded
            ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              ep.method === 'POST' ? 'bg-green-500/10 text-[#3ecf8e] border border-green-500/20' :
              'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
            {ep.method}
          </span>
          <span className="font-mono text-[15px] text-[#ededed]">{ep.path}</span>
        </div>

        <p className="text-[14px] text-[#8b8b8b] mb-8 leading-relaxed">
          {ep.data.summary || ep.data.description}
        </p>

        {/* Parameters */}
        {parameters.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[13px] font-medium text-[#ededed] mb-3 flex items-center gap-2">
              Parameters
            </h3>
            <div className="min-w-0 overflow-hidden rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c]">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_96px] gap-3 border-b border-[#2e2e2e] bg-[#141414] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#8b8b8b] max-sm:grid-cols-1 max-sm:gap-1">
                <span className="min-w-0 break-words">Name</span>
                <span className="min-w-0 break-words">In</span>
                <span className="min-w-0 break-words">Type</span>
              </div>
              {parameters.map((param: any, pIdx: number) => (
                <div key={pIdx} className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_96px] gap-3 border-b border-[#2e2e2e] px-4 py-3 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 break-all font-mono text-[13px] text-[#ededed]">{param.name}</span>
                      {param.required && <span className="shrink-0 text-[10px] font-medium text-red-400">Required</span>}
                    </div>
                    {param.description && (
                      <p className="mt-1 max-w-full whitespace-normal break-words text-[12px] leading-relaxed text-[#8b8b8b]">
                        {param.description}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 break-words text-[13px] text-[#8b8b8b] max-sm:flex max-sm:gap-2">
                    <span className="hidden text-[11px] uppercase tracking-wider text-[#666] max-sm:inline">In</span>
                    {param.in}
                  </div>
                  <div className="min-w-0 break-all font-mono text-[13px] text-[#8b8b8b] max-sm:flex max-sm:gap-2">
                    <span className="hidden font-sans text-[11px] uppercase tracking-wider text-[#666] max-sm:inline">Type</span>
                    {param.schema?.type || 'string'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {requestFields.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[13px] font-medium text-[#ededed] mb-3 flex items-center gap-2">
              Request Body Fields
            </h3>
            <div className="min-w-0 overflow-hidden rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c]">
              <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 border-b border-[#2e2e2e] bg-[#141414] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#8b8b8b] max-sm:grid-cols-1 max-sm:gap-1">
                <span className="min-w-0 break-words">Name</span>
                <span className="min-w-0 break-words">Type</span>
              </div>
              {requestFields.map((field: any) => (
                <div key={field.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-3 border-b border-[#2e2e2e] px-4 py-3 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 break-all font-mono text-[13px] text-[#ededed]">{field.name}</span>
                      {field.required && <span className="shrink-0 text-[10px] font-medium text-red-400">Required</span>}
                    </div>
                    {field.description && (
                      <p className="mt-1 max-w-full whitespace-normal break-words text-[12px] leading-relaxed text-[#8b8b8b]">
                        {field.description}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 break-all font-mono text-[13px] text-[#8b8b8b] max-sm:flex max-sm:gap-2">
                    <span className="hidden font-sans text-[11px] uppercase tracking-wider text-[#666] max-sm:inline">Type</span>
                    {field.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Code & Responses */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col gap-4 flex-shrink-0 sticky top-6">
        <CodeSamples
          input={{
            method: ep.method,
            url: sampleUrl,
            body: ep.data.requestBody ? requestBodyExample : undefined,
          }}
        />

        {/* Responses Box */}
        {ep.data.responses && responseCodes.length > 0 && (
          <div className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg">
            <div className="flex items-center px-2 py-2 border-b border-[#2e2e2e] bg-[#1c1c1c] overflow-x-auto hide-scrollbar gap-1">
              <span className="text-[12px] font-medium text-[#8b8b8b] px-2 mr-2">Responses</span>
              {responseCodes.map((code) => {
                const isActive = code === activeTab;
                return (
                  <button
                    key={code}
                    onClick={() => setActiveTab(code)}
                    className={`px-3 py-1 text-[12px] font-mono rounded-[4px] border transition-colors ${
                      isActive
                        ? 'bg-[#2e2e2e] text-[#ededed] border-[#444]'
                        : 'border-transparent text-[#8b8b8b] hover:bg-[#222]'
                    }`}
                  >
                    <span className={`mr-1.5 ${isSuccessStatus(code) ? 'text-[#3ecf8e]' : 'text-red-400'}`}>●</span>
                    {code}
                  </button>
                );
              })}
            </div>

            {/* Active Response Body */}
            {activeResponse && (
              <div className="flex flex-col text-left">
                <div className="px-4 py-3 bg-[#0a0a0a]">
                  <p className="text-[12.5px] text-[#8b8b8b] mb-3">{activeResponse.description}</p>
                  {activeExample !== null ? (
                    <pre className={`min-w-0 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed overflow-x-hidden ${activeResponseIsSuccess ? 'text-[#3ecf8e]' : 'text-red-400'}`}>
                      {JSON.stringify(activeExample, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[12px] font-mono text-[#444] italic">No content body</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
