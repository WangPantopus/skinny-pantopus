//
//  DPoPProofBuilderTests.swift
//  PantopusTests
//
//  Wire-shape tests for the DPoP proof (docs/persistent-login/CONTRACT.md
//  "Headers"): ES256 `dpop+jwt`, embedded JWK, `jti/htm/htu/iat/rth`,
//  raw `r || s` signature. Uses a software P-256 key so nothing touches
//  the Secure Enclave.
//

import CryptoKit
import XCTest
@testable import Pantopus

final class DPoPProofBuilderTests: XCTestCase {
    /// RFC 7515 Appendix A.3 EC P-256 key — a public test vector for the
    /// JWK `x`/`y` encoding.
    private static let rfc7515PrivateD = "jpsQnnGQmL-YBIffH1136cspYG6-0iY7X1fCE9-E9LI"
    private static let rfc7515X = "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU"
    private static let rfc7515Y = "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
    /// SHA-256 over `{"crv":"P-256","kty":"EC","x":…,"y":…}` of that key
    /// (computed independently with Python `hashlib`).
    private static let rfc7515Thumbprint = "oKIywvGUpTVTyxMQ3bwIIeQUudfr_CkLMjCE19ECD-U"

    private struct SoftwareSigner: DPoPSigner {
        let key: P256.Signing.PrivateKey
        var jwk: JWK {
            JWK(p256PublicKey: key.publicKey)
        }

        func sign(_ data: Data) throws -> Data {
            try key.signature(for: data).rawRepresentation
        }
    }

    private func rfcKey() throws -> P256.Signing.PrivateKey {
        let raw = try XCTUnwrap(Base64URL.decode(Self.rfc7515PrivateD))
        return try P256.Signing.PrivateKey(rawRepresentation: raw)
    }

    // MARK: - JWK

    func testJWKMatchesRFC7515Vector() throws {
        let jwk = try JWK(p256PublicKey: rfcKey().publicKey)
        XCTAssertEqual(jwk.kty, "EC")
        XCTAssertEqual(jwk.crv, "P-256")
        XCTAssertEqual(jwk.x, Self.rfc7515X)
        XCTAssertEqual(jwk.y, Self.rfc7515Y)
        XCTAssertEqual(jwk.thumbprint, Self.rfc7515Thumbprint)
    }

    func testJWKEncodesOnlyTheFourMembersWithoutPadding() throws {
        let jwk = try JWK(p256PublicKey: rfcKey().publicKey)
        let data = try JSONEncoder().encode(jwk)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])
        XCTAssertEqual(Set(object.keys), ["kty", "crv", "x", "y"])
        XCTAssertFalse(jwk.x.contains("="))
        XCTAssertFalse(jwk.x.contains("+"))
        XCTAssertFalse(jwk.x.contains("/"))
    }

    // MARK: - Base64URL

    func testBase64URLRoundTripsAllRemainders() {
        for length in 0..<10 {
            let bytes = Data((0..<length).map { UInt8(truncatingIfNeeded: $0 * 37 + 11) })
            let encoded = Base64URL.encode(bytes)
            XCTAssertFalse(encoded.contains("="), "no padding for length \(length)")
            XCTAssertEqual(Base64URL.decode(encoded), bytes)
        }
    }

    // MARK: - htu / rth

    func testHtuDropsQueryFragmentAndKeepsExplicitPort() throws {
        let url = try XCTUnwrap(URL(string: "https://API.pantopus.com:8443/api/users/refresh?x=1#frag"))
        XCTAssertEqual(DPoPProofBuilder.htu(for: url), "https://api.pantopus.com:8443/api/users/refresh")
        let plain = try XCTUnwrap(URL(string: "https://api.pantopus.com/api/users/login"))
        XCTAssertEqual(DPoPProofBuilder.htu(for: plain), "https://api.pantopus.com/api/users/login")
        let root = try XCTUnwrap(URL(string: "http://localhost:3000"))
        XCTAssertEqual(DPoPProofBuilder.htu(for: root), "http://localhost:3000/")
    }

    func testRefreshTokenHashIsBase64URLSHA256() {
        // sha256("rt-current"), base64url, no padding — computed independently.
        XCTAssertEqual(DPoPProofBuilder.refreshTokenHash("rt-current"), "l_Ys7FjaArkiMXH1FfG99yVy2j-GkmcNxMwFdBJi3qU")
    }

    // MARK: - Proof

    func testProofHeaderPayloadAndSignature() throws {
        let key = try rfcKey()
        let signer = SoftwareSigner(key: key)
        let url = try XCTUnwrap(URL(string: "https://api.pantopus.com/api/users/refresh?ignored=1"))
        let jti = try XCTUnwrap(UUID(uuidString: "6FA459EA-EE8A-3CA4-894E-DB77E160355E"))
        let now = Date(timeIntervalSince1970: 1_755_500_000)

        let jwt = try DPoPProofBuilder.build(
            signer: signer,
            method: "post",
            url: url,
            refreshToken: "rt-current",
            jti: jti,
            now: now
        )

        let parts = try XCTUnwrap(DPoPProofBuilder.decodeParts(jwt))
        let header = try XCTUnwrap(JSONSerialization.jsonObject(with: parts.header) as? [String: Any])
        XCTAssertEqual(header["typ"] as? String, "dpop+jwt")
        XCTAssertEqual(header["alg"] as? String, "ES256")
        let jwk = try XCTUnwrap(header["jwk"] as? [String: String])
        XCTAssertEqual(jwk, ["kty": "EC", "crv": "P-256", "x": Self.rfc7515X, "y": Self.rfc7515Y])

        let payload = try JSONDecoder().decode(DPoPProofBuilder.Payload.self, from: parts.payload)
        XCTAssertEqual(payload.jti, "6fa459ea-ee8a-3ca4-894e-db77e160355e")
        XCTAssertEqual(payload.htm, "POST")
        XCTAssertEqual(payload.htu, "https://api.pantopus.com/api/users/refresh")
        XCTAssertEqual(payload.iat, 1_755_500_000)
        XCTAssertEqual(payload.rth, "l_Ys7FjaArkiMXH1FfG99yVy2j-GkmcNxMwFdBJi3qU")

        // Raw r || s — 64 bytes, verifiable by CryptoKit against the JWK key.
        XCTAssertEqual(parts.signature.count, 64)
        let signingInput = try XCTUnwrap(jwt.split(separator: ".").prefix(2).joined(separator: ".").data(using: .utf8))
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: parts.signature)
        XCTAssertTrue(key.publicKey.isValidSignature(signature, for: signingInput))
    }

    func testProofOmitsRthWhenNoRefreshToken() throws {
        let signer = SoftwareSigner(key: P256.Signing.PrivateKey())
        let url = try XCTUnwrap(URL(string: "https://api.pantopus.com/api/users/login"))
        let jwt = try DPoPProofBuilder.build(signer: signer, method: "POST", url: url)
        let parts = try XCTUnwrap(DPoPProofBuilder.decodeParts(jwt))
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: parts.payload) as? [String: Any])
        XCTAssertNil(payload["rth"])
        XCTAssertEqual(Set(payload.keys), ["jti", "htm", "htu", "iat"])
    }

    func testEveryProofHasAFreshJti() throws {
        let signer = SoftwareSigner(key: P256.Signing.PrivateKey())
        let url = try XCTUnwrap(URL(string: "https://api.pantopus.com/api/auth/step-up"))
        let first = try DPoPProofBuilder.build(signer: signer, method: "POST", url: url)
        let second = try DPoPProofBuilder.build(signer: signer, method: "POST", url: url)
        let firstParts = try XCTUnwrap(DPoPProofBuilder.decodeParts(first))
        let secondParts = try XCTUnwrap(DPoPProofBuilder.decodeParts(second))
        let jti1 = try JSONDecoder().decode(DPoPProofBuilder.Payload.self, from: firstParts.payload).jti
        let jti2 = try JSONDecoder().decode(DPoPProofBuilder.Payload.self, from: secondParts.payload).jti
        XCTAssertNotEqual(jti1, jti2)
    }

    func testInvalidURLThrows() {
        let signer = SoftwareSigner(key: P256.Signing.PrivateKey())
        XCTAssertThrowsError(try DPoPProofBuilder.build(signer: signer, method: "POST", url: URL(fileURLWithPath: "/tmp/x"))) { error in
            XCTAssertEqual(error as? DPoPProofBuilder.BuildError, .invalidURL)
        }
    }
}
