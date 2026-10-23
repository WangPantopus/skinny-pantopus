//
//  LocalProfileEndpoints.swift
//  Pantopus
//
//  How neighbors see you: the signed-in person's Local Profile, the name and
//  photo other people see on their posts, comments, chats, tasks and notices.
//  A new photo is uploaded with `MultipartUploader.uploadLocalProfilePicture`.
//

import Foundation

public enum LocalProfileEndpoints {
    /// `GET /api/local-profiles/me` — your Local Profile, your account's name
    /// and photo, and whether each still follows the account.
    /// Route `backend/routes/localProfiles.js:372`.
    public static let me = Endpoint(method: .get, path: "/api/local-profiles/me")

    /// `PATCH /api/local-profiles/me` — set the name or photo neighbors see.
    /// Answers like `me`. Route `backend/routes/localProfiles.js:383`.
    public static func updateMe(_ body: LocalProfileUpdateRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/local-profiles/me", body: body)
    }
}

/// Body for `PATCH /api/local-profiles/me`: the name, the photo, or both.
public struct LocalProfileUpdateRequest: Encodable, Sendable, Equatable {
    public enum Photo: Sendable, Equatable {
        case unchanged
        /// No photo: neighbors see initials (`avatar_url: null`).
        case none
        /// The account's photo, or the one the profile has.
        case url(String)
    }

    public var displayName: String?
    public var photo: Photo

    public init(displayName: String? = nil, photo: Photo = .unchanged) {
        self.displayName = displayName
        self.photo = photo
    }

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case avatarURL = "avatar_url"
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        switch photo {
        case .unchanged: break
        case .none: try container.encodeNil(forKey: .avatarURL)
        case let .url(url): try container.encode(url, forKey: .avatarURL)
        }
    }
}
