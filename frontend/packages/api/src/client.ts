// ============================================================
// API CLIENT - Axios Configuration
// Connects frontend to backend API
// Supports both web (localStorage) and mobile (SecureStore etc.)
// ============================================================

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '@pantopus/types';
import { API_BASE_URL } from '@pantopus/utils';

// ============ PLATFORM DETECTION (AUTH-3.3) ============
// Web uses httpOnly cookies for auth; mobile continues using Bearer tokens.

const _autoIsReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
let _isReactNative = _autoIsReactNative;
let _isWeb = typeof window !== 'undefined' && !_isReactNative;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// ============ PLUGGABLE TOKEN STORAGE ============
// Allows different storage backends (localStorage for web, SecureStore for mobile)

const AUTH_TOKEN_KEY = 'pantopus_auth_token';
const REFRESH_TOKEN_KEY = 'pantopus_refresh_token';

export interface TokenStorage {
  getToken: () => string | null;
  setToken: (token: string) => void | Promise<void>;
  clearToken: () => void | Promise<void>;
  /** Optional: for persistent sessions. If not implemented, 401 will not trigger refresh. */
  getRefreshToken?: () => string | null;
  setRefreshToken?: (token: string) => void | Promise<void>;
  clearRefreshToken?: () => void | Promise<void>;
  saveSession?: (session: AuthSessionUpdate) => Promise<void>;
  clearSession?: () => Promise<void>;
}

export interface AuthSessionUpdate {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  userId?: string | null;
}

export interface AuthRefreshResult {
  status: 'success' | 'invalid' | 'transient';
  accessToken?: string | null;
  code?: string;
  message?: string;
  statusCode?: number;
}

export interface AuthClientEvent {
  type: 'session_refresh_ok' | 'session_refresh_failed' | 'session_invalidated';
  trigger?: string;
  status?: AuthRefreshResult['status'];
  code?: string;
  message?: string;
  statusCode?: number;
  reason?: string;
}

export interface ApiRequestConfig extends AxiosRequestConfig {
  // Background polling can opt into warn-level dev logging so transient
  // 5xxs do not trigger framework error overlays.
  suppressDevErrorOverlay?: boolean;
}

// ============ TOKEN-CHANGE EVENT EMITTER ============
// Tiny isomorphic emitter so consumers (e.g. SocketContext) can react to
// token mutations without polling.  Only the subscribe function is exported.

type TokenChangeHandler = (token: string | null) => void;
const _tokenChangeHandlers = new Set<TokenChangeHandler>();

function _emitTokenChange(token: string | null): void {
  for (const handler of _tokenChangeHandlers) {
    try { handler(token); } catch { /* listener must not break caller */ }
  }
}

/**
 * Subscribe to token mutations (set / clear / session apply).
 * Returns an unsubscribe function.
 */
export function onTokenChange(handler: TokenChangeHandler): () => void {
  _tokenChangeHandlers.add(handler);
  return () => { _tokenChangeHandlers.delete(handler); };
}

// In-memory token cache (always synchronous for interceptor access)
let _tokenCache: string | null = null;
let _refreshTokenCache: string | null = null;

// Default storage: on web, tokens are in httpOnly cookies (AUTH-3.3) so storage
// is a no-op. On mobile/SSR, use in-memory + localStorage fallback.
const defaultStorage: TokenStorage = {
  getToken: () => {
    // Web: token is in httpOnly cookie, not accessible to JS
    if (_isWeb) return null;
    if (_tokenCache) return _tokenCache;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        _tokenCache = localStorage.getItem(AUTH_TOKEN_KEY);
        return _tokenCache;
      } catch {
        return null;
      }
    }
    return null;
  },
  setToken: (token: string) => {
    // Web: token is set as httpOnly cookie by server
    if (_isWeb) return;
    _tokenCache = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // Keep in-memory token even if persistence fails.
      }
    }
  },
  clearToken: () => {
    // Web: cookie cleared via /logout endpoint
    if (_isWeb) return;
    _tokenCache = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {
        // no-op
      }
    }
  },
  getRefreshToken: () => {
    if (_isWeb) return null;
    if (_refreshTokenCache) return _refreshTokenCache;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        _refreshTokenCache = localStorage.getItem(REFRESH_TOKEN_KEY);
        return _refreshTokenCache;
      } catch {
        return null;
      }
    }
    return null;
  },
  setRefreshToken: (token: string) => {
    if (_isWeb) return;
    _refreshTokenCache = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } catch {
        // Keep in-memory token even if persistence fails.
      }
    }
  },
  clearRefreshToken: () => {
    if (_isWeb) return;
    _refreshTokenCache = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // no-op
      }
    }
  },
};

let _storage: TokenStorage = defaultStorage;

// Callback invoked on 401 (e.g. revoke local session, redirect to login)
let _onUnauthorized: (() => void | Promise<void>) | null = null;
let _onAuthEvent: ((event: AuthClientEvent) => void) | null = null;
const isDev = process.env.NODE_ENV !== 'production';

function redactSensitive(value: any): any {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  const sensitiveKeys = new Set([
    'password',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
  ]);

  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (sensitiveKeys.has(k)) {
      result[k] = '[REDACTED]';
      continue;
    }
    result[k] = typeof v === 'object' ? redactSensitive(v) : v;
  }
  return result;
}

function awaitMaybe<T>(value: T | Promise<T>): Promise<T> {
  return Promise.resolve(value);
}

function emitAuthEvent(event: AuthClientEvent): void {
  if (!_onAuthEvent) return;

  try {
    _onAuthEvent(event);
  } catch {
    // Auth telemetry must not break runtime auth behavior.
  }
}

/**
 * Configure the API client's token storage and auth behavior.
 * Call this once during app initialization.
 *
 * @param storage  - Token storage adapter (get/set/clear)
 * @param onUnauthorized - Called on 401 responses (e.g. navigate to login)
 * @param baseURL  - Override the API base URL (useful for mobile where localhost doesn't work)
 */
export function configureApiClient(options: {
  storage?: TokenStorage;
  onUnauthorized?: () => void | Promise<void>;
  onAuthEvent?: (event: AuthClientEvent) => void;
  baseURL?: string;
  /** Explicitly set the platform so the client uses the correct auth strategy.
   *  'mobile' → Bearer token auth (no CSRF needed).
   *  'web'    → cookie auth + CSRF header.
   *  Defaults to auto-detection via navigator.product. */
  platform?: 'web' | 'mobile';
}): void {
  if (options.storage) _storage = options.storage;
  if (options.onUnauthorized) _onUnauthorized = options.onUnauthorized;
  if (options.onAuthEvent) _onAuthEvent = options.onAuthEvent;
  if (options.baseURL) {
    apiClient.defaults.baseURL = options.baseURL;
  }
  if (options.platform === 'mobile') {
    _isReactNative = true;
    _isWeb = false;
  } else if (options.platform === 'web') {
    _isReactNative = false;
    _isWeb = true;
  }
}

export function getApiBaseUrl(): string {
  return apiClient.defaults.baseURL || API_BASE_URL;
}

// ============ TOKEN MANAGEMENT ============

export function getAuthToken(): string | null {
  if (_tokenCache) return _tokenCache;
  if (_storage.getToken()) return _storage.getToken();
  // Web: after page refresh _tokenCache is empty, but httpOnly cookies
  // still provide auth via the same-origin proxy. Detect an active session
  // from the JS-readable pantopus_session flag cookie so auth guards don't
  // redirect to login while valid cookies exist.
  if (_isWeb && getCookie('pantopus_session') === '1') return '__session__';
  return null;
}

/**
 * Check if the user has an active session without returning a token string.
 * Preferred for auth guards on web where the actual token is in httpOnly cookies.
 */
export function hasActiveSession(): boolean {
  return getAuthToken() !== null;
}

export function setAuthToken(token: string): void {
  _tokenCache = token; // always update in-memory cache immediately
  _storage.setToken(token);
  _emitTokenChange(token);
}

export function clearAuthToken(): void {
  _tokenCache = null;
  _storage.clearToken();
  if (_storage.clearRefreshToken) {
    _refreshTokenCache = null;
    _storage.clearRefreshToken();
  }
  _emitTokenChange(null);
}

export function setRefreshToken(token: string): void {
  _refreshTokenCache = token;
  if (_storage.setRefreshToken) _storage.setRefreshToken(token);
}

export function getRefreshToken(): string | null {
  if (_refreshTokenCache) return _refreshTokenCache;
  return _storage.getRefreshToken ? _storage.getRefreshToken() : null;
}

export async function applyAuthSession(session: AuthSessionUpdate): Promise<void> {
  _tokenCache = session.accessToken;
  if (session.refreshToken !== undefined) {
    _refreshTokenCache = session.refreshToken ?? null;
  }

  if (_storage.saveSession) {
    await _storage.saveSession(session);
    _emitTokenChange(session.accessToken);
    return;
  }

  const operations: Array<Promise<unknown>> = [
    awaitMaybe(_storage.setToken(session.accessToken)),
  ];

  if (session.refreshToken !== undefined) {
    if (session.refreshToken && _storage.setRefreshToken) {
      operations.push(awaitMaybe(_storage.setRefreshToken(session.refreshToken)));
    } else if (_storage.clearRefreshToken) {
      operations.push(awaitMaybe(_storage.clearRefreshToken()));
    }
  }

  await Promise.all(operations);
  _emitTokenChange(session.accessToken);
}

export async function clearAuthSession(): Promise<void> {
  _tokenCache = null;
  _refreshTokenCache = null;

  if (_storage.clearSession) {
    await _storage.clearSession();
    _emitTokenChange(null);
    return;
  }

  const operations: Array<Promise<unknown>> = [
    awaitMaybe(_storage.clearToken()),
  ];
  if (_storage.clearRefreshToken) {
    operations.push(awaitMaybe(_storage.clearRefreshToken()));
  }
  await Promise.all(operations);
  _emitTokenChange(null);
}

/**
 * Preload token from async storage into memory cache.
 * Call this on app startup (mobile) before any API calls.
 */
export function setTokenCache(token: string | null): void {
  _tokenCache = token;
  _emitTokenChange(token);
}

// ============ AXIOS INSTANCE ============

const apiClient: AxiosInstance = axios.create({
  // Web: use relative URLs so requests go through the Next.js rewrite
  // proxy (same-origin → cookies sent automatically, no CORS needed).
  // Mobile: use the full backend URL directly.
  baseURL: _isWeb ? '' : API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============ REQUEST INTERCEPTOR ============

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (_isWeb) {
      // Web: auth token is in httpOnly cookie, sent automatically via
      // same-origin proxy. Tell backend not to include tokens in JSON body.
      if (config.headers) {
        config.headers['x-token-transport'] = 'cookie';
      }
      // Attach CSRF token for mutating requests.
      const method = (config.method || '').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrf = getCookie('pantopus_csrf');
        if (csrf && config.headers) {
          config.headers['x-csrf-token'] = csrf;
        }
      }
    } else {
      // Mobile / SSR: use Bearer token from storage
      const token = _tokenCache || _storage.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (isDev) {
      console.info('[API request]', {
        method: config.method?.toUpperCase(),
        url: `${config.baseURL || ''}${config.url || ''}`,
        params: redactSensitive(config.params),
        data: redactSensitive(config.data),
      });
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// ============ TOKEN REFRESH MUTEX ============
// Prevents concurrent 401 responses from triggering parallel refresh attempts.
// The first 401 starts the refresh; subsequent 401s wait for the same promise.
let _refreshPromise: Promise<AuthRefreshResult> | null = null;

async function doTokenRefresh(): Promise<AuthRefreshResult> {
  // On web, the refresh token is in an httpOnly cookie sent automatically
  // via same-origin proxy. On mobile, it's in the in-memory / storage cache.
  const refreshToken = _isWeb ? 'cookie' : getRefreshToken();
  if (!refreshToken) {
    return { status: 'invalid', message: 'No refresh token available' };
  }

  // Use relative URL on web (same-origin proxy), absolute on mobile.
  // Raw axios avoids the response interceptor recursing on 401.
  const baseURL = _isWeb ? '' : (apiClient.defaults.baseURL || API_BASE_URL);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_isWeb) headers['x-token-transport'] = 'cookie';

  try {
    const { data } = await axios.post(
      `${baseURL}/api/users/refresh`,
      _isWeb ? {} : { refreshToken },
      { headers, timeout: 10000 }
    );
    const newAccess = (data as any)?.accessToken ?? (data as any)?.access_token;
    const newRefresh = (data as any)?.refreshToken ?? (data as any)?.refresh_token;
    const expiresAt = (data as any)?.expiresAt ?? (data as any)?.expires_at;

    if (newAccess) {
      await applyAuthSession({
        accessToken: newAccess,
        refreshToken: newRefresh ?? refreshToken,
        expiresAt,
      });
      return { status: 'success', accessToken: newAccess };
    }

    // Web: tokens are in httpOnly cookies (not in JSON body). A successful
    // response (ok: true) means cookies were refreshed — return sentinel.
    if (_isWeb && (data as any)?.ok) {
      return { status: 'success', accessToken: '__session__' };
    }

    return {
      status: 'invalid',
      message: 'Refresh response did not contain a usable session',
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const responseData: any = error.response?.data;
      const message = responseData?.error || responseData?.message || error.message;
      const code = responseData?.code;

      if (statusCode === 400 || statusCode === 401) {
        return { status: 'invalid', statusCode, code, message };
      }

      return { status: 'transient', statusCode, code, message };
    }

    return {
      status: 'transient',
      message: error instanceof Error ? error.message : 'Failed to refresh session',
    };
  }
}

export async function refreshAuthSession(options?: { trigger?: string }): Promise<AuthRefreshResult> {
  const trigger = options?.trigger ?? 'manual';

  if (!_refreshPromise) {
    _refreshPromise = doTokenRefresh().then(
      (result) => {
        if (result.status === 'success') {
          emitAuthEvent({
            type: 'session_refresh_ok',
            trigger,
            status: result.status,
          });
        } else {
          emitAuthEvent({
            type: 'session_refresh_failed',
            trigger,
            status: result.status,
            code: result.code,
            message: result.message,
            statusCode: result.statusCode,
          });
        }
        _refreshPromise = null;
        return result;
      },
      (error) => {
        _refreshPromise = null;
        throw error;
      }
    );
  }
  return _refreshPromise;
}

// ============ RESPONSE INTERCEPTOR ============

apiClient.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.info('[API response]', {
        status: response.status,
        url: `${response.config.baseURL || ''}${response.config.url || ''}`,
        data: redactSensitive(response.data),
      });
    }
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config;
    let refreshResult: AuthRefreshResult | null = null;
    let didInvalidateSession = false;

    // Handle 401 Unauthorized — try refresh token first for persistent sessions
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      const reqUrl = originalRequest.url || '';
      // Only skip refresh-and-retry for actual auth endpoints whose 401s are
      // expected (wrong credentials, expired codes, etc.). Use exact path
      // suffixes to avoid false positives like /login-history or /login-stats.
      const AUTH_ENDPOINT_SUFFIXES = [
        '/login',
        '/register',
        '/refresh',
        '/logout',
        '/oauth/callback',
        '/oauth/token',
      ];
      const normalizedUrl = reqUrl.split('?')[0];
      const isAuthEndpoint = AUTH_ENDPOINT_SUFFIXES.some(
        (suffix) => normalizedUrl === suffix || normalizedUrl.endsWith(suffix)
      );
      if (!isAuthEndpoint) {
        const refreshToken = getRefreshToken();
        // On web, refresh token is in httpOnly cookie (getRefreshToken returns null)
        // but doTokenRefresh will send it via withCredentials.
        const canRefresh = _isWeb || (refreshToken && _storage.getRefreshToken);
        if (canRefresh) {
          try {
            // Mutex: reuse in-flight refresh promise or start a new one
            refreshResult = await refreshAuthSession({ trigger: 'response_401' });
            if (refreshResult.status === 'success' && refreshResult.accessToken) {
              (originalRequest as any)._retry = true;
              // On web, auth is via httpOnly cookies — don't set a Bearer header.
              // On mobile, set the new access token.
              if (!_isWeb && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${refreshResult.accessToken}`;
              }
              return apiClient(originalRequest);
            }
          } catch {
            // Refresh threw unexpectedly — fall through to clear and redirect
            _refreshPromise = null;
          }
        }
        if (refreshResult?.status === 'invalid') {
          didInvalidateSession = true;
          emitAuthEvent({
            type: 'session_invalidated',
            trigger: 'response_401',
            reason: refreshResult.code || 'refresh_invalid',
            code: refreshResult.code,
            message: refreshResult.message,
            statusCode: refreshResult.statusCode,
          });
          if (_onUnauthorized) {
            try {
              await _onUnauthorized();
            } catch {
              // Unauthorized hooks are for cleanup/navigation only; they must
              // not replace the original API error observed by the caller.
            } finally {
              // Run after the hook so consumers can still read tokens for best-effort server logout.
              await clearAuthSession();
            }
          } else if (typeof window !== 'undefined' && window.location) {
            await clearAuthSession();
            window.location.href = '/login';
          } else {
            await clearAuthSession();
          }
        } else if (refreshResult?.status === 'transient') {
          // The refresh endpoint is temporarily unreachable (5xx, timeout, network).
          // The session may still be valid — don't clear it, but emit an event so
          // consumers know the 401 could not be resolved by refresh.
          emitAuthEvent({
            type: 'session_refresh_failed',
            trigger: 'response_401',
            status: 'transient',
            code: refreshResult.code,
            message: refreshResult.message,
            statusCode: refreshResult.statusCode,
          });
        }
      }
    }

    const responseData: any = error.response?.data;
    const detailsRaw: any = responseData?.details;
    const validationDetails: Array<{ field: string; message: string; code?: string }> = Array.isArray(detailsRaw)
      ? detailsRaw
          .map((detail: any) => {
            if (typeof detail === 'string') {
              return { field: '', message: detail };
            }
            if (detail?.message) {
              return {
                field: detail?.field || '',
                message: detail.message,
                code: detail?.code,
              };
            }
            return null as null;
          })
          .filter((detail): detail is { field: string; message: string; code?: string } => Boolean(detail))
      : [];

    const validationErrors: string[] = Array.isArray(detailsRaw)
      ? detailsRaw
          .map((detail: any) => {
            if (typeof detail === 'string') return detail;
            if (detail?.field && detail?.message) return `${detail.field}: ${detail.message}`;
            if (detail?.message) return detail.message;
            return null;
          })
          .filter(Boolean)
      : [];

    const isValidationError = error.response?.data?.error === 'Validation failed';
    const status = error.response?.status;
    const requestUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
    const isNetworkError = !error.response;
    const errorCode = typeof responseData?.error === 'string' ? responseData.error : error.code;
    const userFacingMessage = typeof responseData?.message === 'string' ? responseData.message : '';
    const machineError = typeof responseData?.error === 'string' ? responseData.error : '';
    const errorMessage = isValidationError && validationErrors.length > 0
      ? validationErrors[0]
      : (
          userFacingMessage ||
          machineError ||
          (isNetworkError ? `Network error: cannot reach API at ${requestUrl || API_BASE_URL}` : '') ||
          error.message ||
          'An error occurred'
        );

    if (isDev) {
      let responseSafe: unknown;
      try {
        responseSafe = redactSensitive(error.response?.data);
      } catch {
        responseSafe = error.response?.data ?? null;
      }
      const logPayload = {
        status: status ?? null,
        url: requestUrl || null,
        message: String(errorMessage || 'An error occurred'),
        code: error.code ?? null,
        networkError: isNetworkError,
        response: responseSafe,
      };
      const suppressDevErrorOverlay = Boolean(
        (error.config as ApiRequestConfig | undefined)?.suppressDevErrorOverlay
      );
      // console.error triggers red error overlays in Expo/RN and Next.js.
      // Background polling can opt into warn-level logging so transient 5xxs
      // do not take over the screen during normal app use.
      if (status && status >= 500 && !suppressDevErrorOverlay) {
        console.error('[API error]', logPayload);
      } else {
        console.warn('[API error]', logPayload);
      }
    }

    return Promise.reject({
      message: errorMessage,
      code: errorCode,
      statusCode: status,
      data: error.response?.data,
      validationErrors,
      validationDetails,
      authRefreshStatus: refreshResult?.status,
      authRefreshCode: refreshResult?.code,
      authRefreshStatusCode: refreshResult?.statusCode,
      authInvalidated: didInvalidateSession,
    });
  }
);

export default apiClient;

// ============ HELPER FUNCTIONS ============

export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  config?: ApiRequestConfig
): Promise<T> {
  const response = await apiClient.request<T>({
    method,
    url,
    data,
    ...config,
  });
  return response.data;
}

export async function get<T = any>(
  url: string,
  params?: any,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>('GET', url, undefined, { ...config, params });
}

export async function post<T = any>(
  url: string,
  data?: any,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>('POST', url, data, config);
}

/** POST with no body (e.g. like, save). Bypasses shared apiRequest to avoid any body/formData code path. */
export async function postNoBody<T = any>(url: string): Promise<T> {
  const response = await apiClient.request<T>({
    method: 'POST',
    url,
    data: undefined,
  });
  return response.data;
}

export async function put<T = any>(
  url: string,
  data?: any,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>('PUT', url, data, config);
}

export async function del<T = any>(
  url: string,
  data?: any,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>('DELETE', url, data, config);
}

export async function patch<T = any>(
  path: string,
  data?: any,
  config?: ApiRequestConfig
): Promise<T> {
  return apiRequest<T>('PATCH', path, data, config);
}


// ============ FILE UPLOAD HELPER ============

export async function uploadFile<T = any>(
  url: string,
  file: File,
  additionalData?: Record<string, any>
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  if (additionalData && typeof additionalData === 'object' && !Array.isArray(additionalData)) {
    Object.entries(additionalData).forEach(([key, value]: [string, any]) => {
      if (value === undefined || value === null) return;
      try {
        const str =
          typeof value === 'object'
            ? (() => {
                try {
                  return JSON.stringify(value);
                } catch {
                  return String(value);
                }
              })()
            : String(value);
        formData.append(key, str);
      } catch {
        // skip malformed entries
      }
    });
  }

  const response = await apiClient.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}
