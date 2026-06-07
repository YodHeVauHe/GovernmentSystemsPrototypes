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

const toneClasses: Record<LandingTone, { accent: string; badge: string; border: string; marker: string; text: string }> = {
  green: {
    accent: 'bg-[#77e5b2]',
    badge: 'border-[#77e5b2]/25 bg-[#77e5b2]/8 text-[#a7f0cd]',
    border: 'border-[#77e5b2]/20',
    marker: 'bg-[#77e5b2]',
    text: 'text-[#a7f0cd]',
  },
  brand: {
    accent: 'bg-[#3ecf8e]',
    badge: 'border-[#3ecf8e]/25 bg-[#3ecf8e]/8 text-[#77e5b2]',
    border: 'border-[#3ecf8e]/20',
    marker: 'bg-[#3ecf8e]',
    text: 'text-[#77e5b2]',
  },
  amber: {
    accent: 'bg-[#f7d778]',
    badge: 'border-[#f7d778]/25 bg-[#f7d778]/8 text-[#ffe8a3]',
    border: 'border-[#f7d778]/20',
    marker: 'bg-[#f7d778]',
    text: 'text-[#ffe8a3]',
  },
  rose: {
    accent: 'bg-[#fe806a]',
    badge: 'border-[#fe806a]/25 bg-[#fe806a]/8 text-[#ffb4a7]',
    border: 'border-[#fe806a]/20',
    marker: 'bg-[#fe806a]',
    text: 'text-[#ffb4a7]',
  },
};

const ctaStyles = {
  primary:
    'border border-[#f59e0b] bg-[#f59e0b] text-[#111] hover:bg-[#fbbf24] focus-visible:outline-[#f59e0b]',
  secondary:
    'border border-white/12 bg-white/[0.045] text-[#f2f2f2] hover:bg-white/[0.08] focus-visible:outline-[#3ecf8e]',
} as const;

const ctaIcons = [IconUserPlus, IconLogin2, IconDatabase];

const reasonIcons = {
  governance: IconBuildingBank,
  'developer-experience': IconTerminal2,
  'risk-control': IconShieldCheck,
  accountability: IconFileText,
} as const;

export function LandingPage() {
  const featuredSlides = landingPitchDeck.slice(0, 3);

  return (
    <main className="min-h-dvh bg-[#101010] font-sans text-[#ededed]">
      <section className="relative min-h-[92svh] overflow-hidden border-b border-white/10">
        <img
          src="/screenshots/apiCatalog.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.42]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,14,0.98)_0%,rgba(13,15,14,0.88)_42%,rgba(13,15,14,0.52)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(62,207,142,0.18),transparent_34%),radial-gradient(circle_at_18%_82%,rgba(245,158,11,0.12),transparent_30%)]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between border-b border-white/10 px-5 py-3 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]">
            <img src="/favicon.svg" alt="" aria-hidden="true" className="size-8 rounded-md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-5 text-white">Uganda GovHub API</p>
              <p className="truncate text-xs leading-4 text-[#8f8f8f]">Ministry pitch deck prototype</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/docs"
              className="hidden h-8 items-center rounded-md border border-white/10 bg-white/[0.035] px-3 text-sm font-medium text-[#ededed] transition hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] sm:inline-flex"
            >
              Docs
            </Link>
            <Link
              to="/login"
              className="inline-flex h-8 items-center rounded-md border border-white/10 bg-[#ededed] px-3 text-sm font-medium text-[#171717] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 px-5 py-12 lg:grid-cols-[1fr_380px] lg:px-8 lg:py-20">
          <div className="flex min-h-[560px] flex-col justify-between">
            <div>
              <span className="inline-flex h-7 items-center rounded-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/10 px-3 text-sm font-medium text-[#77e5b2]">
                Pitch deck for the demo
              </span>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.04] text-white sm:text-5xl lg:text-6xl">
                Uganda GovHub API
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#c7c7c7] sm:text-lg">
                A working demo that helps the Ministry of ICT and National Guidance show how Uganda's government
                agencies can find, ask for, test, and review API data sharing in one safe place.
              </p>
              <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {landingCtas.map((cta, index) => {
                  const Icon = ctaIcons[index];
                  return (
                    <Link
                      key={cta.href}
                      to={cta.href}
                      title={cta.description}
                      className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${ctaStyles[cta.intent]}`}
                    >
                      <Icon className="size-4" />
                      {cta.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-12 grid max-w-4xl grid-cols-1 border-y border-white/10 sm:grid-cols-3">
              {platformStats.map((stat, index) => (
                <div key={stat.label} className={`py-4 sm:px-5 ${index > 0 ? 'border-t border-white/10 sm:border-l sm:border-t-0' : ''}`}>
                  <p className="text-2xl font-semibold leading-8 text-white">{stat.value}</p>
                  <p className="mt-1 text-sm leading-5 text-[#8f8f8f]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-md border border-white/10 bg-[#161616]/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-sm font-medium text-white">Board review path</p>
              <span className="rounded-sm border border-white/10 px-2 py-0.5 text-xs text-[#8f8f8f]">6 slides</span>
            </div>
            <div className="divide-y divide-white/10">
              {landingPitchDeck.map((slide, index) => {
                const tone = toneClasses[slide.tone];
                return (
                  <a key={slide.id} href={`#${slide.id}`} className="group grid grid-cols-[32px_1fr] gap-3 py-3">
                    <span className="flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-xs font-medium text-[#c7c7c7]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-medium ${tone.text}`}>{slide.eyebrow}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#ededed] group-hover:text-white">{slide.title}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#151515] px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 lg:grid-cols-[280px_1fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-[#3ecf8e]">Why this works</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">Evidence first, then the working demo.</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[#b8b8b8]">
            Leaders can see the reason, the steps, the safety rules, and the first pilot plan in one page, with real
            product screenshots instead of vague promises.
          </p>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#101010] px-5 py-12 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 md:grid-cols-3">
          {featuredSlides.map(slide => {
            const tone = toneClasses[slide.tone];
            return (
              <a key={slide.id} href={`#${slide.id}`} className={`rounded-md border bg-[#161616] p-4 transition hover:bg-[#1c1c1c] ${tone.border}`}>
                <span className={`mb-4 block h-0.5 w-10 rounded-full ${tone.accent}`} />
                <p className={`text-sm font-medium ${tone.text}`}>{slide.eyebrow}</p>
                <h3 className="mt-2 text-lg font-semibold leading-6 text-white">{slide.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#a7a7a7]">{slide.detail}</p>
              </a>
            );
          })}
        </div>
      </section>

      {landingPitchDeck.map((slide, index) => {
        const tone = toneClasses[slide.tone];
        const reverseLayout = index % 2 === 1;
        return (
          <section key={slide.id} id={slide.id} className="border-b border-white/10 bg-[#101010] px-5 py-14 lg:px-8 lg:py-20">
            <div className={`mx-auto grid max-w-[1200px] grid-cols-1 gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start ${reverseLayout ? 'lg:[&>*:first-child]:order-2 lg:grid-cols-[1.14fr_0.86fr]' : ''}`}>
              <div className="lg:sticky lg:top-5">
                <div className={`inline-flex h-7 items-center rounded-md border px-3 text-sm font-medium ${tone.badge}`}>
                  {slide.eyebrow}
                </div>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  {slide.title}
                </h2>
                <p className="mt-4 text-base leading-7 text-[#c7c7c7]">{slide.detail}</p>
                <ul className="mt-6 space-y-3">
                  {slide.points.map(point => (
                    <li key={point} className="grid grid-cols-[10px_1fr] gap-3 text-sm leading-6 text-[#d8d8d8]">
                      <span className={`mt-2.5 size-1.5 rounded-full ${tone.marker}`} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className={`overflow-hidden rounded-md border bg-[#161616] ${tone.border}`}>
                <div className="border-b border-white/10 bg-[#1c1c1c] px-3 py-2">
                  <p className="text-xs font-medium text-[#8f8f8f]">{slide.visual.caption}</p>
                </div>
                <div className="aspect-[16/9] bg-[#101010] p-2 sm:p-3">
                  <img src={slide.visual.src} alt={slide.visual.alt} className="h-full w-full rounded-sm object-contain" />
                </div>
              </figure>
            </div>
          </section>
        );
      })}

      <section className="border-b border-white/10 bg-[#151515] px-5 py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#3ecf8e]">Why it is worth trying</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-white sm:text-4xl">The plan is practical.</h2>
            <p className="mt-4 text-base leading-7 text-[#c7c7c7]">
              GovHub brings the Ministry's role, government review, and agency technical work into one workspace before
              teams make bigger choices about live production systems.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {whyItWorks.map(reason => {
              const Icon = reasonIcons[reason.id];
              return (
                <article key={reason.id} className="rounded-md border border-white/10 bg-[#101010] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#77e5b2]">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="text-base font-semibold leading-6 text-white">{reason.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#a7a7a7]">{reason.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#101010] px-5 py-14 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 border-y border-white/10 py-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-4 flex size-9 items-center justify-center rounded-md border border-[#f7d778]/25 bg-[#f7d778]/10 text-[#ffe8a3]">
              <IconRocket className="size-5" />
            </div>
            <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">Use the demo to decide together.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#c7c7c7]">
              The page starts with the reason for GovHub, then gives the demo audience clear paths to sign up, sign in,
              read docs, and open the protected catalog.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[#3ecf8e] bg-[#3ecf8e] px-3 text-sm font-medium text-[#111] transition hover:bg-[#58dba0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
          >
            Start demo
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
