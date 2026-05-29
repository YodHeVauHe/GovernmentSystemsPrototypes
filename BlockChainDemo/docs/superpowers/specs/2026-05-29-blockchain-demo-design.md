# BlockChainDemo Design

## Purpose

Create `BlockChainDemo`, a standalone Vite React prototype that teaches blockchain concepts through a Uganda government land-title use case. The demo should follow the teaching structure of Anders Brownworth's blockchain demo while presenting a national permissioned-government-chain idea where Ministries, Departments, and Agencies act as network peers.

The prototype is for the Government Systems Prototype Showcase context described in `call-to-ugandan-tech-innovators-start-ups.pdf`. It should demonstrate technical soundness, public-sector relevance, security thinking, scalability potential, and local digital public infrastructure value.

## Source References

- Anders Brownworth reference repo: `anders94/blockchain-demo`
- Reference structure observed: one page per concept, shared layout, shared block partials, shared mining/hash logic, and immediate valid/invalid visual feedback.
- shadcn source reference: `/home/zasourcecode/.opensrc/repos/github.com/shadcn-ui/ui/main`
- Official shadcn skill reference: `https://ui.shadcn.com/docs/skills`

The implementation should use these references for structure and UI workflow, not copy the Anders demo source or data.

## Product Scope

Build a Vite React application under:

```text
BlockChainDemo/
  README.md
  frontend/
```

No backend is required for the first version. The demo can run fully in the browser because hashing, mining, peer simulation, chain validation, and seeded data can be deterministic client-side behavior. A backend can be added later if the product needs persistence, authenticated users, live peer sync, or integration with real MDA systems.

## Folder Structure

```text
BlockChainDemo/
  README.md
  frontend/
    package.json
    components.json
    index.html
    vite.config.ts
    tsconfig.json
    src/
      App.tsx
      main.tsx
      index.css
      components/
        blockchain/
          BlockCard.tsx
          ChainRow.tsx
          PeerChain.tsx
          TransactionTable.tsx
          UseCaseTimeline.tsx
        layout/
          AppShell.tsx
          ConceptNav.tsx
        ui/
          shadcn component files
      lib/
        blockchain.ts
        crypto.ts
        demo-data.ts
        land-title-use-case.ts
        types.ts
      pages/
        HashPage.tsx
        BlockPage.tsx
        BlockchainPage.tsx
        DistributedPage.tsx
        TokensPage.tsx
        LandTitleUseCasePage.tsx
```

## Concept Flow

### Hash

Show how changing land-title data changes a SHA-256 hash. The input should default to a realistic parcel verification payload with fields such as parcel ID, title number, district, owner reference, and issuing office. Users can edit the text and see the hash update immediately.

### Block

Show one block with block number, nonce, data, previous hash, and current hash. The block is valid when its hash satisfies the demo difficulty. Users can edit the data, see the block become invalid, and mine the block again.

### Blockchain

Show a linked chain of land-registry events:

- title issued
- caveat lodged
- stamp duty assessed
- identity and ownership verified
- title transferred

Changing one block must invalidate that block and all later blocks until the affected blocks are mined again.

### Distributed MDAs

Show the same chain held by several simulated MDA peers:

- Ministry of Lands, Housing and Urban Development
- NIRA
- URA
- Local Government Land Office

Each peer should have its own copy of the chain. Tampering with one peer's chain should visibly break consensus while the other peers remain valid. A reset or resync action can restore the peer from the majority-valid chain.

### Tokens / Assets

Model land titles as government-controlled asset tokens, not cryptocurrency. Each asset token represents a title state and ownership claim anchored by a block. Token transfer should require multi-MDA approval entries, including identity verification, stamp duty status, and land office approval.

### Land Title Use Case

Illustrate a real government workflow using realistic seeded data, not live personal data. The use case should walk through title verification and transfer:

1. Buyer or institution requests title verification.
2. Ministry of Lands confirms the title and parcel state.
3. NIRA confirms party identity references.
4. URA confirms stamp duty assessment or payment reference.
5. Local government office confirms jurisdictional constraints.
6. Smart-contract-style validation checks that required approvals exist.
7. Transfer block is mined and added to the chain.
8. Final title token state shows the new owner reference and immutable audit trail.

## Data Policy

The demo must not use real citizen records, real land ownership records, national identification numbers, tax records, or private addresses. Use realistic but fictional seeded data with clear public-sector structure.

Example data can include:

- `TITLE-KLA-2026-000184`
- `PARCEL-KCCA-CEN-12-0441`
- `Kampala Central Division`
- `OWNER-REF-AF3D91`
- `NIRA-VERIFY-2026-05-29-00941`
- `URA-STAMP-2026-05-29-00672`
- `MOLHUD-APPROVAL-2026-05-29-01422`

## Core Data Model

```ts
type DemoBlock = {
  index: number
  nonce: number
  previousHash: string
  hash: string
  data: string | LandTitleEvent | AssetTransfer[]
}

type LandTitleEvent = {
  eventType: "TITLE_ISSUED" | "CAVEAT_LODGED" | "STAMP_DUTY_ASSESSED" | "IDENTITY_VERIFIED" | "TITLE_TRANSFERRED"
  titleNumber: string
  parcelId: string
  actorMda: string
  reference: string
  timestamp: string
  details: Record<string, string>
}

type MdaPeer = {
  id: string
  name: string
  role: string
  chain: DemoBlock[]
}
```

## Core Behavior

- Use browser-native Web Crypto API for SHA-256 when possible.
- Keep hashing deterministic by canonicalizing structured data before hashing.
- Use a low demo difficulty so mining completes quickly in the browser.
- Validity is local and educational: valid blocks have hashes that satisfy the difficulty and previous-hash links that match.
- Distributed consensus is simulated by comparing peer chain hashes and identifying the majority-valid chain.
- Do not claim this is a production blockchain implementation.

## UI Design

Use Vite React, TypeScript, Tailwind, and shadcn/ui. The UI should be an interactive tool, not a marketing landing page.

Primary UI pieces:

- top navigation or tab navigation for concept pages
- cards for blocks and peer chains
- textareas/inputs for editable block data
- badges for valid, invalid, mined, tampered, consensus, and out-of-sync states
- tables for transactions and approval events
- alerts for tamper/consensus explanations
- buttons with icons for mine, reset, tamper, resync, and add approval actions

The visual style should be restrained, official, and operational. Avoid decorative hero layouts. The first screen should show the working demo navigation and current concept content.

## shadcn Skill

Create a local skill named `shadcn-ui` so future requests mentioning shadcn, shadcn/ui, `components.json`, shadcn components, or shadcn registries load the correct workflow.

The skill should:

- live under the local Codex skills directory
- use the official shadcn skill behavior from `https://ui.shadcn.com/docs/skills`
- treat `/home/zasourcecode/.opensrc/repos/github.com/shadcn-ui/ui/main` as the local source-of-truth reference
- instruct the agent to run `npx shadcn@latest info --json` in projects with `components.json`
- prefer CLI docs/search/view/add flows over guessing component APIs
- require checking installed components before importing or adding components
- use semantic tokens and shadcn composition rules
- keep the skill concise and reference shadcn source files only when needed

## README Requirements

`BlockChainDemo/README.md` should explain:

- what the demo is
- why MDAs are modeled as peer nodes
- what each concept page teaches
- why the land-title use case was chosen
- why the prototype avoids live citizen and land records
- how to install and run the frontend
- that there is no backend in the first version
- what a future backend could add

## Error Handling

- If hashing fails in Web Crypto, show a visible error state and keep the last known hash.
- If mining cannot find a nonce within the demo limit, show a clear "increase limit or lower difficulty" message.
- If a peer chain is invalid, identify the first invalid block.
- If a transfer approval is missing, show which MDA approval is required before the transfer can be mined.

## Testing

Use focused tests for:

- deterministic hashing and canonical serialization
- block validity after data edits
- chain invalidation propagation
- mining behavior at demo difficulty
- peer consensus detection
- land-title transfer approval checks

Use browser verification after implementation to confirm:

- all concept pages render
- editing data updates hashes
- mining changes nonce and restores validity
- tampering with one peer breaks consensus
- land-title transfer cannot complete with missing approvals

## Non-Goals

- No production blockchain network.
- No cryptocurrency or public-token trading.
- No real government integrations.
- No real personal, land, tax, or identity records.
- No backend until a later phase requires persistence or live collaboration.

## Acceptance Criteria

- `BlockChainDemo/frontend` runs as a Vite React app.
- The app includes Hash, Block, Blockchain, Distributed MDAs, Tokens / Assets, and Land Title Use Case pages.
- The core demo behavior is interactive and visible without a backend.
- The UI uses shadcn/ui components and follows shadcn composition rules.
- The README explains the concept, run steps, data policy, and future backend path.
- The local `shadcn-ui` skill exists and points to the shadcn opensrc source as a source of truth.
