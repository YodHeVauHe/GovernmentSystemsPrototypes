# BlockChainDemo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run `BlockChainDemo`, a standalone Vite React app that teaches blockchain concepts through a Uganda government land-title workflow and includes a local shadcn-ui skill.

**Architecture:** The app is a browser-only Vite React frontend under `BlockChainDemo/frontend`. Deterministic blockchain logic lives in `src/lib`, reusable visualization components live in `src/components/blockchain`, and concept pages mirror the Anders Brownworth teaching sequence while adapting the content to simulated MDA land-title records. No backend is created in this phase.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui-style local components, lucide-react, Vitest, Testing Library, Web Crypto API with Node crypto fallback for tests.

---

## File Structure

- Create: `BlockChainDemo/README.md` - explains the demo, MDA peer model, concept pages, data policy, run commands, and future backend path.
- Create: `BlockChainDemo/frontend/package.json` - Vite scripts and dependencies.
- Create: `BlockChainDemo/frontend/components.json` - shadcn project config.
- Create: `BlockChainDemo/frontend/index.html` - frontend entry HTML.
- Create: `BlockChainDemo/frontend/vite.config.ts` - Vite and Vitest configuration.
- Create: `BlockChainDemo/frontend/tsconfig*.json` - TypeScript project configuration.
- Create: `BlockChainDemo/frontend/src/main.tsx` and `src/App.tsx` - React entry and route/page selection.
- Create: `BlockChainDemo/frontend/src/index.css` - Tailwind v4 import, theme tokens, and base styles.
- Create: `BlockChainDemo/frontend/src/lib/types.ts` - shared demo types.
- Create: `BlockChainDemo/frontend/src/lib/crypto.ts` - deterministic serialization and SHA-256 helper.
- Create: `BlockChainDemo/frontend/src/lib/blockchain.ts` - block hashing, mining, validation, chain repair, consensus, and approval checks.
- Create: `BlockChainDemo/frontend/src/lib/demo-data.ts` - fictional seeded MDA and land-title data.
- Create: `BlockChainDemo/frontend/src/lib/land-title-use-case.ts` - use-case workflow helpers.
- Create: `BlockChainDemo/frontend/src/lib/blockchain.test.ts` - deterministic behavior tests.
- Create: `BlockChainDemo/frontend/src/components/ui/*.tsx` - local shadcn-style UI components required by the demo.
- Create: `BlockChainDemo/frontend/src/components/blockchain/*.tsx` - block, chain, peer, transaction, and timeline UI.
- Create: `BlockChainDemo/frontend/src/components/layout/*.tsx` - app shell and concept navigation.
- Create: `BlockChainDemo/frontend/src/pages/*.tsx` - Hash, Block, Blockchain, Distributed, Tokens, and Land Title pages.
- Create: `/home/zasourcecode/.codex/skills/shadcn-ui/SKILL.md` - local shadcn workflow skill referencing official docs and opensrc source.

## Task 1: Create the Local shadcn-ui Skill

**Files:**
- Create: `/home/zasourcecode/.codex/skills/shadcn-ui/SKILL.md`

- [ ] **Step 1: Add the skill file**

Create the skill with concise trigger metadata and workflow rules:

```markdown
---
name: shadcn-ui
description: Use when working with shadcn, shadcn/ui, shadcn components, component registries, components.json, shadcn CLI, presets, or UI composition in a shadcn project.
---

# shadcn/ui

Use this skill for shadcn/ui projects and any request that mentions shadcn, shadcn/ui, `components.json`, shadcn registries, presets, or shadcn component composition.

## Source Of Truth

- Official skill/docs: `https://ui.shadcn.com/docs/skills`
- Local source cache: `/home/zasourcecode/.opensrc/repos/github.com/shadcn-ui/ui/main`
- Official skill in source cache: `/home/zasourcecode/.opensrc/repos/github.com/shadcn-ui/ui/main/skills/shadcn/SKILL.md`
- Component source examples: `/home/zasourcecode/.opensrc/repos/github.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui`

Read only the source files needed for the current task.

## Workflow

1. If the project has `components.json`, run the package-runner equivalent of `npx shadcn@latest info --json` from the project root and use its aliases, resolved paths, Tailwind version, base, icon library, and package manager.
2. Check installed components before importing or adding a component.
3. Use `npx shadcn@latest docs <component>`, `search`, `view`, and `add` instead of guessing component APIs when network and project context permit.
4. Prefer installed shadcn source components and composition before custom markup.
5. Use semantic tokens such as `bg-background`, `text-muted-foreground`, `border-border`, and component variants before raw color utilities.
6. Use `gap-*`, not `space-x-*` or `space-y-*`; use `size-*` for equal width and height.
7. Use full component composition: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`; `TabsTrigger` inside `TabsList`; overlays must have titles.
8. Use `FieldGroup` and `Field` for forms when those components are available.
9. Icons in buttons use the project's configured icon library and `data-icon="inline-start"` or `data-icon="inline-end"`.
10. After adding registry components, read the added files and fix imports or composition issues before continuing.

## Fallback

If the shadcn CLI or network is unavailable, inspect the local source cache and create minimal source components that follow shadcn composition patterns, semantic tokens, and the local project aliases.
```

- [ ] **Step 2: Validate the skill metadata**

Run:

```bash
sed -n '1,220p' /home/zasourcecode/.codex/skills/shadcn-ui/SKILL.md
```

Expected: the file exists, has `name: shadcn-ui`, and references the local opensrc shadcn source cache.

## Task 2: Scaffold the Vite React Project

**Files:**
- Create: `BlockChainDemo/README.md`
- Create: `BlockChainDemo/frontend/package.json`
- Create: `BlockChainDemo/frontend/components.json`
- Create: `BlockChainDemo/frontend/index.html`
- Create: `BlockChainDemo/frontend/vite.config.ts`
- Create: `BlockChainDemo/frontend/tsconfig.json`
- Create: `BlockChainDemo/frontend/tsconfig.app.json`
- Create: `BlockChainDemo/frontend/tsconfig.node.json`
- Create: `BlockChainDemo/frontend/src/main.tsx`
- Create: `BlockChainDemo/frontend/src/App.tsx`
- Create: `BlockChainDemo/frontend/src/index.css`

- [ ] **Step 1: Create project directories**

Run:

```bash
mkdir -p BlockChainDemo/frontend/src/{components/{blockchain,layout,ui},lib,pages}
```

Expected: all frontend directories exist.

- [ ] **Step 2: Add project manifests**

Create `package.json`, `components.json`, TypeScript configs, Vite config, and `index.html` with Vite React, Tailwind, lucide-react, Vitest, and Testing Library support.

- [ ] **Step 3: Add React entry files and base CSS**

Add `main.tsx`, `App.tsx`, and `index.css` with a working default app shell and Tailwind/shadcn theme tokens.

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `BlockChainDemo/frontend/package-lock.json` is created and dependencies install successfully.

## Task 3: Test-Drive Blockchain Core Logic

**Files:**
- Create: `BlockChainDemo/frontend/src/lib/types.ts`
- Create: `BlockChainDemo/frontend/src/lib/crypto.ts`
- Create: `BlockChainDemo/frontend/src/lib/blockchain.ts`
- Create: `BlockChainDemo/frontend/src/lib/demo-data.ts`
- Create: `BlockChainDemo/frontend/src/lib/land-title-use-case.ts`
- Create: `BlockChainDemo/frontend/src/lib/blockchain.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must cover deterministic serialization, hash changes after edits, block validity, chain invalidation, mining, consensus, and missing approval messages.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run src/lib/blockchain.test.ts
```

Expected: tests fail because the core logic does not exist yet.

- [ ] **Step 3: Implement core logic**

Implement:

- `canonicalize(value)`
- `sha256Hex(value)`
- `calculateBlockHash(block)`
- `isBlockMined(hash, difficulty)`
- `mineBlock(block, difficulty, maxNonce)`
- `validateChain(chain, difficulty)`
- `repairChainFrom(chain, startIndex, difficulty)`
- `createDemoChain(events, difficulty)`
- `findConsensus(peers, difficulty)`
- `getMissingTransferApprovals(approvals)`
- seeded fictional land-title events and MDA peers

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- --run src/lib/blockchain.test.ts
```

Expected: all core logic tests pass.

## Task 4: Build shadcn-Style UI Primitives

**Files:**
- Create: `BlockChainDemo/frontend/src/lib/utils.ts`
- Create: `BlockChainDemo/frontend/src/components/ui/button.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/card.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/badge.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/alert.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/tabs.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/input.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/textarea.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/table.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/separator.tsx`
- Create: `BlockChainDemo/frontend/src/components/ui/tooltip.tsx`

- [ ] **Step 1: Add utility and components**

Create minimal local shadcn-style components using `class-variance-authority`, Radix Tabs, Radix Tooltip, and semantic Tailwind tokens.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes for utility and UI components.

## Task 5: Build Reusable Blockchain Visual Components

**Files:**
- Create: `BlockChainDemo/frontend/src/components/blockchain/BlockCard.tsx`
- Create: `BlockChainDemo/frontend/src/components/blockchain/ChainRow.tsx`
- Create: `BlockChainDemo/frontend/src/components/blockchain/PeerChain.tsx`
- Create: `BlockChainDemo/frontend/src/components/blockchain/TransactionTable.tsx`
- Create: `BlockChainDemo/frontend/src/components/blockchain/UseCaseTimeline.tsx`

- [ ] **Step 1: Implement components**

Components must render editable block data, nonce/hash fields, mining buttons, validity badges, peer consensus status, approval rows, and timeline events.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes for blockchain components.

## Task 6: Build Concept Pages and Navigation

**Files:**
- Create: `BlockChainDemo/frontend/src/components/layout/AppShell.tsx`
- Create: `BlockChainDemo/frontend/src/components/layout/ConceptNav.tsx`
- Create: `BlockChainDemo/frontend/src/pages/HashPage.tsx`
- Create: `BlockChainDemo/frontend/src/pages/BlockPage.tsx`
- Create: `BlockChainDemo/frontend/src/pages/BlockchainPage.tsx`
- Create: `BlockChainDemo/frontend/src/pages/DistributedPage.tsx`
- Create: `BlockChainDemo/frontend/src/pages/TokensPage.tsx`
- Create: `BlockChainDemo/frontend/src/pages/LandTitleUseCasePage.tsx`
- Modify: `BlockChainDemo/frontend/src/App.tsx`

- [ ] **Step 1: Implement app shell and concept navigation**

Use tab-style navigation and keep the first screen as the working demo experience.

- [ ] **Step 2: Implement pages**

Each page must map to the approved concept flow: Hash, Block, Blockchain, Distributed MDAs, Tokens / Assets, and Land Title Use Case.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes for all pages.

## Task 7: Add README and Verification Scripts

**Files:**
- Modify: `BlockChainDemo/README.md`
- Modify: `BlockChainDemo/frontend/package.json`

- [ ] **Step 1: Write README**

Cover the demo purpose, MDA peers, concept pages, land-title rationale, fictional data policy, install/run commands, no-backend note, and future backend path.

- [ ] **Step 2: Confirm scripts**

Ensure scripts include:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "typecheck": "tsc -b"
}
```

## Task 8: Final Verification and Runtime Check

**Files:**
- No new files expected.

- [ ] **Step 1: Run tests**

Run:

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite production build pass.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL.

- [ ] **Step 4: Browser smoke-check**

Open the Vite URL and verify the page contains the six concept tabs/pages and the land-title workflow. Inspect that editing data updates hashes and mining/resync actions work.

## Self-Review

- Spec coverage: Tasks cover the standalone app, no-backend scope, all six concept pages, fictional land-title data, core blockchain behavior, shadcn UI usage, README, tests, and local shadcn-ui skill.
- Placeholder scan: No task uses TBD/TODO/fill-in placeholders as acceptance criteria.
- Type consistency: Type names match the design spec and implementation file names.
