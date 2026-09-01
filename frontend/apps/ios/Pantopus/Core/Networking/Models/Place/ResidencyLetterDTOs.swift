//
//  ResidencyLetterDTOs.swift
//  Pantopus
//
//  DTOs for `/api/homes/:id/residency-letters*` and the public
//  third-party check `/api/public/residency-letters/:code`.
//  Route: `backend/routes/residencyLetters.js`. Mirrors
//  `frontend/packages/api/src/endpoints/residencyLetters.ts`.
//
//  A T4 (verified-occupancy) resident issues a letter; the backend
//  freezes the printed facts + the exact PDF, and prints an unguessable
//  verification code on the letter. Letters are PERSONAL documents —
//  the API only ever returns the caller's own letters for a home.
//

import Foundation

public enum ResidencyLetterStatus: String, Sendable, Hashable {
    case issued
    case revoked
    case unknown
}

extension ResidencyLetterStatus: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ResidencyLetterStatus(rawValue: raw) ?? .unknown
    }
}

public struct ResidencyLetterAddress: Decodable, Sendable, Hashable {
    public let line1: String
    public let city: String?
    public let state: String?
    public let zipcode: String?
}

public struct ResidencyLetter: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let status: ResidencyLetterStatus
    public let purpose: String
    public let residentName: String
    public let address: ResidencyLetterAddress
    /// Printed on the letter; what third parties verify.
    public let letterCode: String
    public let verifyUrl: String
    public let issuedAt: String
    public let revokedAt: String?
    public let pdfSha256: String

    private enum CodingKeys: String, CodingKey {
        case id, status, purpose, address
        case homeId = "home_id"
        case residentName = "resident_name"
        case letterCode = "letter_code"
        case verifyUrl = "verify_url"
        case issuedAt = "issued_at"
        case revokedAt = "revoked_at"
        case pdfSha256 = "pdf_sha256"
    }
}

/// `POST /api/homes/:id/residency-letters` body.
public struct IssueResidencyLetterRequest: Encodable, Sendable, Hashable {
    public let purpose: String?

    public init(purpose: String?) {
        self.purpose = purpose
    }
}

/// `{ letter: … }` envelope (issue / revoke responses).
public struct ResidencyLetterResponse: Decodable, Sendable, Hashable {
    public let letter: ResidencyLetter
}

/// `{ letters: […] }` envelope (list response).
public struct ResidencyLettersResponse: Decodable, Sendable, Hashable {
    public let letters: [ResidencyLetter]
}

/// Public third-party check result — exactly what the paper shows.
/// Unknown codes come back as a uniform `{ valid: false }`.
public struct ResidencyLetterVerification: Decodable, Sendable, Hashable {
    public let valid: Bool
    public let status: ResidencyLetterStatus?
    public let residentName: String?
    public let address: ResidencyLetterAddress?
    public let purpose: String?
    public let issuedAt: String?
    public let revokedAt: String?

    private enum CodingKeys: String, CodingKey {
        case valid, status, purpose, address
        case residentName = "resident_name"
        case issuedAt = "issued_at"
        case revokedAt = "revoked_at"
    }
}
