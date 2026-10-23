//
//  LocalProfileDTOs.swift
//  Pantopus
//
//  `GET`/`PATCH /api/local-profiles/me` and
//  `POST /api/upload/local-profile-picture`
//  (`backend/utils/identityProfiles.js` ownLocalProfileView). The server
//  sends these keys in camelCase.
//

import Foundation

/// Your Local Profile as How neighbors see you shows it.
public struct OwnLocalProfileResponse: Decodable, Sendable, Hashable {
    /// What other people see.
    public let profile: Profile
    /// Your account's name and photo, for "Use my account name/photo".
    public let account: Account
    /// Whether each still follows your account: true until you choose another one for neighbors.
    public let followsAccount: Follows

    public struct Profile: Decodable, Sendable, Hashable {
        public let id: String
        public let handle: String?
        public let displayName: String
        public let avatarUrl: String?
    }

    public struct Account: Decodable, Sendable, Hashable {
        public let displayName: String
        public let avatarUrl: String?
    }

    public struct Follows: Decodable, Sendable, Hashable {
        public let displayName: Bool
        public let avatarUrl: Bool
    }
}
