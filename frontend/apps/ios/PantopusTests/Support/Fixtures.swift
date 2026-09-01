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

    /// `POST /api/users/login` response fixture. `sessionId` adds the
    /// persistent-login additive fields (`sessionId`, `session`, `device`).
    static func loginJSON(
        accessToken: String = "at_test",
        refreshToken: String? = "rt_test",
        sessionId: String? = nil,
        expiresAt: Int = 1_800_000_000
    ) -> String {
        let refreshLine = refreshToken.map { "\"refreshToken\": \"\($0)\"," } ?? ""
        let sessionLines = sessionId.map {
            """
            "sessionId": "\($0)",
              "session": { "id": "\($0)", "context": "interactive" },
              "device": { "id": "dev-row-1", "deviceId": "client-device", "isNew": true, "trustLevel": "unverified" },
            """
        } ?? ""
        return """
        {
          "message": "Login successful",
          "accessToken": "\(accessToken)",
          \(refreshLine)
          \(sessionLines)
          "expiresIn": 3600,
          "expiresAt": \(expiresAt),
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

    /// `GET /api/users/profile` response fixture (`ProfileResponse`).
    static func profileJSON(id: String = "u_123", email: String = "alice@example.com") -> String {
        """
        {"user":{
          "id":"\(id)","email":"\(email)","username":"alice",
          "firstName":"Alice","middleName":null,"lastName":"Doe","name":"Alice Doe",
          "phoneNumber":null,"dateOfBirth":null,
          "address":null,"city":null,"state":null,"zipcode":null,
          "accountType":"personal","role":"user","verified":true,
          "residency":null,"avatar_url":null,"profile_picture_url":null,"profilePicture":null,
          "bio":null,"tagline":null,"socialLinks":null,"skills":[],
          "followers_count":0,"average_rating":0,"gigs_posted":0,"gigs_completed":0,
          "profileVisibility":"public","createdAt":"2025-01-01T00:00:00Z","updatedAt":"2025-01-01T00:00:00Z"
        },"invite_progress":null}
        """
    }

    /// `POST /api/users/refresh` response fixture.
    static func refreshJSON(
        accessToken: String = "new-at",
        refreshToken: String = "new-rt",
        expiresAt: Int = 1_800_000_000,
        sessionId: String? = "sess-1"
    ) -> String {
        let session = sessionId.map { ",\"sessionId\":\"\($0)\",\"session\":{\"id\":\"\($0)\",\"context\":\"interactive\"}" } ?? ""
        return "{\"ok\":true,\"accessToken\":\"\(accessToken)\",\"refreshToken\":\"\(refreshToken)\","
            + "\"expiresIn\":3600,\"expiresAt\":\(expiresAt)\(session)}"
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

/// Test double for the Keychain. `@unchecked Sendable` because the two
/// dictionaries are guarded by `lock` — tests drive it from the main actor
/// and from detached tasks (`StepUpKey.sign`, `Task.detached` in the
/// manager) alike.
final class InMemorySecureStore: SecureStore, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: String] = [:]
    private var dataStorage: [String: Data] = [:]

    /// When set, every `set` / `setData` throws it — simulates a Keychain
    /// write failure.
    nonisolated(unsafe) var writeError: (any Error)?

    func set(_ value: String, for key: String) throws {
        if let writeError { throw writeError }
        lock.lock()
        defer { lock.unlock() }
        storage[key] = value
    }

    func get(_ key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    func delete(_ key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage.removeValue(forKey: key)
        dataStorage.removeValue(forKey: key)
    }

    func setData(_ value: Data, for key: String) throws {
        if let writeError { throw writeError }
        lock.lock()
        defer { lock.unlock() }
        dataStorage[key] = value
    }

    func getData(_ key: String) -> Data? {
        lock.lock()
        defer { lock.unlock() }
        return dataStorage[key]
    }

    /// Every stored key (string + data items) — for "wiped everything" asserts.
    var allKeys: Set<String> {
        lock.lock()
        defer { lock.unlock() }
        return Set(storage.keys).union(dataStorage.keys)
    }
}
