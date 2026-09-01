//
//  Fixtures.swift
//  PantopusTests
//
//  Canonical JSON payloads + DTO builders for reuse across tests. Fixtures
//  mirror the real backend response shape; see the route citations on each
//  DTO under `Pantopus/Core/Networking/Models/`.
//

import Foundation
@testable import Pantopus

enum Fixtures {
    /// Historical test fixture — a `/api/users/me`-style user row. Kept for
    /// existing tests that exercise `UserDTO` directly. The real session
    /// flow uses `LoginResponse` / `ProfileResponse`.
    static let userJSON = """
    {
      "id": "u_123",
      "email": "alice@example.com",
      "display_name": "Alice",
      "avatar_url": null
    }
    """

    /// `POST /api/users/login` response fixture.
    static func loginJSON(
        accessToken: String = "at_test",
        refreshToken: String? = "rt_test"
    ) -> String {
        let refreshLine = refreshToken.map { "\"refreshToken\": \"\($0)\"," } ?? ""
        return """
        {
          "message": "Login successful",
          "accessToken": "\(accessToken)",
          \(refreshLine)
          "expiresIn": 3600,
          "expiresAt": 1800000000,
          "user": {
            "id": "u_123",
            "email": "alice@example.com",
            "username": "alice",
            "name": "Alice Doe",
            "firstName": "Alice",
            "middleName": null,
            "lastName": "Doe",
            "phoneNumber": null,
            "address": null,
            "city": null,
            "state": null,
            "zipcode": null,
            "accountType": "personal",
            "role": "member",
            "verified": true,
            "createdAt": "2025-01-01T00:00:00Z"
          }
        }
        """
    }

    /// Sample response from `GET /api/posts/feed` — one Ask post.
    static let feedJSON = """
    {
      "posts": [
        {
          "id": "p_1",
          "user_id": "u_123",
          "content": "Hello, neighborhood!",
          "created_at": "2026-04-20T10:00:00Z",
          "post_type": "ask_local",
          "like_count": 3,
          "comment_count": 1,
          "userHasLiked": false,
          "location_name": "Elm Park",
          "creator": {
            "id": "u_123",
            "username": "alice",
            "name": "Alice Doe",
            "first_name": "Alice",
            "last_name": "Doe",
            "profile_picture_url": null,
            "city": "Cambridge",
            "state": "MA",
            "account_type": "personal"
          }
        }
      ],
      "pagination": { "nextCursor": null, "hasMore": false }
    }
    """

    static var sampleUser: UserDTO {
        UserDTO(
            id: "u_123",
            email: "alice@example.com",
            displayName: "Alice",
            avatarURL: nil,
            isAdmin: false
        )
    }
}

final class InMemorySecureStore: SecureStore {
    private var storage: [String: String] = [:]
    func set(_ value: String, for key: String) throws {
        storage[key] = value
    }

    func get(_ key: String) -> String? {
        storage[key]
    }

    func delete(_ key: String) throws {
        storage.removeValue(forKey: key)
    }
}
