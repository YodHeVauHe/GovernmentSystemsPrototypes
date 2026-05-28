import { useMemo, useState } from 'react';
import { buildCodeSamples, type CodeSampleInput } from '@/lib/code-samples';

export function CodeSamples({ input }: { input: CodeSampleInput }) {
  const samples = useMemo(() => buildCodeSamples(input), [input]);
  const [activeLanguage, setActiveLanguage] = useState(samples[0]?.language || 'cURL');
  const activeSample = samples.find(sample => sample.language === activeLanguage) || samples[0];

  if (!activeSample) return null;

  return (
    <div className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-[#2e2e2e] bg-[#1c1c1c] px-4 py-2.5">
        <span className="text-[12px] font-medium text-[#ededed]">Generated Code Samples</span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {samples.map(sample => (
            <button
              key={sample.language}
              type="button"
              onClick={() => setActiveLanguage(sample.language)}
              className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                activeLanguage === sample.language
                  ? 'border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#3ecf8e]'
                  : 'border-transparent text-[#8b8b8b] hover:bg-[#2e2e2e] hover:text-white'
              }`}
            >
              {sample.language}
            </button>
          ))}
        </div>
      </div>
      <pre className="max-h-[320px] min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words bg-[#0a0a0a] p-4 text-left font-mono text-[12px] leading-relaxed text-[#e0e0e0]">
        <code className="block min-w-0 whitespace-pre-wrap break-words">{activeSample.value}</code>
      </pre>
    </div>
  );
}
