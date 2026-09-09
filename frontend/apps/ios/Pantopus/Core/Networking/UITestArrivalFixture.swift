#if DEBUG
import Foundation

/// Stateful, local-only API fixture for actual app UI journeys. Enabled only with
/// both UI_TESTS_ENTRY=1 and the existing stub-API flag; never used by release builds.
enum UITestArrivalFixture {
    static var enabled: Bool {
        let env = ProcessInfo.processInfo.environment
        return env["UI_TESTS_ENTRY"] == "1" && env["UI_TESTS_STUB_API"] == "1"
    }

    static let domain = "pantopus.ui.entry.fixture"
    static var defaults: UserDefaults {
        guard let store = UserDefaults(suiteName: domain) else {
            preconditionFailure("Cannot create isolated UI fixture store")
        }
        return store
    }

    static let userID = "entry-user"
    static let label = "12 Example Street, Camas, WA 98607"
    static var user: [String: Any] {
        [
            "id": userID, "email": "entry@example.com", "username": "entry_user",
            "name": "Entry Tester", "firstName": "Entry", "lastName": "Tester",
            "accountType": "personal", "role": "user", "verified": true,
            "createdAt": "2026-09-01T00:00:00Z", "updatedAt": "2026-09-01T00:00:00Z"
        ]
    }

    @MainActor
    static func makeAuthManager() -> AuthManager {
        if ProcessInfo.processInfo.environment["UI_TESTS_ENTRY_RESET"] == "1" {
            defaults.removePersistentDomain(forName: domain)
            PlacePendingStore.clear()
            PendingDeepLinkStore.clear()
            DeepLinkRouter.shared.clearPending()
        }
        let markerURL = FileManager.default.temporaryDirectory.appendingPathComponent("entry-test-install")
        let manager = AuthManager(
            store: UITestArrivalStore(),
            installMarker: InstallMarker(directory: markerURL),
            allowSecureEnclave: false
        )
        APIClient.shared.authProvider = manager
        DeepLinkRouter.bindSignedInUserIDProvider { [weak manager] in
            if case let .signedIn(user) = manager?.state { return user.id }
            return nil
        }
        return manager
    }

    static func response(_ request: URLRequest) -> (status: Int, data: Data)? {
        guard enabled, let path = request.url?.path else { return nil }
        let method = request.httpMethod ?? "GET"
        if let auth = authResponse(method: method, path: path) { return auth }
        if let social = socialResponse(method: method, path: path) { return social }
        switch (method, path) {
        case ("GET", "/api/geo/autocomplete"):
            return json([
                "suggestions": [
                    [
                        "suggestion_id": "entry-address",
                        "primary_text": "12 Example Street",
                        "secondary_text": "Camas, WA 98607",
                        "label": label,
                        "center": [-122.4, 45.6],
                        "kind": "address"
                    ]
                ]
            ])
        case ("GET", "/api/public/place"):
            return json([
                "status": "ready",
                "tier": "preview",
                "region": "US",
                "place": ["address": "12 Example Street", "city": "Camas", "state": "WA"],
                "sections": [],
                "free": [
                    "flood": ["status": "ready", "zone": "X", "description": "Minimal flood risk", "source": "Fixture"],
                    "density": ["status": "ready", "bucket": "none", "label": "No activity shown yet", "source": "Fixture"],
                    "area": ["status": "unavailable", "note": "Area details unavailable", "source": "Fixture"]
                ]
            ])
        case ("GET", "/api/homes/my-homes"):
            return json(["homes": []])
        case ("POST", "/api/homes"):
            return json(["error": "Home creation is forbidden in this bookmark fixture."], status: 500)
        case ("POST", "/api/saved-places"):
            return savePlace(request)
        case ("GET", "/api/saved-places"):
            let saved = defaults.dictionary(forKey: "saved-place")
            return json(["savedPlaces": saved.map { [$0] } ?? []])
        default:
            return nil
        }
    }

    private static func authResponse(method: String, path: String) -> (status: Int, data: Data)? {
        switch (method, path) {
        case ("POST", "/api/users/register"):
            defaults.set(true, forKey: "needs-verification")
            return json(["user": user, "requiresEmailVerification": true], status: 201)
        case ("POST", "/api/users/verify-email"):
            defaults.set(false, forKey: "needs-verification")
            return json(["verified": true, "message": "Email verified"])
        case ("POST", "/api/users/login"):
            if defaults.bool(forKey: "needs-verification") {
                return json(["error": "Please verify your email before signing in."], status: 403)
            }
            defaults.set(defaults.integer(forKey: "login-count") + 1, forKey: "login-count")
            return json([
                "user": user,
                "accessToken": "entry-test-access",
                "refreshToken": "entry-test-refresh",
                "expiresIn": 3600,
                "expiresAt": Int(Date().timeIntervalSince1970) + 3600
            ])
        case ("POST", "/api/users/refresh"):
            guard let code = ProcessInfo.processInfo.environment["UI_TESTS_SESSION_END_CODE"] else { return nil }
            return json(["error": "Session ended", "code": code], status: 401)
        case ("GET", "/api/users/profile"):
            return json(["user": user])
        default: return nil
        }
    }

    private static func socialResponse(method: String, path: String) -> (status: Int, data: Data)? {
        switch (method, path) {
        case ("GET", "/api/neighborhood/meter"):
            let state = ProcessInfo.processInfo.environment["UI_TESTS_SOCIAL_METER"] ?? "no_place"
            if state == "error" { return json(["error": "Meter unavailable"], status: 503) }
            return json(["state": state, "verified_count": NSNull(), "k_anon_min": 10, "threshold": 24, "unlocked": false])
        case ("GET", "/api/posts/feed"):
            return json(["posts": [], "pagination": ["hasMore": false]])
        case ("GET", "/api/personas/me/following"):
            if ProcessInfo.processInfo.environment["UI_TESTS_BEACON_UPDATE"] == "1" {
                return json([
                    "items": [
                        [
                            "membershipId": "return-member",
                            "persona": ["id": "p_demo", "handle": "mayabuilds", "displayName": "Maya Builds"],
                            "notificationLevel": "all", "mutedUntil": "2099-01-01T00:00:00Z",
                            "latestPost": [
                                "id": "beacon-return", "snippet": "A new workshop for our followers",
                                "createdAt": ISO8601DateFormatter().string(from: Date())
                            ],
                            "unreadCount": 1
                        ]
                    ],
                    "counts": ["totalFollowing": 1, "unreadBeacons": 1],
                    "pagination": ["hasMore": false, "nextOffset": NSNull()]
                ])
            }
            return json([
                "items": [], "counts": ["totalFollowing": 0, "unreadBeacons": 0],
                "pagination": ["hasMore": false, "nextOffset": NSNull()]
            ])
        case ("GET", "/api/identity/search"):
            return json([
                "results": [
                    [
                        "id": "p_demo", "type": "public_profile", "title": "Maya Builds",
                        "subtitle": "@mayabuilds", "href": "/@mayabuilds"
                    ]
                ]
            ])
        case ("GET", "/api/posts/entry-post"), ("GET", "/api/posts/beacon-return"):
            if ProcessInfo.processInfo.environment["UI_TESTS_SESSION_END_CODE"] != nil,
               defaults.integer(forKey: "login-count") < 2 {
                return json(["error": "Session ended"], status: 401)
            }
            return json([
                "post": [
                    "id": path.hasSuffix("beacon-return") ? "beacon-return" : "entry-post",
                    "user_id": "neighbor",
                    "creator": [
                        "id": path.hasSuffix("beacon-return") ? "p_demo" : "neighbor",
                        "displayName": path.hasSuffix("beacon-return") ? "Maya Builds" : "A neighbor"
                    ],
                    "content": path.hasSuffix("beacon-return")
                        ? "A new workshop for our followers" : "Anyone up for a park cleanup?",
                    "created_at": "2026-09-01T12:00:00Z",
                    "visibility": "public",
                    "comments": []
                ]
            ])
        case ("GET", "/api/personas/mayabuilds"):
            var result = object(UITestStubProtocol.defaultHandshakePersonaJSON)
            var persona = result["persona"] as? [String: Any] ?? [:]
            persona["viewer"] = [
                "isFollowing": defaults.bool(forKey: "following"),
                "followStatus": defaults.bool(forKey: "following") ? "active" : "none"
            ]
            result["persona"] = persona
            return json(result)
        case ("POST", "/api/personas/p_demo/follow"):
            defaults.set(true, forKey: "following")
            return json(object(UITestStubProtocol.defaultHandshakeSuccessJSON), status: 201)
        default: return nil
        }
    }

    private static func savePlace(_ request: URLRequest) -> (status: Int, data: Data) {
        let body = requestBody(request)
        guard body["expectedUserId"] as? String == userID,
              request.value(forHTTPHeaderField: "Authorization") == "Bearer entry-test-access" else {
            return json(["error": "Account guard missing"], status: 409)
        }
        if ProcessInfo.processInfo.environment["UI_TESTS_ENTRY_FAIL_SAVE"] == "1",
           !defaults.bool(forKey: "save-failed-once") {
            defaults.set(true, forKey: "save-failed-once")
            return json(["error": "Try again"], status: 503)
        }
        var saved = body
        saved["id"] = "saved-entry"
        saved["user_id"] = userID
        saved["place_type"] = "searched"
        defaults.set(saved, forKey: "saved-place")
        return json(["savedPlace": saved], status: 201)
    }

    private static func requestBody(_ request: URLRequest) -> [String: Any] {
        if let data = request.httpBody { return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:] }
        guard let stream = request.httpBodyStream else { return [:] }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    private static func object(_ value: String) -> [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(value.utf8))) as? [String: Any] ?? [:]
    }

    private static func json(_ value: [String: Any], status: Int = 200) -> (status: Int, data: Data) {
        (status, (try? JSONSerialization.data(withJSONObject: value)) ?? Data())
    }
}

/// Fake credentials only, separated from the real Keychain. Persisted so a UI
/// test can terminate the app and exercise its real session restoration path.
private final class UITestArrivalStore: SecureStore, @unchecked Sendable {
    private let defaults = UITestArrivalFixture.defaults
    func set(_ value: String, for key: String) throws {
        defaults.set(value, forKey: "auth.\(key)")
    }

    func get(_ key: String) -> String? {
        defaults.string(forKey: "auth.\(key)")
    }

    func delete(_ key: String) throws {
        defaults.removeObject(forKey: "auth.\(key)")
    }

    func setData(_ value: Data, for key: String) throws {
        defaults.set(value, forKey: "auth.\(key)")
    }

    func getData(_ key: String) -> Data? {
        defaults.data(forKey: "auth.\(key)")
    }
}
#endif
