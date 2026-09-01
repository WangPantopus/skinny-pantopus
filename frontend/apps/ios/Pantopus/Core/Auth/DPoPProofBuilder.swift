//
//  DPoPProofBuilder.swift
//  Pantopus
//
//  Builds the `DPoP: <jwt>` proof (RFC 9449, ES256) that binds a request to
//  the device key. Wire shape pinned by docs/persistent-login/CONTRACT.md:
//
//    header : {"typ":"dpop+jwt","alg":"ES256","jwk":{kty,crv,x,y}}
//    payload: {"jti":uuid,"htm":"POST","htu":"<scheme>://<host>[:port]<path>",
//              "iat":<unix s>,"rth"?:base64url(sha256(refreshToken))}
//    sig    : raw r||s (64 bytes), base64url
//
//  `rth` is REQUIRED on `/api/users/refresh` and `/api/users/logout`
//  whenever a refresh token travels in the body — the proof is then
//  useless without that exact token and vice versa.
//

import CryptoKit
import Foundation

enum DPoPProofBuilder {
    enum BuildError: Error, Equatable {
        case invalidURL
    }

    /// Canonical `htu`: scheme + host (+ explicit port) + path, no query, no
    /// fragment. The server compares against `PUBLIC_API_BASE_URL + path`
    /// (or `<proto>://<host>` from the request when unset), so the client's
    /// own base URL is the right thing to hash — proxies do not matter.
    static func htu(for url: URL) -> String? {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else {
            return nil
        }
        let port = url.port.map { ":\($0)" } ?? ""
        let path = url.path.isEmpty ? "/" : url.path
        return "\(scheme)://\(host)\(port)\(path)"
    }

    /// `base64url(sha256(refreshToken))` — the `rth` claim.
    static func refreshTokenHash(_ refreshToken: String) -> String {
        Base64URL.encode(Data(SHA256.hash(data: Data(refreshToken.utf8))))
    }

    /// Assemble and sign a proof.
    ///
    /// - Parameters:
    ///   - signer: the device key (or a software key in tests).
    ///   - method: HTTP method, upper-cased on the wire.
    ///   - url: the full request URL; only scheme/host/port/path are used.
    ///   - refreshToken: when present, adds `rth`.
    ///   - jti / now: injectable for deterministic tests.
    static func build(
        signer: some DPoPSigner,
        method: String,
        url: URL,
        refreshToken: String? = nil,
        jti: UUID = UUID(),
        now: Date = Date()
    ) throws -> String {
        guard let htu = htu(for: url) else { throw BuildError.invalidURL }
        let header = Header(jwk: signer.jwk)
        let payload = Payload(
            jti: jti.uuidString.lowercased(),
            htm: method.uppercased(),
            htu: htu,
            iat: Int(now.timeIntervalSince1970),
            rth: refreshToken.map(refreshTokenHash)
        )
        let encoder = JSONEncoder()
        // Slashes must not be escaped (`\/`) — the server tolerates it, but
        // a stable byte layout keeps test vectors readable.
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let headerPart = try Base64URL.encode(encoder.encode(header))
        let payloadPart = try Base64URL.encode(encoder.encode(payload))
        let signingInput = "\(headerPart).\(payloadPart)"
        let signature = try signer.sign(Data(signingInput.utf8))
        return "\(signingInput).\(Base64URL.encode(signature))"
    }

    // MARK: - JOSE structures

    struct Header: Encodable {
        let typ = "dpop+jwt"
        let alg = "ES256"
        let jwk: JWK
    }

    struct Payload: Codable, Equatable {
        let jti: String
        let htm: String
        let htu: String
        let iat: Int
        let rth: String?
    }

    /// The three decoded segments of a compact JWT.
    struct Parts: Equatable {
        let header: Data
        let payload: Data
        let signature: Data
    }

    /// Split a compact JWT into its decoded parts — for tests and
    /// diagnostics only (the client never verifies its own proofs).
    static func decodeParts(_ jwt: String) -> Parts? {
        let parts = jwt.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let header = Base64URL.decode(String(parts[0])),
              let payload = Base64URL.decode(String(parts[1])),
              let signature = Base64URL.decode(String(parts[2])) else {
            return nil
        }
        return Parts(header: header, payload: payload, signature: signature)
    }
}
