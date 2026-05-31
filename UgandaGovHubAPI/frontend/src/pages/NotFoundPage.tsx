import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="flex h-full min-h-[calc(100dvh-var(--header-height,48px))] items-center justify-center bg-[#181818] px-5 py-10 text-white">
      <section className="w-full max-w-xl border border-[#2b2b2b] bg-[#1f1f1f] p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-[#3a3a3a] bg-[#242424] text-[#3ecf8e]">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b8b8b]">404</p>
        <h1 className="text-2xl font-semibold tracking-normal text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#b4b4b4]">
          The address does not match an available GovHub workspace page.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-md bg-[#3ecf8e] px-3 text-sm font-medium text-[#111] transition hover:bg-[#58dba0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return home
        </Link>
      </section>
    </main>
  );
}
