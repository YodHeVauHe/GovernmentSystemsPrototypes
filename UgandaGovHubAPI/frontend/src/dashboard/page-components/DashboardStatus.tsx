export function DashboardLoadingState() {
  return (
              <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
                <div className="border-b border-[#2e2e2e] bg-[#141414] p-4">
                  <div className="h-4 w-44 animate-pulse rounded bg-[#2e2e2e]" />
                  <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-[#242424]" />
                </div>
                <div className="divide-y divide-[#2e2e2e]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_120px] items-center gap-4 px-4 py-4">
                      <div className="h-4 w-36 animate-pulse rounded bg-[#242424]" />
                      <div className="h-4 w-48 animate-pulse rounded bg-[#242424]" />
                      <div className="h-4 w-28 animate-pulse rounded bg-[#242424]" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-[#242424]" />
                      <div className="ml-auto h-8 w-24 animate-pulse rounded bg-[#242424]" />
                    </div>
                  ))}
                </div>
              </div>
  );
}

export function DashboardErrorState({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-[13px] text-red-300">
      {error}
    </div>
  );
}
