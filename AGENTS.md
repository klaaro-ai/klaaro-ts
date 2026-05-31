# Klaaro TypeScript SDK — Agent Reference

## Package

- **name**: `klaaro`
- **version**: `0.1.0`
- **entry**: `import { KlaaroClient } from "klaaro"`
- **runtime**: Node.js 18+ (native fetch, ESM)

## Constructor

```ts
new KlaaroClient(options: KlaaroClientOptions)
```

```ts
interface KlaaroClientOptions {
  apiKey: string;       // required — Bearer sk_...
  baseUrl?: string;     // default: "https://klaaro.ai/api/v1"
}
```

Dev base URL: `"https://dev.klaaro.ai/api/v1"`

## Authentication

All requests: `Authorization: Bearer <apiKey>`
Scopes: `read` (GET), `write` (POST/DELETE), `export` (export endpoints)
Obtain key: dashboard → Team → API keys

## Error class

```ts
class KlaaroApiError extends Error {
  status: number
  code: string
  param: string | undefined
  requestId: string | undefined
}
```

## Rate-limit response headers

| Header                  | Meaning                              |
| ----------------------- | ------------------------------------ |
| `X-RateLimit-Limit`     | Requests allowed per window          |
| `X-RateLimit-Remaining` | Requests left in current window      |
| `X-RateLimit-Reset`     | Unix timestamp when window resets    |
| `Retry-After`           | Seconds to wait (429 responses only) |
| `X-Request-Id`          | Echoed on every response             |

## Paginated response shape

```ts
{ data: T[], meta: { nextCursor: string | null, hasMore: boolean } }
```

Params: `{ limit?: number (1-200, default 50), cursor?: string }`

## Methods

### Datasets

| Method | HTTP | Path | Params | Returns |
|--------|------|------|--------|---------|
| `listDatasets(params?)` | GET | `/datasets` | `ListParams` | `ListResponse<Dataset>` |
| `getDataset(id)` | GET | `/datasets/{id}` | — | `Dataset` |
| `deleteDataset(id)` | DELETE | `/datasets/{id}` | — | `void` (204) |
| `listDatasetRecords(id, params?)` | GET | `/datasets/{id}/records` | `ListRecordsParams` | `ListResponse<RecordClean>` |
| `listDatasetRecordsFlat(id, params?)` | GET | `/datasets/{id}/records-flat` | `ListRecordsParams` | `ListResponse<FlatRecord>` |
| `listDatasetRecordsNested(id, params?)` | GET | `/datasets/{id}/records-nested` | `ListRecordsParams` | `ListResponse<RecordNested>` |
| `listDatasetClasses(id)` | GET | `/datasets/{id}/classes` | — | `ListResponse<Class>` |
| `getDatasetClass(id, classSlug)` | GET | `/datasets/{id}/classes/{slug}` | — | `Class` |
| `listApprovalQueue(id, params?)` | GET | `/datasets/{id}/approval-queue` | `ListApprovalQueueParams` | `ListResponse<ApprovalQueueItem>` |

### Documents

| Method | HTTP | Path | Params | Returns |
|--------|------|------|--------|---------|
| `listDocuments(params?)` | GET | `/documents` | `ListDocumentsParams` | `ListResponse<Document>` |
| `uploadDocument(params)` | POST | `/documents` | `UploadDocumentParams` | `Document` (201) |
| `getDocument(id)` | GET | `/documents/{id}` | — | `Document` |
| `deleteDocument(id)` | DELETE | `/documents/{id}` | — | `void` (204) |
| `getDocumentRecords(id, params?)` | GET | `/documents/{id}/records` | `DocumentRecordsParams` | `{ records: RecordClean[], class }` |
| `getDocumentRecordsFlat(id, params?)` | GET | `/documents/{id}/records-flat` | `DocumentRecordsParams` | `{ records: FlatRecord[], class }` |
| `getDocumentRecordsNested(id, params?)` | GET | `/documents/{id}/records-nested` | `DocumentRecordsParams` | `{ records: RecordNested[], class }` |

`uploadDocument` notes:
- Provide `file` (Blob/File) for multipart upload, or `url` (string) for URL ingest — not both.
- Optional: `filename`, `fixedClass`, `idempotencyKey`, `replaceDocumentId`.
- When `idempotencyKey` is set, sends `Idempotency-Key` header; replay returns `Idempotency-Replay: true` response header.

### Records

| Method | HTTP | Path | Params | Returns |
|--------|------|------|--------|---------|
| `getRecord(id)` | GET | `/records/{id}` | — | `RecordClean` |
| `getRecordFlat(id)` | GET | `/records-flat/{id}` | — | `FlatRecord` |
| `getRecordNested(id)` | GET | `/records-nested/{id}` | — | `RecordNested` |
| `listRecordFieldEvents(id, params?)` | GET | `/records/{id}/field-events` | `ListFieldEventsParams` | `ListResponse<FieldEvent>` |
| `getRecordComments(id)` | GET | `/records/{id}/comments` | — | `ListResponse<CommentView>` |
| `getRecordApprovals(id)` | GET | `/records/{id}/approvals` | — | `ListResponse<ApprovalEvent>` |

### Webhooks

| Method | HTTP | Path | Params | Returns |
|--------|------|------|--------|---------|
| `listWebhooks(params)` | GET | `/webhooks` | `{ datasetId } & ListParams` | `ListResponse<Webhook>` |
| `createWebhook(params)` | POST | `/webhooks` | `CreateWebhookParams` | `Webhook` (201) |
| `updateWebhook(id, params)` | PATCH | `/webhooks/{id}` | `UpdateWebhookParams` | `Webhook` |
| `deleteWebhook(id, params)` | DELETE | `/webhooks/{id}` | `WebhookScopeParams` | `void` (204) |
| `rotateWebhookSecret(id, params)` | POST | `/webhooks/{id}/rotate-secret` | `WebhookScopeParams` | `{ secret: string }` |

### Misc

| Method | HTTP | Path | Auth | Returns |
|--------|------|------|------|---------|
| `getOpenApiSpec()` | GET | `/openapi` | none | `unknown` (raw JSON) |

## Key types

```ts
// ListRecordsParams
{ limit?, cursor?, class?, approval?: ApprovalStatus, createdAfter?, createdBefore? }

// ListDocumentsParams
{ limit?, cursor?, datasetId?, class?, status?: DocumentStatus, createdAfter?, createdBefore? }

// DocumentStatus
"queued" | "processing" | "completed" | "failed" | "cancelled"

// ApprovalStatus
"pending" | "approved" | "approved_with_changes" | "rejected"

// WebhookEvent
"document.ocr_completed" | "document.extraction_completed" | "document.failed" |
"document.uploaded" | "record.updated" | "record.approved" | "evaluation.completed"

// RecordClean  — pure extracted values
{ id, documentId, class: RecordClassRef, data: Record<string, unknown> }

// FlatRecord  — FieldView keyed by JSON path
{ id, documentId, datasetId, ..., fields: { [path]: FieldView } }

// RecordNested  — FieldView at each leaf node
{ id, documentId, datasetId, ..., data: unknown }
```

## Error codes

| Code | Status |
|------|--------|
| `not_authenticated` | 401 |
| `api_key_required` | 401 |
| `insufficient_scope` | 403 |
| `dataset_not_found` | 404 |
| `document_not_found` | 404 |
| `record_not_found` | 404 |
| `webhook_not_found` | 404 |
| `class_not_found` | 404 |
| `validation_error` | 400 |
| `business_rule_violation` | 422 |
| `rate_limited` | 429 |
| `idempotency_conflict` | 409 |
| `internal_error` | 500 |
