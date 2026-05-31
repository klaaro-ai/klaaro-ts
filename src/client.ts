import { KlaaroApiError } from "./errors.js";
import type {
  ApprovalEvent,
  ApprovalQueueItem,
  Class,
  CommentView,
  CreateWebhookParams,
  Dataset,
  Document,
  DocumentRecordsParams,
  FieldEvent,
  FieldView,
  ListApprovalQueueParams,
  ListDocumentsParams,
  ListFieldEventsParams,
  ListParams,
  ListRecordsParams,
  ListResponse,
  FlatRecord,
  RecordClean,
  RecordNested,
  UpdateWebhookParams,
  UploadDocumentParams,
  Webhook,
  WebhookScopeParams,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://klaaro.ai/api/v1";

export interface KlaaroClientOptions {
  apiKey: string;
  /** Override the base URL (e.g. for dev: "https://dev.klaaro.ai/api/v1"). */
  baseUrl?: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class KlaaroClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: KlaaroClientOptions) {
    if (!options.apiKey) throw new Error("KlaaroClient: apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  // ---------------------------------------------------------------------------
  // Core request helper
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: {
      params?: object;
      body?: unknown;
      form?: FormData;
      noAuth?: boolean;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);

    if (options.params) {
      for (const [k, v] of Object.entries(options.params as Record<string, unknown>)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {};
    if (!options.noAuth) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    let bodyInit: BodyInit | undefined;
    if (options.form) {
      bodyInit = options.form;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      bodyInit = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: bodyInit,
    });

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const json = await response.json();

    if (!response.ok) {
      const err = (json as { error?: { code: string; message: string; param?: string; requestId?: string } }).error;
      throw new KlaaroApiError(response.status, {
        code: err?.code ?? "unknown_error",
        message: err?.message ?? `HTTP ${response.status}`,
        param: err?.param,
        requestId: err?.requestId,
      });
    }

    return json as T;
  }

  // ---------------------------------------------------------------------------
  // Datasets
  // ---------------------------------------------------------------------------

  listDatasets(params?: ListParams): Promise<ListResponse<Dataset>> {
    return this.request("GET", "/datasets", { params });
  }

  getDataset(id: string): Promise<Dataset> {
    return this.request("GET", `/datasets/${id}`);
  }

  deleteDataset(id: string): Promise<void> {
    return this.request("DELETE", `/datasets/${id}`);
  }

  listDatasetRecords(id: string, params?: ListRecordsParams): Promise<ListResponse<RecordClean>> {
    return this.request("GET", `/datasets/${id}/records`, { params });
  }

  listDatasetRecordsFlat(id: string, params?: ListRecordsParams): Promise<ListResponse<FlatRecord>> {
    return this.request("GET", `/datasets/${id}/records-flat`, { params });
  }

  listDatasetRecordsNested(id: string, params?: ListRecordsParams): Promise<ListResponse<RecordNested>> {
    return this.request("GET", `/datasets/${id}/records-nested`, { params });
  }

  listDatasetClasses(id: string): Promise<ListResponse<Class>> {
    return this.request("GET", `/datasets/${id}/classes`);
  }

  getDatasetClass(id: string, classSlug: string): Promise<Class> {
    return this.request("GET", `/datasets/${id}/classes/${encodeURIComponent(classSlug)}`);
  }

  listApprovalQueue(id: string, params?: ListApprovalQueueParams): Promise<ListResponse<ApprovalQueueItem>> {
    return this.request("GET", `/datasets/${id}/approval-queue`, { params });
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  listDocuments(params?: ListDocumentsParams): Promise<ListResponse<Document>> {
    return this.request("GET", "/documents", { params });
  }

  /**
   * Upload a document by file (multipart) or URL (JSON).
   * Provide either `file` (+ optional `filename`) or `url`, not both.
   */
  uploadDocument(params: UploadDocumentParams): Promise<Document> {
    const { datasetId, file, filename, url, fixedClass, idempotencyKey, replaceDocumentId } = params;

    if (file) {
      const form = new FormData();
      form.append("datasetId", datasetId);
      form.append("file", file, filename ?? (file instanceof File ? file.name : "upload"));
      if (fixedClass) form.append("fixedClassification", fixedClass);
      if (replaceDocumentId) form.append("replaceDocumentId", replaceDocumentId);
      return this.request("POST", "/documents", { form, idempotencyKey });
    }

    if (url) {
      return this.request("POST", "/documents", {
        body: { datasetId, url, fixedClass, idempotencyKey, replaceDocumentId },
        idempotencyKey,
      });
    }

    throw new Error("uploadDocument: provide either file or url");
  }

  getDocument(id: string): Promise<Document> {
    return this.request("GET", `/documents/${id}`);
  }

  deleteDocument(id: string): Promise<void> {
    return this.request("DELETE", `/documents/${id}`);
  }

  getDocumentRecords(id: string, params?: DocumentRecordsParams): Promise<{ records: RecordClean[]; class: { slug: string | null; name: string | null } }> {
    return this.request("GET", `/documents/${id}/records`, {
      params: params?.includeUnapproved !== undefined ? { includeUnapproved: params.includeUnapproved } : undefined,
    });
  }

  getDocumentRecordsFlat(id: string, params?: DocumentRecordsParams): Promise<{ records: FlatRecord[]; class: { slug: string | null; name: string | null } }> {
    return this.request("GET", `/documents/${id}/records-flat`, {
      params: params?.includeUnapproved !== undefined ? { includeUnapproved: params.includeUnapproved } : undefined,
    });
  }

  getDocumentRecordsNested(id: string, params?: DocumentRecordsParams): Promise<{ records: RecordNested[]; class: { slug: string | null; name: string | null } }> {
    return this.request("GET", `/documents/${id}/records-nested`, {
      params: params?.includeUnapproved !== undefined ? { includeUnapproved: params.includeUnapproved } : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // Records
  // ---------------------------------------------------------------------------

  getRecord(id: string): Promise<RecordClean> {
    return this.request("GET", `/records/${id}`);
  }

  getRecordFlat(id: string): Promise<FlatRecord> {
    return this.request("GET", `/records-flat/${id}`);
  }

  getRecordNested(id: string): Promise<RecordNested> {
    return this.request("GET", `/records-nested/${id}`);
  }

  listRecordFieldEvents(id: string, params?: ListFieldEventsParams): Promise<ListResponse<FieldEvent>> {
    return this.request("GET", `/records/${id}/field-events`, { params });
  }

  getRecordComments(id: string): Promise<ListResponse<CommentView>> {
    return this.request("GET", `/records/${id}/comments`);
  }

  getRecordApprovals(id: string): Promise<ListResponse<ApprovalEvent>> {
    return this.request("GET", `/records/${id}/approvals`);
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  listWebhooks(params: { datasetId: string } & ListParams): Promise<ListResponse<Webhook>> {
    return this.request("GET", "/webhooks", { params });
  }

  createWebhook(params: CreateWebhookParams): Promise<Webhook> {
    return this.request("POST", "/webhooks", { body: params });
  }

  updateWebhook(id: string, params: UpdateWebhookParams): Promise<Webhook> {
    return this.request("PATCH", `/webhooks/${id}`, { body: params });
  }

  deleteWebhook(id: string, params: WebhookScopeParams): Promise<void> {
    return this.request("DELETE", `/webhooks/${id}`, { body: params });
  }

  rotateWebhookSecret(id: string, params: WebhookScopeParams): Promise<{ secret: string }> {
    return this.request("POST", `/webhooks/${id}/rotate-secret`, { body: params });
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  /** Returns the raw OpenAPI JSON spec. Does not require authentication. */
  getOpenApiSpec(): Promise<unknown> {
    return this.request("GET", "/openapi", { noAuth: true });
  }
}
