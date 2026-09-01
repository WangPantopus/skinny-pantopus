//
//  HomeRecordsDTOs.swift
//  Pantopus
//
//  DTOs for the Phase-3 "Home Records" asset hub in
//  `backend/routes/mailboxV2Phase3.js` (mounted at `/api/mailbox/v2/p3`
//  — `backend/app.js:317`). These back the asset index, the per-asset
//  mail drill-down, and the auto-detect scan → suggestions → link flow.
//
//  Not to be confused with `RecordsDetailDTO` (the A17.10 mail-detail
//  body variant) — that one describes a single archival mail item.
//

import Foundation

/// One tracked home asset with its mail-link roll-up.
/// Route: `backend/routes/mailboxV2Phase3.js:214`.
public struct HomeAssetSummaryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    /// `appliance / structure / system / vehicle / other`.
    public let category: String?
    public let room: String?
    public let manufacturer: String?
    public let modelNumber: String?
    public let purchasedAt: String?
    public let warrantyExpires: String?
    /// Server-computed `active / expiring_soon / expired / none`
    /// (`warrantyStatus`, route line 167).
    public let warrantyStatus: String?
    public let linkedMailCount: Int?
    public let linkedGigCount: Int?
    public let photoUrl: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, category, room, manufacturer
        case modelNumber = "model_number"
        case purchasedAt = "purchased_at"
        case warrantyExpires = "warranty_expires"
        case warrantyStatus = "warranty_status"
        case linkedMailCount = "linked_mail_count"
        case linkedGigCount = "linked_gig_count"
        case photoUrl = "photo_url"
    }

    public init(
        id: String,
        name: String? = nil,
        category: String? = nil,
        room: String? = nil,
        manufacturer: String? = nil,
        modelNumber: String? = nil,
        purchasedAt: String? = nil,
        warrantyExpires: String? = nil,
        warrantyStatus: String? = nil,
        linkedMailCount: Int? = nil,
        linkedGigCount: Int? = nil,
        photoUrl: String? = nil
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.room = room
        self.manufacturer = manufacturer
        self.modelNumber = modelNumber
        self.purchasedAt = purchasedAt
        self.warrantyExpires = warrantyExpires
        self.warrantyStatus = warrantyStatus
        self.linkedMailCount = linkedMailCount
        self.linkedGigCount = linkedGigCount
        self.photoUrl = photoUrl
    }
}

/// Envelope for `GET /api/mailbox/v2/p3/records/assets` —
/// `{ assets, rooms }` (route line 230). `rooms` is the distinct room
/// list backing the filter chips.
public struct HomeAssetsResponse: Decodable, Sendable, Hashable {
    public let assets: [HomeAssetSummaryDTO]
    public let rooms: [String]?
}

/// A mail row linked to an asset. `GET /records/asset/:id/mail` returns
/// raw `Mail` rows (`select('*')`, route line 267) — only the columns
/// the drill-down list renders are modelled.
public struct AssetLinkedMailDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let subject: String?
    public let senderName: String?
    public let deliveredAt: String?
    public let category: String?

    private enum CodingKeys: String, CodingKey {
        case id, subject, category
        case senderName = "sender_name"
        case deliveredAt = "delivered_at"
    }

    public init(
        id: String,
        subject: String? = nil,
        senderName: String? = nil,
        deliveredAt: String? = nil,
        category: String? = nil
    ) {
        self.id = id
        self.subject = subject
        self.senderName = senderName
        self.deliveredAt = deliveredAt
        self.category = category
    }
}

/// A photo attached to an asset (`AssetPhoto` rows, route line 276).
public struct AssetPhotoDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let url: String?
    public let caption: String?
    public let takenAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, url, caption
        case takenAt = "taken_at"
    }
}

/// Envelope for `GET /api/mailbox/v2/p3/records/asset/:id/mail` —
/// `{ asset, mail, gigs, photos }` (route line 288). `gigs` is always
/// `[]` server-side today, so it is not modelled.
public struct AssetMailResponse: Decodable, Sendable, Hashable {
    public let asset: HomeAssetSummaryDTO
    public let mail: [AssetLinkedMailDTO]?
    public let photos: [AssetPhotoDTO]?
}

/// One auto-detect / suggestion hit mined out of recent mail
/// (route lines 360 and 408).
public struct AssetDetectionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let candidateName: String?
    public let candidateBrand: String?
    public let candidateModel: String?
    public let confidence: Double?
    public let sourceMailId: String
    public let sourceField: String?

    /// Detections have no server id — the source mail is the natural key.
    public var id: String {
        sourceMailId
    }

    private enum CodingKeys: String, CodingKey {
        case confidence
        case candidateName = "candidate_name"
        case candidateBrand = "candidate_brand"
        case candidateModel = "candidate_model"
        case sourceMailId = "source_mail_id"
        case sourceField = "source_field"
    }

    public init(
        candidateName: String? = nil,
        candidateBrand: String? = nil,
        candidateModel: String? = nil,
        confidence: Double? = nil,
        sourceMailId: String,
        sourceField: String? = nil
    ) {
        self.candidateName = candidateName
        self.candidateBrand = candidateBrand
        self.candidateModel = candidateModel
        self.confidence = confidence
        self.sourceMailId = sourceMailId
        self.sourceField = sourceField
    }
}

/// Wire body for `POST /api/mailbox/v2/p3/records/auto-detect` —
/// validator at `backend/routes/mailboxV2Phase3.js:26` (`homeId`
/// required).
public struct AutoDetectAssetsRequest: Encodable, Sendable {
    public let homeId: String

    public init(homeId: String) {
        self.homeId = homeId
    }
}

/// Envelope for `POST /api/mailbox/v2/p3/records/auto-detect` —
/// `{ detections, count }` (route line 372).
public struct AutoDetectAssetsResponse: Decodable, Sendable, Hashable {
    public let detections: [AssetDetectionDTO]?
    public let count: Int?
}

/// One unlinked-mail suggestion (route line 406).
public struct AssetSuggestionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let mail: AssetLinkedMailDTO
    public let detections: [AssetDetectionDTO]?

    public var id: String {
        mail.id
    }
}

/// Envelope for `GET /api/mailbox/v2/p3/records/suggestions` —
/// `{ suggestions }` (route line 419).
public struct AssetSuggestionsResponse: Decodable, Sendable, Hashable {
    public let suggestions: [AssetSuggestionDTO]?
}

/// Wire body for `POST /api/mailbox/v2/p3/records/link` — validator at
/// `backend/routes/mailboxV2Phase3.js:20`. `linkType` is one of
/// `manual / auto_detected / warranty / receipt / repair`.
public struct LinkMailToAssetRequest: Encodable, Sendable {
    public let mailId: String
    public let assetId: String
    public let linkType: String

    public init(mailId: String, assetId: String, linkType: String = "manual") {
        self.mailId = mailId
        self.assetId = assetId
        self.linkType = linkType
    }
}

/// A `MailAssetLink` row returned by `POST /records/link` (route line
/// 315). `id` is the only place the link primary key is exposed — the
/// asset-mail drill-down does **not** return it — so it is what the
/// undo/unlink affordance carries.
public struct MailAssetLinkDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let mailId: String?
    public let assetId: String?
    public let linkType: String?
    public let confidence: Double?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, confidence
        case mailId = "mail_id"
        case assetId = "asset_id"
        case linkType = "link_type"
        case createdAt = "created_at"
    }
}

/// Envelope for `POST /api/mailbox/v2/p3/records/link` — `{ link }`.
public struct LinkMailToAssetResponse: Decodable, Sendable, Hashable {
    public let link: MailAssetLinkDTO?
}

/// Envelope for `DELETE /api/mailbox/v2/p3/records/unlink/:id` —
/// `{ message: 'Unlinked' }` (route line 330).
public struct UnlinkMailFromAssetResponse: Decodable, Sendable, Hashable {
    public let message: String?
}
