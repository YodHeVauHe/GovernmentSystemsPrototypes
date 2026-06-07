export type LandingTone = 'green' | 'brand' | 'amber' | 'rose';

export type LandingSlide = {
  id: 'problem' | 'solution' | 'why-now' | 'proof' | 'trust-model' | 'pilot-path';
  eyebrow: string;
  title: string;
  detail: string;
  points: string[];
  tone: LandingTone;
  visual: {
    src: string;
    alt: string;
    caption: string;
  };
};

export const platformStats = [
  { value: '5', label: 'kinds of test API services to try' },
  { value: '6', label: 'checks before data can be shared' },
  { value: '1', label: 'place to find, ask, test, and review APIs' },
] as const;

export const landingCtas = [
  {
    label: 'Ask for demo access',
    href: '/signup',
    intent: 'primary',
    description: 'Create a test account for trying the demo.',
  },
  {
    label: 'Sign in',
    href: '/login',
    intent: 'secondary',
    description: 'Go back to your GovHub workspace.',
  },
  {
    label: 'See the catalog',
    href: '/catalog',
    intent: 'secondary',
    description: 'Look at the API list after you are approved.',
  },
] as const;

export const landingPitchDeck: LandingSlide[] = [
  {
    id: 'problem',
    eyebrow: '01 Problem',
    title: 'Government data requests are still too manual, duplicated, and hard to audit.',
    detail:
      'Agencies often need the same identity, tax, business, permit, and eligibility facts, but those checks are handled through separate request paths. That slows service delivery, makes citizens repeat paperwork, and leaves leaders without one clear trail of who accessed data and why.',
    points: [
      'Citizens submit the same supporting documents to multiple offices.',
      'Officers reconfirm facts that another approved government system already holds.',
      'Access decisions and API usage are difficult to review when records sit in separate places.',
    ],
    tone: 'amber',
    visual: {
      src: '/screenshots/apiAccessMatrix.png',
      alt: 'Chart showing safe data-sharing paths between government agencies',
      caption: 'This view shows which agencies already have safe sharing paths and which ones still need review.',
    },
  },
  {
    id: 'solution',
    eyebrow: '02 Solution',
    title: 'GovHub is one safe place for government API sharing.',
    detail:
      'GovHub helps the Ministry of ICT and National Guidance guide how agencies share data. Each agency can list its APIs, explain how they work, approve the right people, give test keys, and check what happened afterward.',
    points: [
      'A searchable catalog shows which government APIs are available.',
      'Simple API docs explain what each service needs and returns.',
      'Each request records the purpose, the law, the fields needed, and how much it will be used.',
    ],
    tone: 'green',
    visual: {
      src: '/screenshots/apiCatalog.png',
      alt: 'API catalog showing government services by agency and sector',
      caption: 'The catalog shows who owns each API, what it is for, how sensitive it is, and whether it is ready.',
    },
  },
  {
    id: 'why-now',
    eyebrow: '03 Why now',
    title: 'The Ministry can try the idea before using real citizen records.',
    detail:
      'GovHub can run with test data, sample agencies, and real-looking approval steps. That lets the Ministry and other government teams see how the system works before connecting it to live government systems.',
    points: [
      'The sandbox shows how an API call works without showing real citizen data.',
      'API owners can check descriptions and documents early.',
      'Decision-makers can review the safety rules and records before rollout.',
    ],
    tone: 'brand',
    visual: {
      src: '/screenshots/apiDocs.png',
      alt: 'API documentation page with examples and safety notes',
      caption: 'The docs show examples, safety notes, and answers developers can use when they build.',
    },
  },
  {
    id: 'proof',
    eyebrow: '04 Proof',
    title: 'This is already a working demo, not just a drawing.',
    detail:
      'The current demo includes the catalog, API pages, documents, sandbox calls, approval steps, account checks, API registration, dashboards, and audit views. The Ministry can click through the product and see proof instead of only hearing a promise.',
    points: [
      'Sandbox calls show success and error examples with tracking details.',
      'Administrators can review accounts and access requests that are waiting.',
      'API owners can add new API documents and details for review.',
    ],
    tone: 'green',
    visual: {
      src: '/screenshots/apiSandbox.png',
      alt: 'Sandbox console showing a test API request and response',
      caption: 'The sandbox lets teams practice API use before they touch real government systems.',
    },
  },
  {
    id: 'trust-model',
    eyebrow: '05 Trust model',
    title: 'Protected data is shared only after clear permission.',
    detail:
      'GovHub treats data access like an important government permission, not a switch anyone can turn on. Accounts are checked, roles limit what people can do, API keys can expire or be turned off, and audit logs show the trail.',
    points: [
      'Reviewers can check who is asking, which API they need, the legal reason, and the end date.',
      'Test keys keep sandbox practice separate from account identity and approval rules.',
      'Audit views connect activity back to users, agencies, API pages, and results.',
    ],
    tone: 'rose',
    visual: {
      src: '/screenshots/apiApproval.png',
      alt: 'Access approval workflow in the GovHub dashboard',
      caption: 'The approval dashboard makes access easy to review and easy to stop when needed.',
    },
  },
  {
    id: 'pilot-path',
    eyebrow: '06 Pilot path',
    title: 'Start with a small pilot, then grow if it works.',
    detail:
      'A Ministry-led pilot can begin with a few useful checks, like identity, tax status, business lookup, permit status, and whether someone can get a service. The Government of Uganda can measure whether requests are faster, approvals are clearer, APIs are reused, and records are ready for review.',
    points: [
      'Pick a few important services that many teams need.',
      'Use the same request, approval, key, sandbox, and audit steps for each one.',
      'Use dashboard evidence to choose which real data-sharing links deserve investment.',
    ],
    tone: 'brand',
    visual: {
      src: '/screenshots/apiAccessMatrix.png',
      alt: 'Access chart summarizing data-sharing relationships between agencies',
      caption: 'The matrix helps leaders see the pilot scope, approvals, and where to grow next.',
    },
  },
];

export const whyItWorks = [
  {
    id: 'governance',
    title: 'It fits how government says yes.',
    detail:
      'Not every API should be open to everyone. GovHub gives restricted data a clear path with owners, reviewers, users, legal reasons, and end dates.',
  },
  {
    id: 'developer-experience',
    title: 'It helps builders move faster.',
    detail:
      'Developers can search the catalog, read docs, try examples, use the sandbox, and understand errors in one place.',
  },
  {
    id: 'risk-control',
    title: 'It lets teams practice first.',
    detail:
      'Teams can test with pretend data before anyone connects a real registry or production service.',
  },
  {
    id: 'accountability',
    title: 'It keeps a clear record.',
    detail:
      'Requests, approvals, keys, API calls, results, and owners are shown in the workspace, so review is part of the product.',
  },
] as const;
