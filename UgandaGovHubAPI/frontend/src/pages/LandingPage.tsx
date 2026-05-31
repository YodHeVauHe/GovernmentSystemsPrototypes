import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconBuildingBank,
  IconDatabase,
  IconFileText,
  IconLogin2,
  IconRocket,
  IconShieldCheck,
  IconTerminal2,
  IconUserPlus,
} from '@tabler/icons-react';
import { landingCtas, landingPitchDeck, platformStats, whyItWorks, type LandingTone } from './landing-content';

const toneClasses: Record<LandingTone, { badge: string; border: string; glow: string; text: string }> = {
  green: {
    badge: 'border-[#3ecf8e]/25 bg-[#3ecf8e]/10 text-[#77e5b2]',
    border: 'border-[#3ecf8e]/25',
    glow: 'shadow-[0_0_40px_rgba(62,207,142,0.16)]',
    text: 'text-[#77e5b2]',
  },
  blue: {
    badge: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
    border: 'border-sky-400/25',
    glow: 'shadow-[0_0_40px_rgba(56,189,248,0.14)]',
    text: 'text-sky-200',
  },
  amber: {
    badge: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    border: 'border-amber-400/25',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.13)]',
    text: 'text-amber-200',
  },
  rose: {
    badge: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    border: 'border-rose-400/25',
    glow: 'shadow-[0_0_40px_rgba(251,113,133,0.12)]',
    text: 'text-rose-200',
  },
};

const ctaStyles = {
  primary:
    'bg-[#f59e0b] text-[#111] hover:bg-[#fbbf24] focus-visible:outline-[#f59e0b]',
  secondary:
    'border border-white/20 bg-black/35 text-white hover:border-[#3ecf8e]/50 hover:bg-[#3ecf8e]/10 focus-visible:outline-[#3ecf8e]',
} as const;

const ctaIcons = [IconUserPlus, IconLogin2, IconDatabase];

const reasonIcons = {
  governance: IconBuildingBank,
  'developer-experience': IconTerminal2,
  'risk-control': IconShieldCheck,
  accountability: IconFileText,
} as const;

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-[#101110] text-white">
      <section className="relative min-h-[88svh] overflow-hidden border-b border-white/10 bg-[#0d0f0e]">
        <img
          src="/screenshots/apiCatalog.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.42]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,14,0.98)_0%,rgba(13,15,14,0.88)_42%,rgba(13,15,14,0.52)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(62,207,142,0.18),transparent_34%),radial-gradient(circle_at_18%_82%,rgba(245,158,11,0.12),transparent_30%)]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3ecf8e]">
            <img src="/favicon.svg" alt="" aria-hidden="true" className="size-9 rounded-md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Uganda GovHub API</p>
              <p className="truncate text-xs text-[#b8b8b8]">Government interoperability prototype</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/docs"
              className="hidden h-9 items-center rounded-md border border-white/15 px-3 text-sm font-medium text-[#ededed] transition hover:border-white/35 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] sm:inline-flex"
            >
              Docs
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-md bg-white px-3 text-sm font-semibold text-[#111] transition hover:bg-[#d8fff0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col px-5 pb-12 pt-16 lg:px-8 lg:pb-16 lg:pt-24">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/10 px-3 py-1 text-sm font-semibold text-[#77e5b2]">
              Pitch deck landing page
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] text-white sm:text-5xl lg:text-6xl">
              Uganda GovHub API
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#d6d6d6]">
              A working interoperability platform for the Ministry of ICT and National Guidance to coordinate governed
              MDA data exchange for the Government of Uganda from catalog to approval, sandbox, and audit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {landingCtas.map((cta, index) => {
                const Icon = ctaIcons[index];
                return (
                  <Link
                    key={cta.href}
                    to={cta.href}
                    title={cta.description}
                    className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${ctaStyles[cta.intent]}`}
                  >
                    <Icon className="size-4" />
                    {cta.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-14 grid max-w-4xl grid-cols-1 border-y border-white/15 sm:grid-cols-3">
            {platformStats.map((stat, index) => (
              <div key={stat.label} className={`py-4 sm:px-5 ${index > 0 ? 'border-t border-white/15 sm:border-l sm:border-t-0' : ''}`}>
                <p className="text-3xl font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-sm leading-5 text-[#b8b8b8]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#151715] px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#77e5b2]">Why this works</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">It sells the operating model, then proves it exists.</h2>
          </div>
            <p className="max-w-2xl text-sm leading-6 text-[#b8b8b8]">
            Ministry and government decision-makers see the policy logic, technical workflow, security controls, and
            pilot path in a single scroll, with screenshots from the product instead of abstract promises.
          </p>
        </div>
      </section>

      {landingPitchDeck.map((slide, index) => {
        const tone = toneClasses[slide.tone];
        const reverseLayout = index % 2 === 1;
        return (
          <section key={slide.id} id={slide.id} className="border-b border-white/10 bg-[#101110] px-5 py-16 lg:px-8 lg:py-24">
            <div className={`mx-auto grid max-w-[1180px] grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center ${reverseLayout ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <span className={`inline-flex rounded-md border px-3 py-1 text-sm font-semibold ${tone.badge}`}>
                  {slide.eyebrow}
                </span>
                <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  {slide.title}
                </h2>
                <p className="mt-5 text-base leading-8 text-[#cfcfcf]">{slide.detail}</p>
                <ul className="mt-7 space-y-3">
                  {slide.points.map(point => (
                    <li key={point} className="flex gap-3 text-sm leading-6 text-[#d8d8d8]">
                      <span className={`mt-2 size-2 shrink-0 rounded-full ${tone.text} bg-current`} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className={`overflow-hidden rounded-md border bg-[#1a1c1a] ${tone.border} ${tone.glow}`}>
                <div className="aspect-[16/9] bg-[#0d0f0e] p-2 sm:p-3">
                  <img src={slide.visual.src} alt={slide.visual.alt} className="h-full w-full object-contain" />
                </div>
                <figcaption className="border-t border-white/10 px-4 py-3 text-sm leading-6 text-[#b8b8b8]">
                  {slide.visual.caption}
                </figcaption>
              </figure>
            </div>
          </section>
        );
      })}

      <section className="border-b border-white/10 bg-[#151715] px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-[1180px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[#77e5b2]">Investment logic</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">The case is practical, not speculative.</h2>
            <p className="mt-4 text-base leading-8 text-[#cfcfcf]">
              GovHub works because it aligns the Ministry mandate, government oversight needs, and MDA technical
              execution in one workspace before higher-risk production integration begins.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {whyItWorks.map(reason => {
              const Icon = reasonIcons[reason.id];
              return (
                <article key={reason.id} className="rounded-md border border-white/10 bg-[#1c1f1c] p-5">
                  <div className="flex size-10 items-center justify-center rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#77e5b2]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{reason.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#b8b8b8]">{reason.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#0d0f0e] px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-5 flex size-12 items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 text-amber-200">
              <IconRocket className="size-6" />
            </div>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Make the demo the decision room.</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#cfcfcf]">
              The landing page now opens with the Ministry and Government of Uganda investment case, then gives the
              demo audience immediate paths into signup, login, documentation, and the protected catalog.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#f59e0b] px-4 text-sm font-semibold text-[#111] transition hover:bg-[#fbbf24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]"
          >
            Start evaluation
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
