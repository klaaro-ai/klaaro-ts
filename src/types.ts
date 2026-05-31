// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface ListMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

export interface ListParams {
  limit?: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export interface Dataset {
  id: string;
  slug: string;
  name: string;
  description: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaField {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  children?: SchemaField[];
  arrayItemType?: string;
  arrayItemFields?: SchemaField[];
  enumValues?: (string | number)[];
}

export interface Class {
  slug: string;
  name: string;
  description: string;
  color: string;
  schemaHash: string;
  classHash: string;
  fields: SchemaField[];
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export type DocumentStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface DocumentClassRef {
  slug: string | null;
  name: string | null;
}

export interface PipelineStatus {
  lastRunId: string | null;
  lastFinishedAt: string | null;
  fromStep: string | null;
}

export interface Document {
  id: string;
  datasetId: string;
  datasetSlug: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  currentStep: string;
  class: DocumentClassRef;
  error: string | null;
  ingestSourceDisplay: string | null;
  pipeline: PipelineStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListDocumentsParams extends ListParams {
  datasetId?: string;
  class?: string;
  status?: DocumentStatus;
  createdAfter?: string;
  createdBefore?: string;
}

export interface UploadDocumentParams {
  datasetId: string;
  /** File upload (browser File / Node Blob). Mutually exclusive with url. */
  file?: Blob | File;
  /** File name to use (required when file is a raw Blob). */
  filename?: string;
  /** URL to ingest from. Mutually exclusive with file. */
  url?: string;
  fixedClass?: string;
  idempotencyKey?: string;
  replaceDocumentId?: string;
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

export interface RecordClassRef {
  slug: string | null;
  name: string | null;
  schemaHash: string | null;
  classHash: string | null;
}

export type FieldAnnotationKind =
  | "corrected_unsure"
  | "confirmed_unsure"
  | "edited_unflagged"
  | "reviewed_unchanged";

export type FieldAnnotationTier = "bronze" | "silver" | "gold";

export interface FieldAnnotation {
  kind: FieldAnnotationKind;
  tier: FieldAnnotationTier;
  reviewerId: string | null;
  createdAt: string;
}

export type FieldActorKind = "user" | "api_key" | "model" | "system";

export interface FieldActor {
  kind: FieldActorKind;
  id: string | null;
  name: string | null;
}

export interface FieldReview {
  latestAnnotation: FieldAnnotation | null;
  isUnsure: boolean;
  openFlagId: string | null;
  commentCount: number;
  eventCount: number;
  lastActor: FieldActor | null;
  lastAt: string | null;
}

export interface FieldValidation {
  violations: Violation[];
  hasHard: boolean;
}

export interface Violation {
  ruleId: string;
  ruleKind: string;
  severity: "soft" | "hard";
  status: "fail" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export interface FieldExtraction {
  evidence: string | null;
  modelUnsure: boolean;
  modelNote: string | null;
}

export interface FieldSchemaInfo {
  type: string;
  required: boolean;
  description?: string;
  enumValues?: (string | number)[];
}

export interface FieldScores {
  selfConsistency: number | null;
  evidenceCoverage: number | null;
  schemaConformance: number | null;
  judgeScore: number | null;
  truthMatch: boolean | null;
}

export interface FieldView {
  path: string;
  fieldRoot: string;
  value: unknown;
  schema: FieldSchemaInfo | null;
  extraction: FieldExtraction;
  review: FieldReview;
  validation: FieldValidation;
  scores?: FieldScores;
}

export type ApprovalStatus = "pending" | "approved" | "approved_with_changes" | "rejected";

export interface ApprovalView {
  status: ApprovalStatus | null;
  triggeredBy: string[];
}

export interface QualityView {
  kqs: number | null;
  subScores: {
    null: number | null;
    unsure: number | null;
    validation: number | null;
    selfConsistency: number | null;
    judge: number | null;
  } | null;
  truthScore: number | null;
  schemaHash: string | null;
  computedAt: string | null;
}

export interface CommentView {
  id: string;
  body: string;
  author: {
    kind: "user" | "api_key";
    id: string | null;
    name: string | null;
  };
  createdAt: string;
}

/** Flat FieldView record (records / records-flat endpoints). */
export interface FlatRecord {
  id: string;
  documentId: string;
  datasetId: string;
  datasetSlug: string;
  rowIndex: number;
  class: RecordClassRef;
  sourcePage: number | null;
  createdAt: string;
  updatedAt: string;
  approval: ApprovalView | null;
  quality?: QualityView;
  fields: { [path: string]: FieldView };
  crossField: { validation: FieldValidation };
  comments: { count: number; preview: CommentView[] };
}

/** Nested record (records-nested endpoints). */
export interface RecordNested extends Omit<FlatRecord, "fields"> {
  data: unknown;
}

/** Clean extracted values only (no FieldView wrappers). */
export interface RecordClean {
  id: string;
  documentId: string;
  class: RecordClassRef;
  data: { [key: string]: unknown };
}

export interface ListRecordsParams extends ListParams {
  class?: string;
  approval?: ApprovalStatus;
  createdAfter?: string;
  createdBefore?: string;
}

export interface DocumentRecordsParams {
  includeUnapproved?: boolean;
}

// ---------------------------------------------------------------------------
// Record field events & comments
// ---------------------------------------------------------------------------

export interface FieldEvent {
  id: string;
  fieldPath: string;
  kind: string;
  body?: string;
  priorValue?: unknown;
  newValue?: unknown;
  actor: FieldActor;
  createdAt: string;
}

export interface ListFieldEventsParams extends ListParams {
  fieldPath?: string;
  kinds?: string;
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export type ApprovalEventAction =
  | "created_pending"
  | "auto_approved"
  | "approved"
  | "approved_with_changes"
  | "rejected"
  | "reset_to_pending";

export interface ApprovalEvent {
  id: string;
  action: ApprovalEventAction;
  actor: {
    kind: "user" | "api_key" | "system";
    id: string | null;
    name: string | null;
  };
  comment: string | null;
  createdAt: string;
}

export interface ApprovalQueueItem {
  recordId: string;
  documentId: string;
  documentFilename: string;
  classification: string | null;
  status: ApprovalStatus;
  triggeredBy: string[];
  assignedReviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListApprovalQueueParams extends ListParams {
  status?: ApprovalStatus;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "document.ocr_completed",
  "document.extraction_completed",
  "document.failed",
  "document.uploaded",
  "record.updated",
  "record.approved",
  "evaluation.completed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  description: string | null;
  secretLast4: string | null;
  lastDeliveryAt: string | null;
  lastStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookParams {
  datasetId: string;
  url: string;
  events: WebhookEvent[];
  description?: string;
}

export interface UpdateWebhookParams {
  datasetId: string;
  url?: string;
  events?: WebhookEvent[];
  description?: string | null;
}

export interface WebhookScopeParams {
  datasetId: string;
}
