//
//  AuthManager+OAuth.swift
//  Pantopus
//
//  Browser OAuth (Google / Apple) via ASWebAuthenticationSession.
//

import Foundation

extension AuthManager {
    /// User-visible copy for a rejected callback. Mirrors Android
    /// `OAuthSessionStore.REJECTED_MESSAGE`.
    static let oauthRejectedMessage = "Sign-in couldn't be verified. Please try again."

    /// 32 bytes = 256 bits of entropy, hex-encoded (URL-safe by construction).
    private static let oauthNonceBytes = 32

    private static let hexDigits: [Character] = Array("0123456789abcdef")

    /// Browser OAuth through `GET /api/users/oauth/:provider` (route
    /// `backend/routes/users.js:4006`) and `POST /api/users/oauth/callback`
    /// (route `backend/routes/users.js:4186`). Legacy fragment tokens fall
    /// back to `POST /api/users/oauth/token` (`:3792`).
    func signIn(with provider: OAuthProvider) async throws {
        do {
            // Per-attempt CSRF nonce: it rides on `redirectTo` and must come
            // back on the callback, so an authorization code from any other
            // source is never exchanged. Single-use is structural here — the
            // callback can only arrive through this session's one-shot
            // continuation, so there is no second delivery to replay (Android
            // has an exported intent filter and enforces it in
            // `OAuthSessionStore`).
            let nonce = Self.makeOAuthNonce()
            let response: OAuthURLResponse = try await apiClient.request(
                AuthEndpoints.oauthURL(provider: provider, nonce: nonce)
            )
            let coordinator = OAuthWebAuthenticationCoordinator()
            retainOAuthCoordinator(coordinator)
            defer { retainOAuthCoordinator(nil) }

            let callbackURL = try await coordinator.authenticate(at: response.url)
            guard Self.isOAuthCallback(callbackURL) else {
                throw OAuthWebAuthenticationError.invalidCallback
            }
            // Surfacing the rejection inline is safe here: the callback can
            // only arrive through this session's one-shot continuation, so a
            // hostile app cannot trigger it. Android's entry point is an
            // exported intent filter, so it records the unverifiable callback
            // without consuming the attempt and emits the same
            // `oauthRejectedMessage` copy when the attempt ends — see
            // `OAuthSessionStore.deliver` / `cancelIfAwaiting`.
            guard Self.oauthNonceMatches(callbackURL, expected: nonce) else {
                throw OAuthWebAuthenticationError.rejectedCallback
            }

            let loginResponse = try await exchangeOAuthCallback(callbackURL)
            try persistLoginResponse(loginResponse, method: provider == .apple ? .apple : .google)
        } catch OAuthWebAuthenticationError.cancelled {
            throw OAuthWebAuthenticationError.cancelled
        } catch OAuthWebAuthenticationError.rejectedCallback {
            throw AuthError.serverError(Self.oauthRejectedMessage)
        } catch let apiError as APIError {
            throw Self.mapGenericAuthError(apiError)
        } catch let authError as AuthError {
            throw authError
        } catch is OAuthWebAuthenticationError {
            throw AuthError.unknown
        } catch {
            throw AuthError.unknown
        }
    }

    static func isOAuthCallback(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "pantopus"
            && url.host?.lowercased() == "auth"
            && url.path == "/callback"
    }

    private static func makeOAuthNonce() -> String {
        var generator = SystemRandomNumberGenerator()
        var nonce = ""
        nonce.reserveCapacity(oauthNonceBytes * 2)
        for _ in 0..<oauthNonceBytes {
            let byte = UInt8.random(in: UInt8.min...UInt8.max, using: &generator)
            nonce.append(hexDigits[Int(byte >> 4)])
            nonce.append(hexDigits[Int(byte & 0x0F)])
        }
        return nonce
    }

    private static func oauthNonceMatches(_ url: URL, expected: String) -> Bool {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let presented = components?.queryItems?
            .first { $0.name == AuthEndpoints.oauthNonceParam }?.value
        guard let presented, !presented.isEmpty, !expected.isEmpty else { return false }
        return constantTimeEquals(expected, presented)
    }

    /// Never short-circuits on the first differing byte. Mirrors Android's
    /// `MessageDigest.isEqual`.
    private static func constantTimeEquals(_ expected: String, _ presented: String) -> Bool {
        let lhs = Array(expected.utf8)
        let rhs = Array(presented.utf8)
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for index in lhs.indices {
            difference |= lhs[index] ^ rhs[index]
        }
        return difference == 0
    }

    /// Exchange either `?code=` or legacy `#access_token&refresh_token`.
    /// Both carry the device descriptor (+ DPoP) so the new session is bound
    /// at issue, exactly like `/login`.
    private func exchangeOAuthCallback(_ callbackURL: URL) async throws -> LoginResponse {
        let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        let device = makeDeviceDescriptor()
        if let code = components?.queryItems?.first(where: { $0.name == "code" })?.value,
           !code.isEmpty {
            return try await apiClient.request(AuthEndpoints.exchangeOAuthCode(code, device: device))
        }

        let access = Self.fragmentParam(callbackURL.fragment, name: "access_token")
        let refresh = Self.fragmentParam(callbackURL.fragment, name: "refresh_token")
        if let access, !access.isEmpty, let refresh, !refresh.isEmpty {
            return try await apiClient.request(
                AuthEndpoints.exchangeOAuthToken(accessToken: access, refreshToken: refresh, device: device)
            )
        }
        throw OAuthWebAuthenticationError.invalidCallback
    }

    private static func fragmentParam(_ fragment: String?, name: String) -> String? {
        guard let fragment, !fragment.isEmpty else { return nil }
        for pair in fragment.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2, parts[0] == Substring(name) {
                return String(parts[1]).removingPercentEncoding ?? String(parts[1])
            }
        }
        return nil
    }
}
