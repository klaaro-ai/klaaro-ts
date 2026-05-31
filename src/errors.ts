export interface KlaaroErrorBody {
  code: string;
  message: string;
  param?: string;
  requestId?: string;
}

export class KlaaroApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly param: string | undefined;
  readonly requestId: string | undefined;

  constructor(status: number, body: KlaaroErrorBody) {
    super(body.message);
    this.name = "KlaaroApiError";
    this.status = status;
    this.code = body.code;
    this.param = body.param;
    this.requestId = body.requestId;
  }
}
