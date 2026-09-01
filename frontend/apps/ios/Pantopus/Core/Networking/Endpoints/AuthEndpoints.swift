//
//  AuthEndpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for `backend/routes/users.js` auth routes and the
/// trusted-device registry router `backend/routes/authDevices.js`
/// (mounted at `/api/auth`). Wire contract: docs/persistent-login/CONTRACT.md.
public enum AuthEndpoints {
    /// Query parameter carrying the per-attempt OAuth CSRF nonce. Mirrors
    /// Android `OAuthSessionStore.NONCE_PARAM`.
    public static let oauthNonceParam = "app_nonce"

    /// `GET /api/users/oauth/:provider` — route
    /// `backend/routes/users.js:4006`.
    ///
    /// `nonce` rides on `redirectTo`; the backend only validates the
    /// `pantopus:` protocol and passes the URI through to Supabase, so it
    /// comes back on the callback where `AuthManager` verifies it.
    public static func oauthURL(provider: OAuthProvider, nonce: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/users/oauth/\(provider.rawValue)",
            query: ["redirectTo": "pantopus://auth/callback?\(oauthNonceParam)=\(nonce)"],
            authenticated: false
        )
    }

    /// `POST /api/users/oauth/callback` — route
    /// `backend/routes/users.js:4186`. Carries the device descriptor +
    /// DPoP so the new session is bound at issue.
    public static func exchangeOAuthCode(_ code: String, device: DeviceDescriptor? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/oauth/callback",
            body: OAuthCodeExchangeRequest(code: code, device: device),
            authenticated: false,
            requiresDPoP: device != nil
        )
    }

    /// `POST /api/users/oauth/token` — legacy fragment-token path.
    /// Route: `backend/routes/users.js:4083`.
    public static func exchangeOAuthToken(accessToken: String, refreshToken: String, device: DeviceDescriptor? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/oauth/token",
            body: OAuthTokenExchangeRequest(accessToken: accessToken, refreshToken: refreshToken, device: device),
            authenticated: false,
            requiresDPoP: device != nil
        )
    }

    /// `POST /api/users/oauth/native` — native id-token sign-in (Sign in
    /// with Apple / Google). Route `backend/routes/users.js:4274`.
    ///
    /// Declared now because the route and the wire shape are pinned by the
    /// contract; the app still signs in through the browser flow, so nothing
    /// calls this yet (native SIWA / Credential Manager is explicitly out of
    /// this implementation pass — see WORKLOG "NOT in this pass").
    public static func oauthNative(_ body: OAuthNativeRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/oauth/native",
            body: body,
            authenticated: false,
            requiresDPoP: body.device != nil
        )
    }

    /// `POST /api/users/login` — route `backend/routes/users.js:1603`.
    /// With a `device` the request also carries a DPoP proof; the server
    /// binds the session to that key (bind-at-issue only).
    public static func login(email: String, password: String, device: DeviceDescriptor? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/login",
            body: LoginRequest(email: email, password: password, device: device),
            authenticated: false,
            requiresDPoP: device != nil
        )
    }

    /// `POST /api/users/register` — route `backend/routes/users.js:1288`.
    public static func register(_ body: RegisterRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/register",
            body: body,
            authenticated: false
        )
    }

    /// `POST /api/users/refresh` — route `backend/routes/users.js:2102`.
    ///
    /// The DPoP proof (with `rth`) is attached by `AuthManager` via
    /// `headers` because it must hash *this* refresh token; the endpoint is
    /// therefore not flagged `requiresDPoP` (that path has no `rth`).
    public static func refresh(
        refreshToken: String?,
        deviceId: String? = nil,
        sessionId: String? = nil,
        headers: [String: String] = [:]
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/refresh",
            body: RefreshRequest(refreshToken: refreshToken, deviceId: deviceId, sessionId: sessionId),
            headers: headers,
            authenticated: false
        )
    }

    /// `POST /api/users/logout` — route `backend/routes/users.js:4708`.
    ///
    /// Sent unauthenticated by construction: at local sign-out the Bearer
    /// has already been dropped from `AuthManager`, so the caller passes the
    /// old access token (and the DPoP proof with `rth`) through `headers`.
    /// `others` / `global` need a live Bearer plus `X-Step-Up`
    /// (`revoke_sessions`) — also supplied via `headers`.
    public static func logout(_ body: LogoutRequest, headers: [String: String] = [:]) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/logout",
            body: body,
            headers: headers,
            authenticated: false
        )
    }

    /// `POST /api/users/reauthenticate` — route `backend/routes/users.js:1772`.
    /// Password re-check; the response now also mints a wildcard step-up
    /// token (`purpose: "generic"`). A 401 here is a wrong password, not a
    /// dead session (`verifiesCredential`).
    public static func reauthenticate(password: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/reauthenticate",
            body: ReauthenticateRequest(password: password),
            verifiesCredential: true
        )
    }

    /// `POST /api/users/forgot-password` — route `backend/routes/users.js:3470`.
    public static func forgotPassword(email: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/forgot-password",
            body: ForgotPasswordRequest(email: email),
            authenticated: false
        )
    }

    /// `POST /api/users/reset-password` — route `backend/routes/users.js:3520`.
    public static func resetPassword(token: String, newPassword: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/reset-password",
            body: ResetPasswordRequest(token: token, newPassword: newPassword),
            authenticated: false
        )
    }

    /// `POST /api/users/verify-email` — route `backend/routes/users.js:3388`.
    public static func verifyEmail(tokenHash: String, type: String = "signup") -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/verify-email",
            body: VerifyEmailRequest(tokenHash: tokenHash, type: type),
            authenticated: false
        )
    }

    /// `POST /api/users/resend-verification` — route `backend/routes/users.js:3322`.
    public static func resendVerification(email: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/resend-verification",
            body: ResendVerificationRequest(email: email),
            authenticated: false
        )
    }

    // MARK: - Trusted-device registry (`/api/auth`, backend/routes/authDevices.js)

    /// `POST /api/auth/challenge` — route `backend/routes/authDevices.js:211`
    /// (`/challenge`, unauthenticated, 30/15 m/IP). Nonce for `device_key`
    /// step-up / attestation.
    public static func challenge(purpose: AuthChallengePurpose) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/challenge",
            body: AuthChallengeRequest(purpose: purpose),
            authenticated: false
        )
    }

    /// `POST /api/auth/devices/register` — route `backend/routes/authDevices.js:226`
    /// (`/devices/register`). Bearer + DPoP whose thumbprint must equal the
    /// session's bound key. Metadata + push-token linkage only — never
    /// creates or rotates a binding. Idempotent.
    public static func registerDevice(_ body: RegisterDeviceRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/devices/register",
            body: body,
            requiresDPoP: true
        )
    }

    /// `GET /api/auth/devices` — route `backend/routes/authDevices.js:258`
    /// (`/devices`). Devices + web sessions + recent events.
    public static let devices = Endpoint(
        method: .get,
        path: "/api/auth/devices",
        cachePolicy: .reloadIgnoringLocalCacheData
    )

    /// `DELETE /api/auth/devices/:id` — route `backend/routes/authDevices.js:271`
    /// (`/devices/:id`). Bearer + `X-Step-Up` (`revoke_device`).
    public static func revokeDevice(id: String, stepUpToken: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/auth/devices/\(id)",
            headers: [APIClient.stepUpHeader: stepUpToken]
        )
    }

    /// `POST /api/auth/sessions/revoke-others` — route
    /// `backend/routes/authDevices.js:295` (`/sessions/revoke-others`). Bearer +
    /// `X-Step-Up` (`revoke_sessions`).
    public static func revokeOtherSessions(stepUpToken: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/sessions/revoke-others",
            headers: [APIClient.stepUpHeader: stepUpToken]
        )
    }

    /// `POST /api/auth/sessions/revoke-all` — route
    /// `backend/routes/authDevices.js:313` (`/sessions/revoke-all`, "Lockdown").
    /// Bearer + `X-Step-Up` (`revoke_sessions`); the client signs itself
    /// out afterwards.
    public static func revokeAllSessions(stepUpToken: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/sessions/revoke-all",
            headers: [APIClient.stepUpHeader: stepUpToken]
        )
    }

    /// `POST /api/auth/step-up` — route `backend/routes/authDevices.js:373`
    /// (`/step-up`, 10/15 m/user). Bearer only per CONTRACT: the route runs
    /// no DPoP middleware, and the `device_key` proof is the ES256 signature
    /// over the server challenge inside the body — not a transport header
    /// (Android sends none either). A 401 is a refused password / signature,
    /// not a dead session (`verifiesCredential`).
    public static func stepUp(_ body: StepUpRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/step-up",
            body: body,
            verifiesCredential: true
        )
    }

    /// `POST /api/auth/step-up-key` — route `backend/routes/authDevices.js:455`
    /// (`/step-up-key`). Bearer + DPoP (bound key); the session must be
    /// `interactive`. Enrols the biometry-bound public key.
    public static func enrolStepUpKey(_ body: StepUpKeyRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/auth/step-up-key",
            body: body,
            requiresDPoP: true
        )
    }

    /// `GET /api/auth/security-prefs` — route `backend/routes/authDevices.js:475`
    /// (`/security-prefs`).
    public static let securityPrefs = Endpoint(
        method: .get,
        path: "/api/auth/security-prefs",
        cachePolicy: .reloadIgnoringLocalCacheData
    )

    /// `PATCH /api/auth/security-prefs` — route `backend/routes/authDevices.js:485`
    /// (`/security-prefs`). Bearer + `X-Step-Up` (`change_security_prefs`).
    public static func updateSecurityPrefs(_ prefs: SecurityPrefs, stepUpToken: String) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/auth/security-prefs",
            body: prefs,
            headers: [APIClient.stepUpHeader: stepUpToken]
        )
    }

    /// `GET /api/auth/security-events?limit=50` — route
    /// `backend/routes/authDevices.js:507` (`/security-events`).
    ///
    /// The Devices screen renders the (unpaginated) `events` already
    /// embedded in `GET /api/auth/devices`; this is the paging endpoint a
    /// "See all activity" surface will use.
    public static func securityEvents(limit: Int = 50) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/auth/security-events",
            query: ["limit": String(limit)],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }
}
