# Spec: Interactive API Registry and Validation Flow

## Status

Approved.

## Summary

This specification defines the "Add API" workflow in the Uganda GovHub API catalog. It mirrors modern smart import behavior: administrators can provide an OpenAPI source by URL, uploaded file, or raw JSON/YAML text; validate it through backend parser services; extract metadata; pre-populate catalog fields; and capture mandatory Ugandan MDA compliance and governance data before committing the API to the registry.

## System Architecture

```text
Admin UI (Catalog)
  |
  |-- POST /api/catalog/validate-spec
  |     |
  |     |-- Backend validates with JSON parsing and js-yaml
  |     |-- Backend returns spec metadata
  |
  |-- POST /api/catalog
        |
        |-- Generate api-reg-<uuid>
        |-- Store OpenAPI text in Postgres
        |-- Insert Postgres catalog row
        |-- Log API_REGISTERED audit event
```

## Backend Endpoints

### POST /api/catalog/validate-spec

Purpose:

- Validate an OpenAPI specification string or fetch one from a URL.
- Return parsed metadata for administrator review.

Payload:

```typescript
interface ValidateSpecPayload {
  specText?: string;
  specUrl?: string;
}
```

Processing:

- Fetch URL content if `specUrl` is provided.
- Parse content as JSON or YAML.
- Validate presence of `openapi` or `swagger`.
- Validate presence of `info.title`.
- Extract title, description, version, and endpoint count.
- Return detailed error messages for invalid input.

### POST /api/catalog

Purpose:

- Persist a validated API specification and governance metadata.

Processing:

- Generate `id = "api-reg-" + crypto.randomUUID()`.
- Save the spec text in Postgres (`openapi_spec_text`) and expose it through the stable `/openapi/<id>.yaml` route.
- Insert catalog metadata into the `apis` table.
- Insert an audit event with event type `API_REGISTERED`.
- Return the created API id.

## Frontend Workflow

### Source Loading

The registration UI should provide three source modes:

- URL: administrator enters a remote OpenAPI URL.
- File: administrator uploads or drops a `.yaml`, `.yml`, or `.json` file.
- Raw Text: administrator pastes JSON or YAML into a monospace text area.

State should distinguish source loading from metadata configuration.

### Metadata Configuration

The validated spec should pre-populate:

- API name
- Description
- Version where useful
- Endpoint count as read-only context

The administrator must still review and complete governance metadata before registration.

## Governance Metadata

The registration form should support:

- Owning MDA
- Sector
- Sensitivity level
- Security classification
- Lifecycle status
- Compliance status
- Statutory basis
- SLA target
- Technical owner
- Contact office
- Personal data categories
- Purpose limitation
- Data minimization note
- Retention class
- Sandbox availability
- Required approval level

## Audit Requirements

- Every successful API registration must create an `API_REGISTERED` audit event.
- Newly registered APIs must preserve the selected lifecycle and compliance statuses.
- Validation failures must not create catalog rows or audit events.
