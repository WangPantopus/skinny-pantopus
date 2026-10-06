//
//  AppleSignInCoordinator.swift
//  Pantopus
//
//  Native Sign in with Apple (the system sheet App Review expects on iOS).
//  The identity token is exchanged through `POST /api/users/oauth/native`;
//  Google stays on the browser flow in `AuthManager+OAuth.swift`.
//

import AuthenticationServices
import CryptoKit
import UIKit

/// What the Apple sheet hands back for `POST /api/users/oauth/native`.
struct AppleSignInCredential {
    let identityToken: String
    /// The unhashed nonce. Apple signs its SHA-256 into the token and the
    /// Auth server compares the two.
    let rawNonce: String
    /// Apple shares the name only on the first authorization.
    let givenName: String?
    let familyName: String?
}

enum AppleSignInError: Error {
    case cancelled
    /// The sheet can't run here: no Apple Account on the device, or
    /// Sign in with Apple is restricted or not set up for this build.
    case unavailable
    case failed
}

@MainActor
final class AppleSignInCoordinator: NSObject {
    private static let nonceBytes = 32

    private var continuation: CheckedContinuation<ASAuthorization, any Error>?
    private var controller: ASAuthorizationController?

    func signIn() async throws -> AppleSignInCredential {
        let rawNonce = Self.makeNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256Hex(rawNonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        defer { self.controller = nil }

        let authorization: ASAuthorization
        do {
            authorization = try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                controller.performRequests()
            }
        } catch let error as ASAuthorizationError {
            switch error.code {
            case .canceled: throw AppleSignInError.cancelled
            case .unknown, .notHandled, .notInteractive: throw AppleSignInError.unavailable
            default: throw AppleSignInError.failed
            }
        }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8),
              !identityToken.isEmpty
        else {
            throw AppleSignInError.failed
        }
        return AppleSignInCredential(
            identityToken: identityToken,
            rawNonce: rawNonce,
            givenName: credential.fullName?.givenName,
            familyName: credential.fullName?.familyName
        )
    }

    private func finish(_ result: Result<ASAuthorization, any Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }

    private static func makeNonce() -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<nonceBytes).map { _ in UInt8.random(in: UInt8.min...UInt8.max, using: &generator) }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

extension AppleSignInCoordinator: ASAuthorizationControllerDelegate {
    /// AuthenticationServices calls both on the main thread.
    nonisolated func authorizationController(
        controller _: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        MainActor.assumeIsolated { finish(.success(authorization)) }
    }

    nonisolated func authorizationController(controller _: ASAuthorizationController, didCompleteWithError error: any Error) {
        MainActor.assumeIsolated { finish(.failure(error)) }
    }
}

extension AppleSignInCoordinator: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for _: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
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
}
