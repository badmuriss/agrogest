export interface Env {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV: string;
  FRONTEND_ORIGIN: string;
  INFERENCE_PROVIDER: string;
  INFERENCE_REMOTE_ALLOWED: string;
  LOCAL_OCR_BASE_URL: string;
  LOCAL_VISION_BASE_URL?: string;
  LOCAL_VISION_MODEL?: string;
  LOCAL_VISION_REVISION?: string;
  LOCAL_VISION_API_KEY?: string;
  INFERENCE_TIMEOUT_MS: string;
  INFERENCE_MAX_OUTPUT_TOKENS: string;
  WORKERS_AI_ACCOUNT_ID?: string;
  WORKERS_AI_API_TOKEN?: string;
  WORKERS_AI_MODEL?: string;
  WORKERS_AI_TRANSPORT?: 'rest' | 'binding';
  AI?: Ai;
}
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'P0001') { super(message); this.status = status; this.code = code; }
}
export function ensure(value: unknown, message: string, status = 400, code = 'P0001'): asserts value {
  if (!value) throw new ApiError(message, status, code);
}
export const idString = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export const cents = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000_000;
export const textField = (value: unknown, max = 240): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const saoPauloDay = (now: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
