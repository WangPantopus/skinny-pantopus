import AuthenticationServices
import UIKit

enum OAuthWebAuthenticationError: Error {
    case cancelled
    case invalidCallback
    /// Missing / mismatched `app_nonce` — a forged or replayed callback.
    /// Mirrors Android `OAuthSessionStore.Callback.Rejected`.
    case rejectedCallback
    /// No web-auth session could start. Mirrors Android
    /// `OAuthSessionStore.Callback.BrowserUnavailable` (no Custom Tabs
    /// provider and no `ACTION_VIEW` handler); both map to `AuthError.unknown`.
    case unableToStart
}

@MainActor
final class OAuthWebAuthenticationCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "pantopus"
            ) { [weak self] callbackURL, error in
                defer { self?.session = nil }
                if let authenticationError = error as? ASWebAuthenticationSessionError,
                   authenticationError.code == .canceledLogin {
                    continuation.resume(throwing: OAuthWebAuthenticationError.cancelled)
                } else if let authenticationError = error {
                    continuation.resume(throwing: authenticationError)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: OAuthWebAuthenticationError.invalidCallback)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            guard session.start() else {
                self.session = nil
                continuation.resume(throwing: OAuthWebAuthenticationError.unableToStart)
                return
            }
        }
    }

    func cancel() {
        session?.cancel()
        session = nil
    }

    func presentationAnchor(for _: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let activeScene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        if let window = activeScene?.windows.first(where: \.isKeyWindow) ?? activeScene?.windows.first {
            return window
        }
        if let activeScene {
            return ASPresentationAnchor(windowScene: activeScene)
        }
        return UIWindow(frame: UIScreen.main.bounds)
    }
}
