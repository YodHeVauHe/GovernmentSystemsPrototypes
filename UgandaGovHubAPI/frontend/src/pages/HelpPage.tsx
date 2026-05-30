import { Link } from 'react-router-dom';
import {
  IconBook2,
  IconChevronRight,
  IconHelp,
  IconMail,
  IconShieldCheck,
} from '@tabler/icons-react';

const supportChannels = [
  {
    title: 'Platform support',
    description: 'Report sign-in, account approval, API access, and sandbox issues to the GovHub operations desk.',
    action: 'Email support',
    href: 'mailto:support@govhub.go.ug?subject=Uganda%20GovHub%20API%20support',
    icon: IconMail,
  },
  {
    title: 'API documentation',
    description: 'Review API contracts, access requirements, request examples, response schemas, and security notes.',
    action: 'Open docs',
    href: '/docs',
    icon: IconBook2,
  },
  {
    title: 'Access groups',
    description: 'Check your assigned privileges, account status, verification documents, and requested MDA role.',
    action: 'View access',
    href: '/account/settings?tab=privileges',
    icon: IconShieldCheck,
  },
];

function HelpAction({ channel }: { channel: (typeof supportChannels)[number] }) {
  const Icon = channel.icon;
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2e2e2e] bg-[#141414] text-[#3ecf8e]">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-white">{channel.title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#a7a7a7]">{channel.description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#3ecf8e]">
          {channel.action}
          <IconChevronRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </>
  );

  const className = 'flex min-h-[178px] gap-4 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5 transition hover:border-[#3ecf8e]/35 hover:bg-[#202020]';

  if (channel.href.startsWith('mailto:')) {
    return (
      <a href={channel.href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={channel.href} className={className}>
      {content}
    </Link>
  );
}

export function HelpPage() {
  return (
    <main className="h-full overflow-auto bg-[#181818] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-b border-[#2e2e2e] pb-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-[#2e2e2e] bg-[#1f1f1f] text-[#3ecf8e]">
            <IconHelp className="size-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b8b8b]">Support</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">Get help</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b4b4b4]">
            Use these support paths for GovHub portal access, API documentation, sandbox credentials, and access-group questions.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="Help options">
          {supportChannels.map(channel => (
            <HelpAction key={channel.title} channel={channel} />
          ))}
        </section>

        <section className="rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Before contacting support</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a7a7a7]">
                Include your organization, the API or request ID involved, the page where the issue happened, and the approximate time of the attempt.
              </p>
            </div>
            <Link
              to="/account/settings"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-[#2e2e2e] bg-[#141414] px-3 text-sm font-medium text-[#e8e8e8] transition hover:border-[#3ecf8e]/35 hover:text-[#3ecf8e]"
            >
              Account settings
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
