//
//  HomePrivacyDTOs.swift
//  Pantopus
//
//  P3F / A14.2 — DTOs for the per-home privacy toggle set.
//  Route: `backend/routes/homePrivacy.js`.
//

import Foundation

/// `GET/PATCH /api/homes/:id/privacy` envelope — `{ privacy }`.
public struct HomePrivacyResponse: Decodable, Sendable, Hashable {
    public let privacy: HomePrivacyDTO
}

/// The 9 per-home privacy toggles + home id. Column names are the snake_case
/// of the camelCase toggle ids the `HomeSecurityViewModel` keys on.
public struct HomePrivacyDTO: Decodable, Sendable, Hashable {
    public let homeId: String
    public let guestApproval: Bool
    public let memberNameVisibility: Bool
    public let addressPrecision: Bool
    public let activityVisibility: Bool
    public let mapOptOut: Bool
    public let notificationPreviews: Bool
    public let docLock: Bool
    public let photoBlur: Bool
    public let vaultAutoLock: Bool

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case guestApproval = "guest_approval"
        case memberNameVisibility = "member_name_visibility"
        case addressPrecision = "address_precision"
        case activityVisibility = "activity_visibility"
        case mapOptOut = "map_opt_out"
        case notificationPreviews = "notification_previews"
        case docLock = "doc_lock"
        case photoBlur = "photo_blur"
        case vaultAutoLock = "vault_auto_lock"
    }

    /// Project into the `[rowId: Bool]` map the view-model keys on. Row ids
    /// are the camelCase toggle ids (`HomeSecurityViewModel.Toggles`).
    public var toggles: [String: Bool] {
        [
            "guestApproval": guestApproval,
            "memberNameVisibility": memberNameVisibility,
            "addressPrecision": addressPrecision,
            "activityVisibility": activityVisibility,
            "mapOptOut": mapOptOut,
            "notificationPreviews": notificationPreviews,
            "docLock": docLock,
            "photoBlur": photoBlur,
            "vaultAutoLock": vaultAutoLock
        ]
    }
}

/// PATCH body — only the changed toggle(s) are encoded (the camelCase row id
/// maps to its snake_case column). Mirrors `UpdateHomeTaskRequest`'s
/// omit-nil-on-the-wire pattern.
public struct UpdateHomePrivacyRequest: Encodable, Sendable {
    public let toggles: [String: Bool]

    public init(toggles: [String: Bool]) {
        self.toggles = toggles
    }

    private enum CodingKeys: String, CodingKey {
        case guestApproval = "guest_approval"
        case memberNameVisibility = "member_name_visibility"
        case addressPrecision = "address_precision"
        case activityVisibility = "activity_visibility"
        case mapOptOut = "map_opt_out"
        case notificationPreviews = "notification_previews"
        case docLock = "doc_lock"
        case photoBlur = "photo_blur"
        case vaultAutoLock = "vault_auto_lock"
    }

    private static let keyForRowId: [String: CodingKeys] = [
        "guestApproval": .guestApproval,
        "memberNameVisibility": .memberNameVisibility,
        "addressPrecision": .addressPrecision,
        "activityVisibility": .activityVisibility,
        "mapOptOut": .mapOptOut,
        "notificationPreviews": .notificationPreviews,
        "docLock": .docLock,
        "photoBlur": .photoBlur,
        "vaultAutoLock": .vaultAutoLock
    ]

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        for (rowId, value) in toggles {
            if let key = Self.keyForRowId[rowId] {
                try container.encode(value, forKey: key)
            }
        }
    }
}
