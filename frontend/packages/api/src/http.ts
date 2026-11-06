// ============================================================
// HTTP TRANSPORT - fetch
// The API client's requests, made with the browser's fetch under the rules
// they had with axios 1.x, which this replaces: the same URLs and query
// strings, headers, bodies, timeouts, cancellation, status checks, parsed
// responses and error codes. Nothing here knows about auth; client.ts does.
// ============================================================

export type HttpHeaderValue = string | number | boolean | null | undefined;
export type HttpHeaders = Record<string, HttpHeaderValue>;
export type HttpTransform = (data: any, headers: HttpHeaders) => any;

export interface HttpRequestConfig {
  url?: string;
  method?: string;
  baseURL?: string;
  /** Query parameters: arrays as `key[]=a&key[]=b`, nested objects as `key[sub]=v`; null and undefined are left out. */
  params?: any;
  data?: any;
  headers?: HttpHeaders;
  /** Milliseconds; 0 waits indefinitely. */
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  /** Which statuses resolve; the default is 2xx. Without one, every status resolves. */
  validateStatus?: ((status: number) => boolean) | null;
  /** Replaces the default body handling (JSON for objects, FormData and Blobs as they are). */
  transformRequest?: HttpTransform | HttpTransform[];
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  /** Response headers by lower-case name. */
  headers: Record<string, string>;
  config: HttpRequestConfig;
}

/**
 * A request that failed: `ERR_BAD_REQUEST` (4xx) or `ERR_BAD_RESPONSE` (5xx) with the
 * parsed `response`, `ERR_NETWORK`, `ECONNABORTED` (timed out) or `ERR_CANCELED`.
 */
export class HttpError extends Error {
  code?: string;
  config?: HttpRequestConfig;
  response?: HttpResponse;

  constructor(message: string, code?: string, config?: HttpRequestConfig, response?: HttpResponse) {
    super(message);
    this.name = code === 'ERR_CANCELED' ? 'CanceledError' : 'HttpError';
    this.code = code;
    this.config = config;
    this.response = response;
  }
}

const isCanceled = (error: unknown): boolean =>
  error instanceof HttpError && error.code === 'ERR_CANCELED';

function throwIfCanceled(config: HttpRequestConfig): void {
  if (config.signal?.aborted) throw new HttpError('canceled', 'ERR_CANCELED', config);
}

// ---------- headers (names match case-insensitively; the first spelling is kept) ----------

function headerKey(headers: HttpHeaders, name: string): string | undefined {
  const lower = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === lower);
}

function getHeader(headers: HttpHeaders, name: string): HttpHeaderValue {
  const key = headerKey(headers, name);
  return key === undefined ? undefined : headers[key];
}

/** With `onlyIfUnset`, keeps a header that already has a value. */
export function setHeader(headers: HttpHeaders, name: string, value: HttpHeaderValue, onlyIfUnset = false): void {
  const key = headerKey(headers, name);
  if (onlyIfUnset && key !== undefined && headers[key] !== undefined) return;
  headers[key ?? name] = value;
}

/** Later sources win; an undefined value unsets the header. */
export function mergeHeaders(...sources: Array<HttpHeaders | undefined>): HttpHeaders {
  const merged: HttpHeaders = {};
  for (const source of sources) {
    if (!source) continue;
    for (const name of Object.keys(source)) setHeader(merged, name.trim(), source[name]);
  }
  return merged;
}

// Header values go out as byte strings: other characters are dropped and the
// value trimmed, rather than failing the request.
function headerValue(value: HttpHeaderValue): string {
  return String(value).replace(/[^\t\x20-\x7e\x80-\xff]+/g, '').replace(/^[\t ]+|[\t ]+$/g, '');
}

// ---------- URLs and query strings ----------

const isAbsoluteURL = (url: string): boolean => /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);

/** The base URL joined to a relative request URL; absolute URLs are used as they are. */
export function buildFullPath(baseURL: string | undefined, url: string | undefined): string {
  const requested = url || '';
  if (!baseURL || isAbsoluteURL(requested)) return requested;
  if (!requested) return baseURL;
  return baseURL.replace(/\/+$/, '') + '/' + requested.replace(/^\/+/, '');
}

// encodeURIComponent, keeping `:`, `$` and `,` readable and spaces as `+`.
function encodeQuery(value: unknown): string {
  return encodeURIComponent(value as string)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null)
    && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

const isVisitable = (value: unknown): boolean => isPlainObject(value) || Array.isArray(value);
const withoutBrackets = (key: string | number): string | number =>
  typeof key === 'string' && key.endsWith('[]') ? key.slice(0, -2) : key;

function queryValue(value: unknown): unknown {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  if (value === true || value === false) return String(value);
  return value;
}

function queryKey(path: Array<string | number> | undefined, key: string | number): string | number {
  if (!path) return key;
  return path.concat(key).map((token, index) => {
    const name = withoutBrackets(token);
    return index ? `[${name}]` : name;
  }).join('');
}

function serializeParams(params: object): string {
  const pairs: string[] = [];
  const add = (key: string | number, value: unknown) => pairs.push(`${encodeQuery(key)}=${encodeQuery(queryValue(value))}`);
  const stack: unknown[] = [];

  // Returns true when the value's own entries are to be added under its key.
  function visit(value: any, key: string | number, path?: Array<string | number>): boolean {
    if (value && !path && typeof value === 'object') {
      if (typeof key === 'string' && key.endsWith('{}')) {
        value = JSON.stringify(value);
      } else {
        const list = Array.isArray(value) && !value.some(isVisitable) ? value
          : typeof key === 'string' && key.endsWith('[]') ? toArray(value) : null;
        if (list) {
          const name = `${withoutBrackets(key)}[]`;
          list.forEach((item: unknown) => { if (item !== undefined && item !== null) add(name, item); });
          return false;
        }
      }
    }
    if (isVisitable(value)) return true;
    add(queryKey(path, key), value);
    return false;
  }

  function build(value: any, path?: Array<string | number>): void {
    if (stack.indexOf(value) !== -1) throw new Error('Circular reference detected in ' + (path || []).join('.'));
    stack.push(value);
    const entries: Array<[string | number, unknown]> = Array.isArray(value)
      ? value.map((item, index) => [index, item])
      : Object.keys(value).map((key) => [key, value[key]]);
    for (const [key, item] of entries) {
      if (item === undefined || item === null) continue;
      if (visit(item, typeof key === 'string' ? key.trim() : key, path)) build(item, path ? path.concat(key) : [key]);
    }
    stack.pop();
  }

  build(params);
  return pairs.join('&');
}

function toArray(value: any): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value.length !== 'number') return null;
  return Array.from({ length: value.length }, (_, index) => value[index]);
}

/** The URL with `params` serialized onto it (after any query it already has). */
export function buildURL(url: string, params?: any): string {
  if (!params) return url;
  if (typeof params !== 'object') throw new TypeError('target must be an object');
  const query = typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams
    ? params.toString()
    : serializeParams(params);
  if (!query) return url;
  const hash = url.indexOf('#');
  const base = hash === -1 ? url : url.slice(0, hash);
  return base + (base.indexOf('?') === -1 ? '?' : '&') + query;
}

// ---------- request bodies ----------

const isFormData = (data: unknown): data is FormData =>
  typeof FormData !== 'undefined' && data instanceof FormData;

const isBinary = (data: unknown): boolean =>
  (typeof Blob !== 'undefined' && data instanceof Blob)
  || data instanceof ArrayBuffer
  || (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream);

// A JSON string goes as it is (trimmed); anything else is serialized.
function stringifySafely(value: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value.trim();
    } catch (error) {
      if ((error as Error)?.name !== 'SyntaxError') throw error;
    }
  }
  return JSON.stringify(value);
}

/**
 * The default body handling: objects (and anything sent as JSON) are serialized; FormData, Blobs and buffers
 * go as they are. Unlike axios, a plain object is never turned into a form (no caller sends one that way) and
 * FormData always goes as multipart.
 */
function transformRequestData(data: any, headers: HttpHeaders): any {
  if (isFormData(data) || isBinary(data)) return data;
  if (ArrayBuffer.isView(data)) return data.buffer;
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    setHeader(headers, 'Content-Type', 'application/x-www-form-urlencoded;charset=utf-8', true);
    return data.toString();
  }
  const contentType = String(getHeader(headers, 'Content-Type') || '');
  if ((data !== null && typeof data === 'object') || contentType.indexOf('application/json') > -1) {
    setHeader(headers, 'Content-Type', 'application/json', true);
    return stringifySafely(data);
  }
  return data;
}

// ---------- responses ----------

/** Text that parses as JSON becomes the parsed value; anything else stays as it came. */
function parseResponseData(data: unknown, responseType: HttpRequestConfig['responseType']): unknown {
  if (data && typeof data === 'string' && (!responseType || responseType === 'json')) {
    try { return JSON.parse(data); } catch { /* not JSON: keep the text */ }
  }
  return data;
}

// Typed as XMLHttpRequest typed a blob: the MIME type without its parameters,
// or text/xml when the response has none.
async function readBlob(response: Response): Promise<Blob> {
  const blob = await response.blob();
  const type = blob.type.split(';')[0] || 'text/xml';
  return type === blob.type ? blob : new Blob([blob], { type });
}

export function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => { headers[name] = value; });
  return headers;
}

const defaultValidateStatus = (status: number): boolean => status >= 200 && status < 300;

// ---------- the request ----------

export type HttpAdapter = (config: HttpRequestConfig) => Promise<HttpResponse>;

/** Sends the request with fetch and settles it by status. */
export const fetchAdapter: HttpAdapter = async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const url = buildURL(buildFullPath(config.baseURL, config.url), config.params);
  const headers = mergeHeaders(config.headers);
  const data = config.data;
  // The browser sets a FormData body's multipart boundary itself; nothing to send, no type.
  if (isFormData(data) || data === undefined) setHeader(headers, 'Content-Type', undefined);
  const sent = new Headers();
  for (const name of Object.keys(headers)) {
    const value = headers[name];
    if (value !== undefined && value !== null && value !== false) sent.set(name, headerValue(value));
  }

  const controller = new AbortController();
  let stopped: 'canceled' | 'timeout' | null = null;
  const cancel = () => { stopped = stopped || 'canceled'; controller.abort(); };
  const signal = config.signal;
  if (signal?.aborted) throw new HttpError('canceled', 'ERR_CANCELED', config);
  signal?.addEventListener('abort', cancel);
  const timeout = Number(config.timeout) || 0;
  const timer = timeout > 0
    ? setTimeout(() => { stopped = stopped || 'timeout'; controller.abort(); }, timeout)
    : undefined;

  let response: HttpResponse;
  try {
    const res = await fetch(url, {
      method,
      headers: sent,
      body: method === 'GET' || method === 'HEAD' ? undefined : (data || undefined),
      credentials: 'same-origin',
      signal: controller.signal,
    });
    const body = config.responseType === 'blob' ? await readBlob(res)
      : config.responseType === 'arraybuffer' ? await res.arrayBuffer()
        : await res.text();
    response = {
      data: parseResponseData(body, config.responseType),
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders(res),
      config,
    };
  } catch {
    if (stopped === 'canceled') throw new HttpError('canceled', 'ERR_CANCELED', config);
    if (stopped === 'timeout') throw new HttpError(`timeout of ${timeout}ms exceeded`, 'ECONNABORTED', config);
    throw new HttpError('Network Error', 'ERR_NETWORK', config);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }

  const validateStatus = config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) return response;
  throw new HttpError(
    'Request failed with status code ' + response.status,
    response.status >= 400 && response.status < 500 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE',
    config,
    response,
  );
};

/**
 * Runs one request: the body through `transformRequest` (by default
 * `transformRequestData`), then the adapter. The config the adapter, the
 * response and any error carry is a copy holding the sent body and headers.
 */
export async function dispatchRequest(input: HttpRequestConfig, adapter: HttpAdapter = fetchAdapter): Promise<HttpResponse> {
  const config: HttpRequestConfig = {
    ...input,
    method: (input.method || 'get').toLowerCase(),
    validateStatus: 'validateStatus' in input ? input.validateStatus : defaultValidateStatus,
  };
  throwIfCanceled(config);
  const headers = mergeHeaders(config.headers);
  config.headers = headers;
  const transforms = config.transformRequest === undefined ? [transformRequestData]
    : Array.isArray(config.transformRequest) ? config.transformRequest : [config.transformRequest];
  config.data = transforms.reduce((data, transform) => transform.call(config, data, headers), config.data);
  if (['post', 'put', 'patch'].indexOf(config.method as string) !== -1) {
    setHeader(headers, 'Content-Type', 'application/x-www-form-urlencoded', true);
  }

  let response: HttpResponse;
  try {
    response = await adapter(config);
  } catch (error) {
    if (!isCanceled(error)) throwIfCanceled(config);
    throw error;
  }
  throwIfCanceled(config);
  return response;
}
