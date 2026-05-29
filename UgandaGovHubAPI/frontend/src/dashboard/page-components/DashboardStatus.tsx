import { Skeleton } from '@/components/ui/skeleton';

export function DashboardLoadingState() {
  return (
              <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
                <div className="border-b border-[#2e2e2e] bg-[#141414] p-4">
                  <Skeleton className="h-4 w-44 bg-[#2e2e2e]" />
                  <Skeleton className="mt-2 h-3 w-80 max-w-full bg-[#242424]" />
                </div>
                <div className="divide-y divide-[#2e2e2e]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_120px] items-center gap-4 px-4 py-4">
                      <Skeleton className="h-4 w-36 bg-[#242424]" />
                      <Skeleton className="h-4 w-48 bg-[#242424]" />
                      <Skeleton className="h-4 w-28 bg-[#242424]" />
                      <Skeleton className="h-5 w-20 rounded-full bg-[#242424]" />
                      <Skeleton className="ml-auto h-8 w-24 bg-[#242424]" />
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
