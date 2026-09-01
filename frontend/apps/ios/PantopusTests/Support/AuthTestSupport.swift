//
//  AuthTestSupport.swift
//  PantopusTests
//
//  Shared helpers for the persistent-login tests: a scripted presence gate,
//  request-body / DPoP-proof readers for `SequencedURLProtocol.capturedRequests`.
//

import CryptoKit
import Foundation
import XCTest
@testable import Pantopus

/// `PresenceGate` that returns a scripted outcome (and counts calls).
final class FakePresenceGate: PresenceGate, @unchecked Sendable {
    private let lock = NSLock()
    private var _outcome: PresenceOutcome
    private(set) var calls = 0
    private(set) var lastReason: String?

    init(_ outcome: PresenceOutcome) {
        _outcome = outcome
    }

    var outcome: PresenceOutcome {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _outcome
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _outcome = newValue
        }
    }

    /// Mirrors `LAContext.canEvaluatePolicy`: false only when scripted
    /// `.unavailable` (no passcode, no biometrics).
    var isAvailable: Bool {
        outcome != .unavailable
    }

    @MainActor
    func verify(reason: String) async -> PresenceOutcome {
        lock.lock()
        defer { lock.unlock() }
        calls += 1
        lastReason = reason
        return _outcome
    }
}

/// A decoded `DPoP` header: JOSE header members, payload, and the JWK
/// thumbprint of the embedded key. `signatureValid` is checked against
/// the embedded JWK.
struct DecodedDPoP {
    let typ: String?
    let alg: String?
    let jwk: JWK
    let payload: DPoPProofBuilder.Payload
    let signatureValid: Bool

    var thumbprint: String {
        jwk.thumbprint
    }

    init?(jwt: String) {
        guard let parts = DPoPProofBuilder.decodeParts(jwt),
              let header = try? JSONSerialization.jsonObject(with: parts.header) as? [String: Any],
              let jwkObject = header["jwk"],
              let jwkData = try? JSONSerialization.data(withJSONObject: jwkObject),
              let jwk = try? JSONDecoder().decode(JWK.self, from: jwkData),
              let payload = try? JSONDecoder().decode(DPoPProofBuilder.Payload.self, from: parts.payload) else {
            return nil
        }
        typ = header["typ"] as? String
        alg = header["alg"] as? String
        self.jwk = jwk
        self.payload = payload
        let signingInput = Data(jwt.split(separator: ".").prefix(2).joined(separator: ".").utf8)
        if let x = Base64URL.decode(jwk.x), let y = Base64URL.decode(jwk.y),
           let publicKey = try? P256.Signing.PublicKey(x963Representation: Data([0x04]) + x + y),
           let signature = try? P256.Signing.ECDSASignature(rawRepresentation: parts.signature) {
            signatureValid = publicKey.isValidSignature(signature, for: signingInput)
        } else {
            signatureValid = false
        }
    }
}

extension URLRequest {
    /// `URLProtocol`-stubbed sessions move the body onto `httpBodyStream`;
    /// drain it so assertions don't flake.
    func authTestBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }

    /// The JSON object body, if any.
    func authTestJSONBody() -> [String: Any]? {
        guard let data = authTestBodyData() else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// The decoded `DPoP` header, if present and well-formed.
    func authTestDPoP() -> DecodedDPoP? {
        value(forHTTPHeaderField: APIClient.dpopHeader).flatMap(DecodedDPoP.init(jwt:))
    }
}

extension SequencedURLProtocol {
    /// Captured requests whose URL path equals `path`, in send order.
    static func captured(path: String) -> [URLRequest] {
        capturedRequests.filter { $0.url?.path == path }
    }
}
