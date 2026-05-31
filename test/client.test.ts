import { describe, it, expect, vi, beforeEach } from "vitest";
import { KlaaroClient, KlaaroApiError } from "../src/index.js";
import type { Dataset, Document, FlatRecord, RecordClean, Webhook } from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  });
}

const FAKE_KEY = "sk_testkey";

function makeClient() {
  return new KlaaroClient({ apiKey: FAKE_KEY, baseUrl: "https://api.example.com/v1" });
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("KlaaroClient constructor", () => {
  it("throws when apiKey is missing", () => {
    expect(() => new KlaaroClient({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("strips trailing slash from baseUrl", () => {
    const client = new KlaaroClient({ apiKey: FAKE_KEY, baseUrl: "https://api.example.com/v1/" });
    // internal baseUrl should not have trailing slash — exercise via a request
    const fetch = mockFetch(200, { data: [], meta: { nextCursor: null, hasMore: false } });
    vi.stubGlobal("fetch", fetch);
    client.listDatasets();
    const url: string = (fetch.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).not.toMatch(/\/$/);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

describe("datasets", () => {
  beforeEach(() => vi.unstubAllGlobals());

  const fakeDataset: Dataset = {
    id: "d1d1d1d1-0000-0000-0000-000000000001",
    slug: "invoices",
    name: "Invoices",
    description: "",
    documentCount: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("listDatasets sends GET /datasets with auth header", async () => {
    const fetch = mockFetch(200, { data: [fakeDataset], meta: { nextCursor: null, hasMore: false } });
    vi.stubGlobal("fetch", fetch);
    const client = makeClient();
    const result = await client.listDatasets({ limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.slug).toBe("invoices");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/datasets");
    expect(url).toContain("limit=10");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${FAKE_KEY}`);
  });

  it("getDataset sends GET /datasets/{id}", async () => {
    const fetch = mockFetch(200, fakeDataset);
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().getDataset(fakeDataset.id);
    expect(result.id).toBe(fakeDataset.id);
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain(`/datasets/${fakeDataset.id}`);
  });

  it("deleteDataset sends DELETE and returns void on 204", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().deleteDataset(fakeDataset.id);
    expect(result).toBeUndefined();
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

describe("documents", () => {
  beforeEach(() => vi.unstubAllGlobals());

  const fakeDoc: Document = {
    id: "doc1doc1-0000-0000-0000-000000000001",
    datasetId: "d1d1d1d1-0000-0000-0000-000000000001",
    datasetSlug: "invoices",
    filename: "invoice.pdf",
    fileType: "application/pdf",
    fileSize: 12345,
    status: "completed",
    currentStep: "done",
    class: { slug: "invoice", name: "Invoice" },
    error: null,
    ingestSourceDisplay: null,
    pipeline: { lastRunId: null, lastFinishedAt: null, fromStep: null },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("listDocuments sends GET /documents", async () => {
    const fetch = mockFetch(200, { data: [fakeDoc], meta: { nextCursor: null, hasMore: false } });
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().listDocuments({ datasetId: fakeDoc.datasetId, status: "completed" });
    expect(result.data[0]?.id).toBe(fakeDoc.id);
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain("status=completed");
  });

  it("uploadDocument with URL sends JSON body", async () => {
    const fetch = mockFetch(201, fakeDoc);
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().uploadDocument({
      datasetId: fakeDoc.datasetId,
      url: "https://example.com/invoice.pdf",
    });
    expect(result.id).toBe(fakeDoc.id);
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("uploadDocument with file sends FormData", async () => {
    const fetch = mockFetch(201, fakeDoc);
    vi.stubGlobal("fetch", fetch);
    const blob = new Blob(["pdf-content"], { type: "application/pdf" });
    await makeClient().uploadDocument({ datasetId: fakeDoc.datasetId, file: blob, filename: "invoice.pdf" });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("uploadDocument throws when neither file nor url", () => {
    expect(() =>
      makeClient().uploadDocument({ datasetId: fakeDoc.datasetId })
    ).toThrow("provide either file or url");
  });

  it("uploadDocument sends Idempotency-Key header", async () => {
    const fetch = mockFetch(201, fakeDoc);
    vi.stubGlobal("fetch", fetch);
    await makeClient().uploadDocument({
      datasetId: fakeDoc.datasetId,
      url: "https://example.com/inv.pdf",
      idempotencyKey: "my-key-123",
    });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("my-key-123");
  });

  it("getDocument sends GET /documents/{id}", async () => {
    const fetch = mockFetch(200, fakeDoc);
    vi.stubGlobal("fetch", fetch);
    await makeClient().getDocument(fakeDoc.id);
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain(`/documents/${fakeDoc.id}`);
  });
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

describe("records", () => {
  beforeEach(() => vi.unstubAllGlobals());

  const fakeRecord: RecordClean = {
    id: "rec1rec1-0000-0000-0000-000000000001",
    documentId: "doc1doc1-0000-0000-0000-000000000001",
    class: { slug: "invoice", name: "Invoice", schemaHash: "abc", classHash: "def" },
    data: { total: 100 },
  };

  it("getRecord sends GET /records/{id}", async () => {
    const fetch = mockFetch(200, fakeRecord);
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().getRecord(fakeRecord.id);
    expect(result.id).toBe(fakeRecord.id);
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain(`/records/${fakeRecord.id}`);
  });

  it("getRecordFlat sends GET /records-flat/{id}", async () => {
    const fetch = mockFetch(200, { ...fakeRecord, fields: {}, crossField: { validation: { violations: [], hasHard: false } }, comments: { count: 0, preview: [] }, approval: null, datasetId: "x", datasetSlug: "x", rowIndex: 0, sourcePage: null, createdAt: "", updatedAt: "" });
    vi.stubGlobal("fetch", fetch);
    await makeClient().getRecordFlat(fakeRecord.id);
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain(`/records-flat/${fakeRecord.id}`);
  });
});

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

describe("webhooks", () => {
  beforeEach(() => vi.unstubAllGlobals());

  const fakeWebhook: Webhook = {
    id: "wh000001-0000-0000-0000-000000000001",
    url: "https://my.app/hook",
    events: ["document.extraction_completed"],
    description: null,
    secretLast4: "abcd",
    lastDeliveryAt: null,
    lastStatus: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("createWebhook sends POST /webhooks", async () => {
    const fetch = mockFetch(201, fakeWebhook);
    vi.stubGlobal("fetch", fetch);
    const result = await makeClient().createWebhook({
      datasetId: "d1d1d1d1-0000-0000-0000-000000000001",
      url: "https://my.app/hook",
      events: ["document.extraction_completed"],
    });
    expect(result.id).toBe(fakeWebhook.id);
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  it("deleteWebhook sends DELETE /webhooks/{id}", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    vi.stubGlobal("fetch", fetch);
    await makeClient().deleteWebhook(fakeWebhook.id, { datasetId: "d1d1d1d1-0000-0000-0000-000000000001" });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("throws KlaaroApiError on 4xx with error body", async () => {
    const fetch = mockFetch(404, {
      error: { code: "document_not_found", message: "Document not found", requestId: "req-1" },
    });
    vi.stubGlobal("fetch", fetch);
    await expect(makeClient().getDocument("missing")).rejects.toMatchObject({
      name: "KlaaroApiError",
      status: 404,
      code: "document_not_found",
      requestId: "req-1",
    });
  });

  it("throws KlaaroApiError on 401", async () => {
    const fetch = mockFetch(401, {
      error: { code: "not_authenticated", message: "Authentication required." },
    });
    vi.stubGlobal("fetch", fetch);
    await expect(makeClient().listDatasets()).rejects.toMatchObject({
      status: 401,
      code: "not_authenticated",
    });
  });

  it("getOpenApiSpec does not send Authorization header", async () => {
    const fetch = mockFetch(200, { openapi: "3.1.0" });
    vi.stubGlobal("fetch", fetch);
    await makeClient().getOpenApiSpec();
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });
});
