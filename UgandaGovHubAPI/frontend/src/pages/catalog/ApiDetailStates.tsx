import { Link } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';

export function ApiDetailErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] p-5 text-left text-[#ededed]">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#8b8b8b] hover:text-white">
        <IconArrowLeft className="size-4" />
        Back to API Catalog
      </Link>
      <div className="mt-6 rounded-lg border border-[#2e2e2e] bg-[#141414] p-8">
        <h1 className="text-xl font-semibold text-white">API details unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-[#8b8b8b]">{message}</p>
      </div>
    </div>
  );
}

export function ApiDetailLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] text-left text-[#ededed]">
      <div className="shrink-0 border-b border-[#2e2e2e] px-3 py-4 lg:px-5">
        <div className="h-4 w-28 animate-pulse rounded bg-[#2e2e2e]" />
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="h-7 w-80 max-w-full animate-pulse rounded bg-[#2e2e2e]" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-[#242424]" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-[#242424]" />
        </div>
        <div className="mt-5 h-4 w-[520px] max-w-full animate-pulse rounded bg-[#242424]" />
        <div className="mt-3 h-3 w-64 max-w-full animate-pulse rounded bg-[#242424]" />
      </div>
      <div className="shrink-0 border-b border-[#2e2e2e] bg-[#141414] px-3 py-3 lg:px-5">
        <div className="h-8 w-[520px] max-w-full animate-pulse rounded bg-[#242424]" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-5 lg:px-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border border-[#2e2e2e] bg-[#1c1c1c]" />
          ))}
        </div>
      </div>
    </div>
  );
}
