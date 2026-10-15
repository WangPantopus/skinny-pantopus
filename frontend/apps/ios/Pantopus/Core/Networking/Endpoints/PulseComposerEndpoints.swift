//
//  PulseComposerEndpoints.swift
//  Pantopus
//
//  The routes behind the one-box composer (Pulse S8, contract §2.5, §2.6
//  and §2.10): a Pulse-mode `POST /api/posts`, the adult confirmation, and
//  PS's composer check, which the app reads fail-open.
//

import Foundation

public extension PulseEndpoints {
    /// `POST /api/posts` in Pulse mode (a body with `readScope`, contract
    /// §2.5). Route `backend/routes/posts.js` (`createPostSchema`, the
    /// Pulse branch in `services/pulse/compose.js`).
    static func createPulsePost(_ body: PulsePostCreateRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts", body: body)
    }

    /// `POST /api/pulse/adult-attestation` — "I'm 18 or older", stored once
    /// (contract §2.10). Route `backend/routes/pulse.js:200`.
    static func adultAttestation() -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/adult-attestation")
    }

    /// `POST /api/pulse/composer/check` — PS's suggestions and checks
    /// (contract §2.6). Not on `master` yet; the composer reads it
    /// fail-open, so an error or a missing route changes nothing.
    static func composerCheck(_ body: PulseComposerCheckRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/composer/check", body: body, timeout: 4)
    }
}

/// A Pulse-mode create body: only the fields Pulse mode reads (contract
/// §2.5). Device coordinates, homes and radius are never sent.
public struct PulsePostCreateRequest: Encodable, Sendable, Hashable {
    public let clientRequestId: String
    public let content: String
    public let postType: String
    public let readScope: String
    public let areaId: String?
    public let topic: String?
    public let locationName: String?
    public let claimMode: String?
    public let expiresAt: String?
    public let safetyAlertKind: String?
    public let eventDate: String?
    public let eventEndDate: String?
    public let lostFoundType: String?
}

/// `POST /api/posts` answer in Pulse mode: the created post as today's
/// endpoint returns it, plus `pulse` (contract §2.5).
public struct PulsePostCreateResponse: Decodable, Sendable, Hashable {
    public let postId: String?
    public let pulse: PulsePostDTO?

    private enum CodingKeys: String, CodingKey { case post, pulse }
    private struct Created: Decodable { let id: String }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pulse = container.lenient(PulsePostDTO.self, forKey: .pulse)
        postId = container.lenient(Created.self, forKey: .post)?.id ?? pulse?.id
    }
}

public struct PulseComposerCheckRequest: Encodable, Sendable, Hashable {
    public let text: String
    public let mediaCount: Int
    public let areaId: String?
    public let postType: String
    public let topic: String?
}

/// PS's answer (contract §2.6). Every part is optional: whatever this build
/// can't read is left out, and nothing here blocks posting by itself.
public struct PulseComposerCheckResponse: Decodable, Sendable, Hashable {
    public struct Suggest: Decodable, Sendable, Hashable {
        public let type: String?
        public let topic: String?
    }

    public struct Note: Decodable, Sendable, Hashable {
        public let code: String?
        public let message: String?
    }

    public struct Needs: Decodable, Sendable, Hashable {
        public let adultAttestation: Bool?
        public let audienceReview: Bool?

        private enum CodingKeys: String, CodingKey {
            case adultAttestation = "adult_attestation"
            case audienceReview = "audience_review"
        }
    }

    public let suggest: Suggest?
    public let suggestions: [Note]
    public let needs: Needs?

    private enum CodingKeys: String, CodingKey { case suggest, suggestions, needs }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        suggest = container.lenient(Suggest.self, forKey: .suggest)
        suggestions = container.lossyList(Note.self, forKey: .suggestions)
        needs = container.lenient(Needs.self, forKey: .needs)
    }
}

/// `POST /api/pulse/adult-attestation` → `{ attested_at }`.
public struct PulseAdultAttestationResponse: Decodable, Sendable, Hashable {
    public let attestedAt: String?

    private enum CodingKeys: String, CodingKey {
        case attestedAt = "attested_at"
    }
}
