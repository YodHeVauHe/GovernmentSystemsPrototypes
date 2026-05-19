# NDP Data Engine & Audit Ledger - Design Specification

## 1. Overview
The `ndp-data-engine` serves as the core ingestion pipeline, cryptographic ledger, and time-series analytics backend for the NDP Performance Tracker. It guarantees data sovereignty and trustless verification of field data submitted by local government officials.

## 2. Architecture & Tech Stack
- **Runtime & Framework:** Node.js, Express.js, TypeScript.
- **Database:** PostgreSQL (with schema structures prepared for TimescaleDB extensions to handle time-series metrics).
- **Database Access:** Knex.js query builder to ensure compatibility with time-series hyper-tables and complex analytical queries.
- **Cryptography:** Native Node.js `crypto` module utilizing ECDSA (Elliptic Curve Digital Signature Algorithm) for verifying client-side signatures.

## 3. Data Models
### 3.1 Key Registry (`officials` table)
Stores identity and cryptographic material for local officials.
- `id` (UUID, Primary Key)
- `name` (String)
- `role` (String)
- `district_id` (String)
- `parish_id` (String, nullable)
- `public_key` (String, PEM format)
- `is_active` (Boolean)

### 3.2 Immutable Audit Ledger (`audit_ledger` table)
Append-only table acting as the ultimate source of truth.
- `id` (UUID, Primary Key)
- `created_at` (Timestamp, default NOW())
- `official_id` (UUID, Foreign Key)
- `raw_payload` (JSONB)
- `signature` (String, Base64)

### 3.3 Time-Series Metrics (`performance_metrics` hyper-table)
Optimized for high-speed dashboard aggregations.
- `time` (Timestamp, Primary Key part 1)
- `project_id` (String, Primary Key part 2)
- `district_id` (String)
- `parish_id` (String)
- `metric_type` (Enum: 'budget_disbursed', 'budget_spent', 'milestone_completed')
- `value` (Numeric)

## 4. API & Ingestion Flow
### 4.1 Field Data Ingestion Endpoint (`POST /api/v1/ingest`)
1. **Receive:** Accepts JSON payload containing `{ data: { ...metrics }, signature: "..." }` and the `official_id` in headers.
2. **Verify:** Looks up `official_id` to retrieve `public_key`. Verifies the ECDSA `signature` against the `data` object. Returns `401 Unauthorized` if verification fails.
3. **Ledger Write:** Inserts `{ official_id, raw_payload: data, signature }` into `audit_ledger`.
4. **Metric Parsing:** Normalizes the `data` payload and batch-inserts records into the `performance_metrics` table.
5. **Acknowledge:** Returns `201 Created` to the client.

### 4.2 Analytics & Executive Dashboard Endpoints (`GET /api/v1/analytics/...`)
- `/api/v1/analytics/burn-rates`: Aggregates `budget_spent` vs. time per district.
- `/api/v1/analytics/anomalies`: Cross-references IFMS disbursement metadata against field milestone completion to flag deviations exceeding a 15% threshold as "High Risk".

## 5. Security & Constraints
- **Append-Only Policy:** The database user utilized by the Node.js application will only have `INSERT` and `SELECT` privileges on the `audit_ledger` table. No `UPDATE` or `DELETE` operations are permitted at the database level.
- **Offline Resilience:** The ingestion endpoint accepts historical timestamps in payloads to support field clients that capture data offline and sync when connectivity is restored.
