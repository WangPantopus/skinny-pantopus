//
//  UserSocialDTOs.swift
//  Pantopus
//
//  T3 — response bodies for the follow graph and the profile-picture
//  upload. All snake_case keys are mapped explicitly (APIClient does not
//  apply `convertFromSnakeCase`).
//

import Foundation

/// `POST` / `DELETE /api/users/:id/follow` response —
/// `backend/routes/users.js:3583` and `:3609`.
public struct UserFollowResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let following: Bool?

    private enum CodingKeys: String, CodingKey {
        case message, following
    }
}

/// `GET /api/users/:id/relationship` response —
/// `backend/routes/users.js:3697`.
public struct UserRelationshipResponse: Decodable, Sendable, Hashable {
    /// One of `none | pending_sent | pending_received | connected | blocked`.
    public let relationship: String?
    /// Does the viewer follow this profile?
    public let following: Bool?
    /// Does this profile follow the viewer?
    public let followedBy: Bool?

    private enum CodingKeys: String, CodingKey {
        case relationship, following
        case followedBy = "followed_by"
    }
}

/// The trimmed `User` row echoed back by the profile-picture upload.
public struct ProfilePictureUser: Decodable, Sendable, Hashable {
    public let id: String
    public let profilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case profilePictureURL = "profile_picture_url"
    }
}

/// `POST /api/upload/profile-picture` response —
/// `backend/routes/upload.js:293`.
public struct ProfilePictureUploadResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let url: String
    public let key: String?
    public let user: ProfilePictureUser?

    private enum CodingKeys: String, CodingKey {
        case message, url, key, user
    }
}
