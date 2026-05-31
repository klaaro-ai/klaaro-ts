# klaaro

Official TypeScript SDK for the [Klaaro](https://klaaro.ai) API — documents in, structured data out.

## Install

```bash
npm install klaaro
```

Requires Node.js 18+ (uses native `fetch`). No runtime dependencies.

## Quick start

```ts
import { KlaaroClient } from "klaaro";

const klaaro = new KlaaroClient({ apiKey: "sk_your_key_here" });

// 1. List datasets
const { data: datasets } = await klaaro.listDatasets();
console.log(datasets[0].name); // "Invoices 2026"

// 2. Upload a document (file)
import { readFileSync } from "fs";
const file = new Blob([readFileSync("invoice.pdf")], { type: "application/pdf" });
const doc = await klaaro.uploadDocument({
  datasetId: datasets[0].id,
  file,
  filename: "invoice.pdf",
});
console.log(doc.id, doc.status); // "b6d2a7f6-..." "queued"

// 3. Upload from URL
const doc2 = await klaaro.uploadDocument({
  datasetId: datasets[0].id,
  url: "https://example.com/invoice.pdf",
});

// 4. Poll until complete
let document = await klaaro.getDocument(doc.id);
while (document.status === "queued" || document.status === "processing") {
  await new Promise((r) => setTimeout(r, 3000));
  document = await klaaro.getDocument(doc.id);
}

// 5. Read extracted records (clean values)
const { records } = await klaaro.getDocumentRecords(document.id);
console.log(records[0].data); // { vendor_name: "Acme Corp", total: 1234.56, ... }
```

## Constructor

```ts
const klaaro = new KlaaroClient({
  apiKey: "sk_...",       // required
  baseUrl: "https://dev.klaaro.ai/api/v1",  // optional, defaults to prod
});
```

Get your API key from **Team → API keys** in the Klaaro dashboard.

## Authentication

All requests send `Authorization: Bearer <apiKey>`. Three scopes control access:

| Scope   | Unlocks                     |
| ------- | --------------------------- |
| `read`  | List and get endpoints      |
| `write` | Upload, create, delete      |
| `export`| Export endpoints            |

## Datasets

```ts
// List (paginated)
const page = await klaaro.listDatasets({ limit: 20 });

// Get one
const dataset = await klaaro.getDataset("a1b2c3d4-...");

// Delete
await klaaro.deleteDataset("a1b2c3d4-...");

// Records (clean extracted values)
const records = await klaaro.listDatasetRecords("a1b2c3d4-...", {
  class: "invoice",
  approval: "approved",
  limit: 100,
});

// Records with full field metadata (review, validation, evidence)
const flat = await klaaro.listDatasetRecordsFlat("a1b2c3d4-...");

// Classes / schemas
const classes = await klaaro.listDatasetClasses("a1b2c3d4-...");
const invoiceClass = await klaaro.getDatasetClass("a1b2c3d4-...", "invoice");
```

## Documents

```ts
// List with filters
const docs = await klaaro.listDocuments({
  datasetId: "a1b2c3d4-...",
  status: "completed",
  limit: 50,
});

// Upload (idempotent)
const doc = await klaaro.uploadDocument({
  datasetId: "a1b2c3d4-...",
  file: myBlob,
  filename: "receipt.pdf",
  idempotencyKey: "my-unique-key-001",
});

// Get / delete
const d = await klaaro.getDocument("b6d2a7f6-...");
await klaaro.deleteDocument("b6d2a7f6-...");

// Records for a specific document
const { records } = await klaaro.getDocumentRecords("b6d2a7f6-...");
const { records: flat } = await klaaro.getDocumentRecordsFlat("b6d2a7f6-...", {
  includeUnapproved: true,
});
```

## Records

```ts
const record = await klaaro.getRecord("2c0c2e50-...");       // clean values
const flat = await klaaro.getRecordFlat("2c0c2e50-...");     // flat FieldView map
const nested = await klaaro.getRecordNested("2c0c2e50-..."); // nested FieldView tree

const events = await klaaro.listRecordFieldEvents("2c0c2e50-...", { fieldPath: "total" });
const comments = await klaaro.getRecordComments("2c0c2e50-...");
const approvals = await klaaro.getRecordApprovals("2c0c2e50-...");
```

## Webhooks

```ts
const hook = await klaaro.createWebhook({
  datasetId: "a1b2c3d4-...",
  url: "https://my.app/hooks/klaaro",
  events: ["document.extraction_completed", "document.failed"],
});

await klaaro.updateWebhook(hook.id, {
  datasetId: "a1b2c3d4-...",
  events: ["document.extraction_completed"],
});

const { secret } = await klaaro.rotateWebhookSecret(hook.id, { datasetId: "a1b2c3d4-..." });

await klaaro.deleteWebhook(hook.id, { datasetId: "a1b2c3d4-..." });
```

### Webhook signature verification

```ts
import { createHmac } from "crypto";

function verifyWebhook(rawBody: string, sigHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return expected === signature;
}
```

## Pagination

All list methods accept `{ limit, cursor }` and return `{ data, meta: { nextCursor, hasMore } }`.

```ts
let cursor: string | undefined;
do {
  const page = await klaaro.listDatasetRecords("a1b2c3d4-...", { cursor, limit: 200 });
  for (const record of page.data) {
    // process
  }
  cursor = page.meta.hasMore ? (page.meta.nextCursor ?? undefined) : undefined;
} while (cursor);
```

## Error handling

```ts
import { KlaaroApiError } from "klaaro";

try {
  await klaaro.getDocument("missing-id");
} catch (err) {
  if (err instanceof KlaaroApiError) {
    console.error(err.status, err.code, err.message);
    // 404 "document_not_found" "Document not found"
  }
}
```

| Code                  | Status | Meaning                          |
| --------------------- | ------ | -------------------------------- |
| `not_authenticated`   | 401    | Missing / invalid API key        |
| `api_key_required`    | 401    | Session auth rejected on v1      |
| `insufficient_scope`  | 403    | Key missing required scope       |
| `dataset_not_found`   | 404    | Dataset not found or inaccessible|
| `document_not_found`  | 404    | Document not found               |
| `record_not_found`    | 404    | Record not found                 |
| `validation_error`    | 400    | Invalid request parameter        |
| `rate_limited`        | 429    | Too many requests                |
| `internal_error`      | 500    | Unexpected server error          |

## License

MIT
