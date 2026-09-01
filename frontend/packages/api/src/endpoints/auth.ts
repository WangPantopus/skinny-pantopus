// ============================================================
// AUTH ENDPOINTS
// Authentication and user registration
// Updated to support firstName, middleName, lastName
// ============================================================

import { get, post, applyAuthSession, clearAuthSession } from '../client';
import type { 
  User, 
  LoginForm, 
  RegisterForm, 
  SimpleRegisterForm,
  ApiResponse 
} from '@pantopus/types';

export interface AuthResponse {
  message: string;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresAt?: number;
  expires_at?: number;
  user: User;
  requiresEmailVerification?: boolean;
  /**
   * Legacy nested session (older backends) OR, per
   * docs/persistent-login/CONTRACT.md, `{ id, context }` for the new
   * server-side session registry. Both shapes are optional/additive.
   */
  session?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    id?: string;
    context?: 'interactive' | 'restored' | 'oauth';
  };
  /** Server-side session id (JWT `session_id`) — persistent-login contract. */
  sessionId?: string;
  /** Device registry echo for native clients that sent a `device` descriptor. */
  device?: {
    id: string;
    deviceId: string;
    isNew: boolean;
    trustLevel: 'trusted' | 'unverified' | 'suspect';
  } | null;
}

export interface AuthMethodsResponse {
  providers: string[];
  hasPassword: boolean;
}

/** Scopes for POST /api/users/logout (docs/persistent-login/CONTRACT.md). */
export type LogoutScope = 'local' | 'others' | 'global';

export interface LogoutOptions {
  /** `local` (default) signs out this session only; `others`/`global` need a step-up token. */
  scope?: LogoutScope;
  /** Opaque token from /api/auth/step-up or /api/users/reauthenticate (purpose `revoke_sessions`). */
  stepUpToken?: string;
}

/**
 * POST /api/users/reauthenticate — verifies the password and (persistent-login
 * contract) returns a wildcard-purpose step-up token usable as `X-Step-Up`.
 */
export interface ReauthenticateResponse extends ApiResponse {
  verified: boolean;
  stepUpToken?: string;
  expiresAt?: string | number;
  purpose?: 'generic' | string;
}

async function persistAuthResponse(response: AuthResponse): Promise<void> {
  const accessToken = (response as any).accessToken || response.token;
  if (!accessToken) return;

  const refreshToken = (response as any).refreshToken ?? (response as any).refresh_token ?? null;
  const expiresAt = (response as any).expiresAt ?? (response as any).expires_at ?? null;

  await applyAuthSession({
    accessToken,
    refreshToken,
    expiresAt,
    userId: response.user?.id ?? null,
  });
}

/**
 * Register a new user with all required fields
 */
export async function login(data: LoginForm): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/users/login', data);
  await persistAuthResponse(response);
  return response;
}

export async function register(data: RegisterForm): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/users/register', data);
  await persistAuthResponse(response);
  return response;
}
/**
 * Register a new user with simplified form (basic fields only)
 * Note: This will use placeholder values for missing required backend fields
 * Use this for quick prototyping or when you'll collect additional info later
 */
export async function registerSimple(data: SimpleRegisterForm & { invite_code?: string }): Promise<AuthResponse> {
  // Backend register route supports these core fields directly.
  const payload: Record<string, unknown> = {
    email: data.email,
    password: data.password,
    username: data.username,
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
  };
  if (data.invite_code) payload.invite_code = data.invite_code;

  return register(payload as any);
}

/**
 * Logout user.
 *
 * Default (`scope: 'local'`) keeps today's behaviour: POST first so the
 * backend can clear cookies / revoke the presented JWT, then clear local
 * state. `others` / `global` require a step-up token (sent as `X-Step-Up`);
 * `global` also signs THIS client out (server revokes everything).
 */
export async function logout(options: LogoutOptions = {}): Promise<ApiResponse & { revoked?: number }> {
  const scope: LogoutScope = options.scope ?? 'local';
  // `local` keeps the exact legacy request (no body) so old backends are unaffected.
  const body: Record<string, unknown> | undefined = scope === 'local' ? undefined : { scope };
  const config = options.stepUpToken
    ? { headers: { 'X-Step-Up': options.stepUpToken } }
    : undefined;
  const result = await post<ApiResponse & { revoked?: number }>('/api/users/logout', body, config);
  if (scope !== 'others') {
    await clearAuthSession();
  }
  return result;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<ApiResponse> {
  return post<ApiResponse>('/api/users/forgot-password', { email });
}

export async function reauthenticate(password: string): Promise<ReauthenticateResponse> {
  return post<ReauthenticateResponse>('/api/users/reauthenticate', { password });
}

export async function getAuthMethods(): Promise<AuthMethodsResponse> {
  return get<AuthMethodsResponse>('/api/users/auth-methods');
}

export async function updatePassword(data: {
  newPassword: string;
  currentPassword?: string | null;
}): Promise<ApiResponse & AuthMethodsResponse> {
  return post<ApiResponse & AuthMethodsResponse>('/api/users/password', data);
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  email?: string
): Promise<ApiResponse> {
  return post<ApiResponse>('/api/users/reset-password', {
    token,
    newPassword,
    email,
  });
}

/**
 * Verify email with token
 */
export async function verifyEmail(params: {
  tokenHash?: string;
  token?: string;
  email?: string;
  type?: 'signup' | 'email' | 'magiclink';
}): Promise<ApiResponse> {
  return post<ApiResponse>('/api/users/verify-email', params);
}

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<ApiResponse> {
  return post<ApiResponse>('/api/users/resend-verification', { email });
}

/**
 * Get OAuth redirect URL for a provider (google, apple)
 * @param redirectTo - Optional custom redirect URI (used by mobile apps)
 * @param flow - OAuth response flow: 'code' (default) or 'token'
 */
export async function getOAuthUrl(
  provider: 'google' | 'apple',
  redirectTo?: string,
  flow?: 'code' | 'token'
): Promise<{ url: string }> {
  const params = {
    ...(redirectTo ? { redirectTo } : {}),
    ...(flow ? { flow } : {}),
  };
  return get<{ url: string }>(`/api/users/oauth/${provider}`, params);
}

/**
 * Exchange OAuth authorization code for session
 */
export async function oauthCallback(code: string): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/users/oauth/callback', { code });
  await persistAuthResponse(response);
  return response;
}

/**
 * Verify OAuth access token (token flow) and ensure user profile exists
 */
export async function oauthTokenCallback(
  accessToken: string,
  refreshToken?: string | null
): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/users/oauth/token', {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
  });
  await persistAuthResponse(response);
  return response;
}
