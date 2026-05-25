# Spec: Interactive API Registry & High-Fidelity Validation Flow

**Date:** 2026-05-21  
**Status:** Approved  
**Author:** Antigravity  

---

## 1. Abstract / Summary
This specification defines the implementation of a high-fidelity "Add API" workflow in the Uganda GovHub API catalog. It provides a smart OpenAPI import flow: allowing platform administrators to specify an OpenAPI source (URL, file drop, or raw JSON/YAML text), validating it through backend parser services, extracting metadata, pre-populating fields, and capturing mandatory Ugandan MDA compliance/governance variables before committing to the registry database.

---

## 2. System Architecture

```
[Admin UI (Catalog)] 
       │
       ├── 1. POST /api/catalog/validate-spec (Raw text, file content, or URL)
       │      │
       │      └─── Backend validates with js-yaml, returns spec metadata (title, paths)
       │
       └── 2. POST /api/catalog (OpenAPI Spec + MDA Governance details)
              │
              ├── Generate random cryptographically secure UUID
              ├── Write openapi yaml file to backend/openapi/api-reg-<uuid>.yaml
              ├── Insert into SQLite database (apis table)
              └── Log Audit Event API_REGISTERED
```

---

## 3. Detailed Specifications

### A. Backend Endpoints

#### 1. `POST /api/catalog/validate-spec`
* **Purpose:** Validates OpenAPI spec string or fetches it from a URL, then returns parsed information.
* **Payload Structure:**
  ```typescript
  interface ValidateSpecPayload {
    specText?: string;
    specUrl?: string;
  }
  ```
* **Processing Steps:**
  1. If `specUrl` is provided, download the file content.
  2. Parse the content as YAML or JSON using `js-yaml` and `JSON.parse`.
  3. Validate the presence of essential OpenAPI keys: `openapi` (or `swagger`) and `info`.
  4. Extract `info.title`, `info.description`, `info.version`, and calculate the total count of operational endpoints in `paths`.
  5. Return successful metadata or detailed error messages.

#### 2. `POST /api/catalog`
* **Purpose:** Writes the validated specification file, creates a SQLite entry, and adds audit trails.
* **Payload Structure:** Matches the database fields including `owning_mda_id`, `openapi_spec`, and statutory compliance metadata.
* **Processing Steps:**
  1. Generate random UUID: `id = 'api-reg-' + crypto.randomUUID()`.
  2. Map spec save file path: `openapi_spec_path = '/openapi/' + id + '.yaml'`.
  3. Write the spec raw string to `backend/openapi/` relative directory.
  4. Execute SQLite prepare-run statement on the `apis` table.
  5. Log audit event `API_REGISTERED`.

---

### B. Frontend Components (`Catalog.tsx`)

#### 1. Source Loading Interface
* **Tabs:**
  * **URL:** Standard URL string validation.
  * **File:** File reader extracting content from dropped `.yaml`, `.yml`, or `.json` files.
  * **Raw Text:** Standard monospace monospace textarea.
* **State Management:**
  * `step`: `'loading-source' | 'configure-metadata'`
  * `loading`: boolean state indicating backend spec parsing.
  * `validationError`: string containing detailed parser feedback.

#### 2. Metadata Governance Interface
* **Pre-population:** Title and description mapped directly from the verified specification.
* **Governance Fields:**
  * **Owning MDA:** Dropdown linked to NIRA, URA, URSB, MoWT, MoICT, MoH.
  * **Sector:** Input for categorizing functions.
  * **Sensitivity / Classification:** High/Medium/Low and Public/Official/Restricted dropdowns.
  * **Legal Basis:** Textarea detailing Section compliance (e.g. Traffic and Road Safety Act 1998, Section 42).
  * **SLA & Team contact details:** SLA description, Technical Owner team, Contact Office email.

---

## 4. Compliance & Audit Verification
* All API registration actions must emit an `API_REGISTERED` log in the `audit_logs` table.
* Newly registered APIs are initialized with their configured compliance status and lifecycle status.
