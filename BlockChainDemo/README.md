# BlockChainDemo

BlockChainDemo is a browser-based Vite React prototype that explains blockchain concepts through a Uganda government land-title workflow. It follows the same teaching progression as Anders Brownworth's blockchain demo: hash, block, blockchain, distributed peers, tokens/assets, and then a concrete use case.

The product idea is a national permissioned government blockchain foundation. Ministries, Departments, and Agencies act as peer nodes that hold matching proofs of important government actions. The chain does not replace MDA systems. It provides shared verification, tamper evidence, workflow sequencing, and auditability across agencies.

## Concept Pages

- **Hash:** shows how a land-title payload becomes a SHA-256 hash and how a small edit changes the digest.
- **Block:** combines block number, nonce, previous hash, data, and current hash; users can mine the block.
- **Blockchain:** links land-registry events so changing one event breaks the chain until affected blocks are mined again.
- **Distributed MDAs:** simulates Ministry of Lands, NIRA, URA, and a local land office holding peer copies of the same chain.
- **Tokens / Assets:** models a land title as a government-controlled asset token, not cryptocurrency.
- **Land Title Use Case:** walks through title verification and transfer with MDA approvals before the final transfer block is mined.

## Why Land Titles

Land title verification and transfer is a strong first use case because ownership history, caveats, stamp duty, identity checks, and transfer approvals involve several government actors. A permissioned chain can show whether each required agency signed off and whether the title history has been altered.

## Data Policy

This prototype uses realistic fictional data only. It does not use live citizen records, national identification numbers, tax records, private addresses, or real land ownership records.

Example fictional references include:

- `TITLE-KLA-2026-000184`
- `PARCEL-KCCA-CEN-12-0441`
- `OWNER-REF-AF3D91`
- `NIRA-VERIFY-2026-05-29-00941`
- `URA-STAMP-2026-05-29-00672`
- `MOLHUD-APPROVAL-2026-05-29-01422`

## Project Structure

```text
BlockChainDemo/
  README.md
  frontend/
    src/
      components/
        blockchain/
        layout/
        ui/
      lib/
      pages/
```

There is no backend in this first version. Hashing, mining, validation, peer consensus, and the land-title workflow are deterministic client-side behavior.

## Run Locally

```bash
cd BlockChainDemo/frontend
npm install
npm run dev
```

Useful checks:

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Future Backend Path

A backend would become useful if the demo needs persistent saved chains, authenticated MDA users, live multi-user peer synchronization, signed approvals, or integration adapters to real MDA systems. Those are intentionally out of scope for this browser-only showcase prototype.
