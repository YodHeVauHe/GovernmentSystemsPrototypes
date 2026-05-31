export type LandingTone = 'green' | 'blue' | 'amber' | 'rose';

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
  { value: '5', label: 'sandbox API families modeled' },
  { value: '6', label: 'governance checkpoints in one flow' },
  { value: '1', label: 'workspace for catalog, access, docs, and audit' },
] as const;

export const landingCtas = [
  {
    label: 'Request demo access',
    href: '/signup',
    intent: 'primary',
    description: 'Create an evaluation account for the prototype workflow.',
  },
  {
    label: 'Sign in',
    href: '/login',
    intent: 'secondary',
    description: 'Return to an existing GovHub workspace.',
  },
  {
    label: 'Open catalog',
    href: '/catalog',
    intent: 'secondary',
    description: 'Go to the protected API catalog after approval.',
  },
] as const;

export const landingPitchDeck: LandingSlide[] = [
  {
    id: 'problem',
    eyebrow: '01 Problem',
    title: 'Fragmented integrations keep government service delivery slower than it needs to be.',
    detail:
      'For the Ministry of ICT and National Guidance, the core interoperability challenge is not only technical. Every identity, tax, business, permit, or eligibility check that is negotiated separately creates duplicated effort, weak traceability, and bespoke integration paths that prevent the Government of Uganda from scaling digital services consistently.',
    points: [
      'Manual data requests slow citizen-facing service delivery.',
      'Duplicate verification work increases operational cost across MDAs.',
      'Weak visibility makes it difficult for government leadership to prove who accessed what and why.',
    ],
    tone: 'amber',
    visual: {
      src: '/screenshots/apiAccessMatrix.png',
      alt: 'Interoperability matrix showing governed MDA data-sharing channels',
      caption: 'The matrix exposes where approved exchange channels exist and where review gaps remain.',
    },
  },
  {
    id: 'solution',
    eyebrow: '02 Solution',
    title: 'GovHub gives the Ministry a governed API exchange layer.',
    detail:
      'GovHub positions the Ministry of ICT and National Guidance as the steward of a reusable government API platform. MDAs get one place to publish API products, document contracts, approve lawful access, issue scoped sandbox credentials, and inspect audit activity without bypassing the governance obligations that protect public data.',
    points: [
      'A searchable catalog makes available Government of Uganda APIs visible.',
      'OpenAPI-backed docs keep technical contracts clear and reusable.',
      'Access requests capture purpose, lawful basis, fields, environment, and expected volume.',
    ],
    tone: 'green',
    visual: {
      src: '/screenshots/apiCatalog.png',
      alt: 'API catalog showing government API products by agency and sector',
      caption: 'The catalog makes ownership, sector, lifecycle, sensitivity, and compliance status visible before integration work starts.',
    },
  },
  {
    id: 'why-now',
    eyebrow: '03 Why now',
    title: 'The Ministry can prove the model before taking production integration risk.',
    detail:
      'GovHub can be evaluated with deterministic sandbox data, seeded agencies, realistic approval paths, and no connection to live production registries. That gives the Ministry and the wider Government of Uganda a low-risk way to assess the operating model, security controls, and developer experience before selecting real systems for a pilot.',
    points: [
      'Sandbox responses show the integration shape without exposing live citizen records.',
      'API owners can validate metadata and documentation workflows early.',
      'Decision-makers can inspect access controls and audit evidence before rollout decisions.',
    ],
    tone: 'blue',
    visual: {
      src: '/screenshots/apiDocs.png',
      alt: 'OpenAPI-backed API documentation page',
      caption: 'Documentation pages show schemas, security notes, request examples, and response models in a format developers can act on.',
    },
  },
  {
    id: 'proof',
    eyebrow: '04 Proof',
    title: 'The pitch is backed by a working product slice, not a static concept.',
    detail:
      'The current build includes catalog discovery, API detail pages, custom documentation, sandbox execution, access approval workflows, account verification, API registration, dashboards, and audit views. The Ministry can evaluate the product behavior directly, while Government of Uganda stakeholders see evidence of the platform rather than a promise of future software.',
    points: [
      'Sandbox calls return structured success and error examples with correlation metadata.',
      'Administrators can review pending access and account verification requests.',
      'API owners can register new OpenAPI specs and governance metadata for review.',
    ],
    tone: 'green',
    visual: {
      src: '/screenshots/apiSandbox.png',
      alt: 'Sandbox console showing an approved-key request and mock API response',
      caption: 'The sandbox gives teams a concrete way to test integration behavior before production access.',
    },
  },
  {
    id: 'trust-model',
    eyebrow: '05 Trust model',
    title: 'Security and accountability are built into the government exchange path.',
    detail:
      'GovHub treats access as a reviewed government privilege, not a public switch. The workflow combines account approval, role-based permissions, scoped API keys, expiry and revocation, MFA support, sensitive field handling, and audit logging so every integration has a visible reason, owner, and operational trail.',
    points: [
      'Access approvals can be evaluated by consumer, API, lawful basis, field tier, and expiry.',
      'Scoped credentials keep sandbox use separate from account identity and governance review.',
      'Audit views help oversight teams connect activity back to users, agencies, endpoints, and status codes.',
    ],
    tone: 'rose',
    visual: {
      src: '/screenshots/apiApproval.png',
      alt: 'Access approval workflow in the GovHub dashboard',
      caption: 'The approval dashboard turns cross-agency access into a reviewable, revocable workflow.',
    },
  },
  {
    id: 'pilot-path',
    eyebrow: '06 Pilot path',
    title: 'A focused pilot can prove the model before scaling the catalog.',
    detail:
      'A practical Ministry-led pilot can begin with a small set of high-value exchange patterns, such as identity verification, tax status, business lookup, permit status, and service eligibility. The Government of Uganda gains a measurable path for cycle time, approval clarity, integration reuse, and audit readiness before widening agency participation.',
    points: [
      'Choose a small number of priority services with clear consumer demand.',
      'Run all access through the same request, approval, key, sandbox, and audit journey.',
      'Use the dashboard evidence to decide which production integrations deserve investment.',
    ],
    tone: 'blue',
    visual: {
      src: '/screenshots/apiAccessMatrix.png',
      alt: 'Access matrix summarizing MDA data-sharing relationships',
      caption: 'The matrix becomes a steering view for pilot scope, approvals, and expansion readiness.',
    },
  },
];

export const whyItWorks = [
  {
    id: 'governance',
    title: 'It fits how government decisions are made.',
    detail:
      'The product does not assume every API should be open. It creates a structured route for restricted data sharing where owners, reviewers, consumers, legal basis, and expiry are visible.',
  },
  {
    id: 'developer-experience',
    title: 'It lowers the technical cost of reuse.',
    detail:
      'Developers get catalog search, docs, examples, sandbox calls, and predictable errors in one workflow, which reduces the need for repeated onboarding meetings and private integration notes.',
  },
  {
    id: 'risk-control',
    title: 'It separates evaluation from production risk.',
    detail:
      'Teams can test contracts and review controls with mock data first. That creates confidence before any decision is made to connect a live registry or production service.',
  },
  {
    id: 'accountability',
    title: 'It produces evidence by default.',
    detail:
      'Requests, approvals, keys, endpoint calls, status codes, and ownership metadata are represented in the workspace, so review becomes a product behavior rather than a manual afterthought.',
  },
] as const;
