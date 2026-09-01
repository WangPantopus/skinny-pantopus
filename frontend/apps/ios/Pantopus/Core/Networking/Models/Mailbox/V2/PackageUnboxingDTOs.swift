//
//  PackageUnboxingDTOs.swift
//  Pantopus
//
//  DTOs for the Phase-2 package/unboxing writes in
//  `backend/routes/mailboxV2Phase2.js` (mounted at `/api/mailbox/v2/p2`,
//  `backend/app.js:316`). Three routes back the A17.14 Unboxing screen:
//
//  · `POST /p2/package/:mailId/unboxing`      (:1217) — record the
//    condition photo / unboxing video on the `MailPackage` row.
//  · `POST /p2/package/:mailId/save-warranty` (:1246) — flip
//    `warranty_saved` / `manual_saved` and auto-file to Home › Warranties.
//  · `POST /p2/package/:mailId/gig`           (:1280) — post the
//    assembly/help gig for the package.
//
//  All three take camelCase bodies, so synthesized `Encodable` keys match.
//

import Foundation

/// Wire body for `POST /api/mailbox/v2/p2/package/:mailId/unboxing` —
/// route `backend/routes/mailboxV2Phase2.js:1217`. `conditionPhotoUrl`
/// and `unboxingVideoUrl` must be absolute URIs (Joi `.uri()`), so the
/// caller uploads the capture first and passes the returned S3 URL.
public struct PackageUnboxingRequest: Encodable, Sendable {
    public let conditionPhotoUrl: String?
    public let unboxingVideoUrl: String?
    public let skip: Bool?

    public init(conditionPhotoUrl: String? = nil, unboxingVideoUrl: String? = nil, skip: Bool? = nil) {
        self.conditionPhotoUrl = conditionPhotoUrl
        self.unboxingVideoUrl = unboxingVideoUrl
        self.skip = skip
    }
}

/// Envelope for the unboxing write — `{ message, updates }`. Only the
/// message is modelled; `updates` echoes the column patch.
public struct PackageUnboxingResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// Wire body for `POST /api/mailbox/v2/p2/package/:mailId/save-warranty`
/// — route `backend/routes/mailboxV2Phase2.js:1246`. `type` is
/// `warranty` or `manual` (no Joi validator on this route; the handler
/// switches on the literal).
public struct PackageSaveWarrantyRequest: Encodable, Sendable {
    public let type: String

    public init(type: String) {
        self.type = type
    }
}

/// Envelope for the save-warranty write — `{ message, folder }` where
/// `folder` is the destination `VaultFolder` id when one exists.
public struct PackageSaveWarrantyResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let folder: String?
}

/// Wire body for `POST /api/mailbox/v2/p2/package/:mailId/gig` — route
/// `backend/routes/mailboxV2Phase2.js:1280`. `gigType` is required and
/// one of `hold / inside / sign / custom / assembly`
/// (`packageGigSchema`, :83).
public struct PackageGigRequest: Encodable, Sendable {
    public let gigType: String
    public let title: String?
    public let description: String?
    public let suggestedStart: String?
    public let compensation: Double?

    public init(
        gigType: String,
        title: String? = nil,
        description: String? = nil,
        suggestedStart: String? = nil,
        compensation: Double? = nil
    ) {
        self.gigType = gigType
        self.title = title
        self.description = description
        self.suggestedStart = suggestedStart
        self.compensation = compensation
    }
}

/// Envelope for the package-gig write — `{ message, gigId, title,
/// preDelivery }`.
public struct PackageGigResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let gigId: String?
    public let title: String?
    public let preDelivery: Bool?
}

/// Typed view of the `MailPackage` row returned by
/// `GET /api/mailbox/v2/package/:mailId` — route
/// `backend/routes/mailboxV2.js:634`. `PackageDetailResponse` keeps the
/// row untyped (`JSONValue`) for the A17.8 detail variant; the Unboxing
/// screen needs the Phase-2 columns added in
/// `backend/database/migrations/047_mailbox_phase2.sql:256`, so it
/// decodes them explicitly. Every field is optional — the row is written
/// incrementally by the carrier pipeline.
public struct UnboxingPackageDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let mailId: String?
    public let carrier: String?
    public let trackingIdMasked: String?
    /// `pre_receipt / in_transit / out_for_delivery / delivered / exception`.
    public let status: String?
    public let deliveryPhotoUrl: String?
    public let deliveryLocationNote: String?
    public let conditionPhotoUrl: String?
    public let unboxingVideoUrl: String?
    public let unboxingCompleted: Bool?
    public let warrantySaved: Bool?
    public let manualSaved: Bool?
    public let gigId: String?
    public let gigType: String?
    public let inferredItemName: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, carrier, status
        case mailId = "mail_id"
        case trackingIdMasked = "tracking_id_masked"
        case deliveryPhotoUrl = "delivery_photo_url"
        case deliveryLocationNote = "delivery_location_note"
        case conditionPhotoUrl = "condition_photo_url"
        case unboxingVideoUrl = "unboxing_video_url"
        case unboxingCompleted = "unboxing_completed"
        case warrantySaved = "warranty_saved"
        case manualSaved = "manual_saved"
        case gigId = "gig_id"
        case gigType = "gig_type"
        case inferredItemName = "inferred_item_name"
        case updatedAt = "updated_at"
    }
}

/// Typed envelope for `GET /api/mailbox/v2/package/:mailId` —
/// `{ package, timeline, sender }`. The Unboxing screen only reads the
/// package row and the sender display name.
public struct UnboxingPackageResponse: Decodable, Sendable, Hashable {
    public let package: UnboxingPackageDTO
    public let sender: Sender?

    public struct Sender: Decodable, Sendable, Hashable {
        public let display: String?
        public let trust: String?
    }
}
