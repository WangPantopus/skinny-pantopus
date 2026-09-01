//
//  UITestStubProtocol.swift
//  Pantopus
//
//  In-process URL stub used only by XCUITests. Activated when the host
//  app is launched with `UI_TESTS_STUB_API=1` (see `APIClient.shared`).
//  Reads canned response bodies from the launch environment so each test
//  can dictate what the network looks like without a real backend.
//

// swiftlint:disable cyclomatic_complexity file_length function_body_length line_length type_body_length

#if DEBUG
import Foundation

/// `URLProtocol` subclass that intercepts every request on the stubbed
/// `URLSession` and returns canned JSON.
///
/// Environment keys (all optional — sensible fallbacks are provided):
///
/// - `UI_TESTS_PROFILE_GET_BODY` — JSON body for `GET /api/users/profile`.
/// - `UI_TESTS_PROFILE_PATCH_BODY` — JSON body for `PATCH /api/users/profile`.
/// - `UI_TESTS_PROFILE_GET_STATUS` / `UI_TESTS_PROFILE_PATCH_STATUS` —
///    override status codes (default 200).
/// - `UI_TESTS_HOMES_SUGGEST_BODY` — JSON body for
///   `POST /api/homes/property-suggestions`.
/// - `UI_TESTS_HOMES_CHECK_BODY` — JSON body for
///   `POST /api/homes/check-address`.
/// - `UI_TESTS_HOMES_CREATE_BODY` — JSON body for `POST /api/homes`.
/// - `UI_TESTS_HOMES_*_STATUS` — override the corresponding status code.
///
/// The protocol is single-process: each XCUITest spawns the app fresh,
/// so there is no need for cross-test isolation.
final class UITestStubProtocol: URLProtocol {
    override static func canInit(with request: URLRequest) -> Bool {
        request.url?.path.hasPrefix("/api/") ?? false
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func stopLoading() {}

    override func startLoading() {
        guard let url = request.url else {
            finishWith(status: 400, body: Data())
            return
        }

        let path = url.path
        let method = request.httpMethod?.uppercased() ?? "GET"
        let env = ProcessInfo.processInfo.environment

        switch (method, path) {
        case ("GET", "/api/users/profile"):
            let body = env["UI_TESTS_PROFILE_GET_BODY"] ?? Self.defaultProfileResponseJSON
            let status = Int(env["UI_TESTS_PROFILE_GET_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("PATCH", "/api/users/profile"):
            let body = env["UI_TESTS_PROFILE_PATCH_BODY"] ?? Self.defaultProfilePatchResponseJSON
            let status = Int(env["UI_TESTS_PROFILE_PATCH_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("POST", "/api/homes/property-suggestions"):
            let body = env["UI_TESTS_HOMES_SUGGEST_BODY"] ?? Self.defaultPropertySuggestionsJSON
            let status = Int(env["UI_TESTS_HOMES_SUGGEST_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("POST", "/api/homes/check-address"):
            let body = env["UI_TESTS_HOMES_CHECK_BODY"] ?? Self.defaultCheckAddressJSON
            let status = Int(env["UI_TESTS_HOMES_CHECK_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("POST", "/api/homes"):
            let body = env["UI_TESTS_HOMES_CREATE_BODY"] ?? Self.defaultCreateHomeJSON
            let status = Int(env["UI_TESTS_HOMES_CREATE_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case let ("GET", path) where path.hasPrefix("/api/homes/") && path.hasSuffix("/public-profile"):
            let body = env["UI_TESTS_HOMES_PUBLIC_BODY"] ?? Self.defaultHomePublicProfileJSON
            finishWith(status: 200, body: Data(body.utf8))

        case let ("GET", path) where path.hasPrefix("/api/homes/") && !path.contains("my-homes"):
            let body = env["UI_TESTS_HOMES_DETAIL_BODY"] ?? Self.defaultHomeDetailJSON
            finishWith(status: 200, body: Data(body.utf8))

        case ("GET", "/api/homes/my-homes"):
            let body = env["UI_TESTS_HOMES_MYHOMES_BODY"] ?? Self.defaultMyHomesJSON
            finishWith(status: 200, body: Data(body.utf8))

        case ("GET", "/api/hub"):
            let body = env["UI_TESTS_HUB_BODY"] ?? Self.defaultHubOverviewJSON
            let status = Int(env["UI_TESTS_HUB_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("GET", "/api/hub/today"):
            let body = env["UI_TESTS_HUB_TODAY_BODY"] ?? Self.defaultHubTodayJSON
            let status = Int(env["UI_TESTS_HUB_TODAY_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("GET", "/api/hub/discovery"):
            let body = env["UI_TESTS_HUB_DISCOVERY_BODY"] ?? Self.defaultHubDiscoveryJSON
            let status = Int(env["UI_TESTS_HUB_DISCOVERY_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("GET", "/api/gigs"):
            let body = env["UI_TESTS_GIGS_LIST_BODY"] ?? Self.defaultGigsListJSON
            finishWith(status: 200, body: Data(body.utf8))

        case let ("GET", path)
            where path.hasPrefix("/api/gigs/")
            && !path.hasSuffix("/bids")
            && !path.contains("/in-bounds")
            && !path.contains("/nearby")
            && !path.contains("/browse")
            && !path.contains("/categories"):
            let body = env["UI_TESTS_GIG_DETAIL_BODY"] ?? Self.defaultGigDetailJSON
            finishWith(status: 200, body: Data(body.utf8))

        case let ("GET", path) where path.hasPrefix("/api/gigs/") && path.hasSuffix("/bids"):
            // Owner-only on real backend; the stub returns an empty
            // list so the detail screen renders the trust capsules
            // without a bids module under the UI test.
            finishWith(status: 200, body: Data("{\"bids\":[]}".utf8))

        case ("GET", "/api/identity-center"):
            let body = env["UI_TESTS_IDENTITY_CENTER_BODY"] ?? Self.defaultIdentityCenterJSON
            finishWith(status: 200, body: Data(body.utf8))

        case ("GET", "/api/privacy/blocks"):
            finishWith(status: 200, body: Data("{\"blocks\":[]}".utf8))

        case ("GET", "/api/personas/me"):
            finishWith(status: 200, body: Data(Self.defaultPersonaMeJSON.utf8))

        case ("GET", "/api/personas/me/audience"):
            finishWith(status: 200, body: Data(Self.defaultAudienceJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/posts"):
            finishWith(status: 200, body: Data(Self.defaultPersonaPostsJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/tiers"):
            finishWith(status: 200, body: Data(Self.defaultPersonaTiersJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/membership-stats"):
            finishWith(status: 200, body: Data(Self.defaultMembershipStatsJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.contains("/dms/threads"):
            finishWith(status: 200, body: Data(Self.defaultPersonaThreadsJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/fan-handle-suggestion"):
            finishWith(status: 200, body: Data(Self.defaultFanHandleSuggestionJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/follow/status"):
            finishWith(status: 200, body: Data(Self.defaultFollowStatusJSON.utf8))

        case let ("POST", path) where path.hasPrefix("/api/personas/")
            && path.hasSuffix("/follow"):
            // Tier-1 success — returns the active follower membership.
            finishWith(status: 201, body: Data(Self.defaultHandshakeSuccessJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/homes/invitations/token/"):
            finishWith(status: 200, body: Data(Self.defaultHomeInviteJSON.utf8))

        case ("GET", "/api/businesses/seats/invite-details"):
            finishWith(status: 404, body: Data("{\"error\":\"Invite not found\"}".utf8))

        case let ("GET", path) where path.hasPrefix("/api/homes/guest/"):
            finishWith(status: 404, body: Data("{\"error\":\"Guest pass not found\"}".utf8))

        case let ("POST", path) where path.hasPrefix("/api/homes/invitations/token/")
            && path.hasSuffix("/accept"):
            finishWith(status: 200, body: Data(Self.defaultHomeAcceptJSON.utf8))

        case ("GET", "/api/mailbox/compose/recipients"):
            finishWith(status: 200, body: Data(Self.defaultMailComposeRecipientsJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/mailbox/compose/home-context/"):
            finishWith(status: 200, body: Data(Self.defaultMailComposeHomeContextJSON.utf8))

        case ("POST", "/api/mailbox/send"):
            finishWith(status: 200, body: Data(Self.defaultMailSendJSON.utf8))

        case let ("GET", path) where path.hasPrefix("/api/mailbox/v2/item/"):
            finishWith(status: 200, body: Data(Self.defaultCeremonialMailItemJSON.utf8))

        case ("GET", "/api/notifications"):
            let body = env["UI_TESTS_NOTIFICATIONS_LIST_BODY"] ?? Self.defaultNotificationsListJSON
            finishWith(status: 200, body: Data(body.utf8))

        case ("GET", "/api/notifications/unread-count"):
            finishWith(status: 200, body: Data("{\"count\":2}".utf8))

        case ("GET", "/api/chat/unified-conversations"):
            let body = env["UI_TESTS_CHAT_CONVERSATIONS_BODY"] ?? Self.defaultChatConversationsJSON
            let status = Int(env["UI_TESTS_CHAT_CONVERSATIONS_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case ("GET", "/api/chat/stats"):
            let body = env["UI_TESTS_CHAT_STATS_BODY"] ?? Self.defaultChatStatsJSON
            let status = Int(env["UI_TESTS_CHAT_STATS_STATUS"] ?? "200") ?? 200
            finishWith(status: status, body: Data(body.utf8))

        case let ("PATCH", path) where path.hasPrefix("/api/notifications/") && path.hasSuffix("/read"):
            finishWith(status: 200, body: Data("{\"ok\":true}".utf8))

        case ("POST", "/api/notifications/read-all"):
            finishWith(status: 200, body: Data("{\"count\":0}".utf8))

        // The handshake screen calls GET /api/personas/:handle ahead
        // of its tiers / suggestion / status fetches. Match exactly 3
        // path segments (`/api`, `/personas`, `/<handle>`) so the
        // earlier case branches (which include suffixes) win first.
        case let ("GET", path) where path.hasPrefix("/api/personas/")
            && path.split(separator: "/").count == 3:
            finishWith(status: 200, body: Data(Self.defaultHandshakePersonaJSON.utf8))

        default:
            // Unknown endpoint under test — surface a recognizable 599
            // so test failures point clearly at a missing stub.
            finishWith(
                status: 599,
                body: Data("{\"error\":\"UITestStubProtocol: unmocked \(method) \(path)\"}".utf8)
            )
        }
    }

    private func finishWith(status: Int, body: Data) {
        guard let url = request.url,
              let response = HTTPURLResponse(
                  url: url,
                  statusCode: status,
                  httpVersion: "HTTP/1.1",
                  headerFields: ["Content-Type": "application/json"]
              )
        else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    /// Minimal user profile that decodes cleanly into `ProfileResponse`.
    /// Tests that need different data should override
    /// `UI_TESTS_PROFILE_GET_BODY`.
    static let defaultProfileResponseJSON = """
    {"user":{
      "id":"u_test","email":"alice@example.com","username":"alice",
      "firstName":"Alice","middleName":null,"lastName":"Doe","name":"Alice Doe",
      "phoneNumber":"+15555550123","dateOfBirth":null,
      "address":null,"city":null,"state":null,"zipcode":null,
      "accountType":"personal","role":"user","verified":true,
      "residency":null,"avatar_url":null,"profile_picture_url":null,"profilePicture":null,
      "bio":"Hello world","tagline":null,"socialLinks":null,"skills":[],
      "followers_count":0,"average_rating":0,"gigs_posted":0,"gigs_completed":0,
      "profileVisibility":"public","createdAt":"2025-01-01T00:00:00Z","updatedAt":"2025-01-01T00:00:00Z"
    },"invite_progress":null}
    """

    /// Successful PATCH envelope shaped like `ProfileUpdateResponse`.
    static let defaultProfilePatchResponseJSON = """
    {"message":"ok","user":{
      "id":"u_test","email":"alice@example.com","username":"alice",
      "firstName":"Alice","middleName":null,"lastName":"Doe","name":"Alice Doe",
      "phoneNumber":"+15555550123","dateOfBirth":null,
      "address":null,"city":null,"state":null,"zipcode":null,
      "accountType":"personal","role":"user","verified":true,
      "residency":null,"avatar_url":null,"profile_picture_url":null,"profilePicture":null,
      "bio":"Hello world","tagline":null,"socialLinks":null,"skills":[],
      "followers_count":0,"average_rating":0,"gigs_posted":0,"gigs_completed":0,
      "profileVisibility":"public","createdAt":"2025-01-01T00:00:00Z","updatedAt":"2025-01-01T00:00:00Z"
    }}
    """

    /// ATTOM property-suggestions envelope from
    /// `backend/services/ai/propertySuggestionsService.js:261-267`. Feeds
    /// the Add-Home wizard's Details fields. Tests can override via
    /// `UI_TESTS_HOMES_SUGGEST_BODY`.
    static let defaultPropertySuggestionsJSON = """
    {"suggestions":{"home_type":"house","bedrooms":3,"bathrooms":2,
      "sq_ft":1480,"lot_sq_ft":5200,"year_built":1974,"description":null},
     "field_sources":{"home_type":"attom","bedrooms":"attom"},
     "tiers_used":["attom"],"llm_enabled":false,
     "attom_property_detail":{"source":"attom"}}
    """

    /// `CheckAddressResponse` — `HOME_NOT_FOUND` so the wizard's verdict
    /// row renders the "looks good" path.
    static let defaultCheckAddressJSON = """
    {"status":"HOME_NOT_FOUND","is_multi_unit":false}
    """

    /// `CreateHomeResponse` envelope. The wizard's "View home" CTA uses
    /// the returned `home.id` to push the dashboard route.
    static let defaultCreateHomeJSON = """
    {"message":"ok","home":{
      "id":"home_test","name":"412 Elm St","address":"412 Elm St",
      "city":"Portland","state":"OR","zipcode":"97214",
      "home_type":null,"visibility":"public","description":null,
      "created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"
    },"requires_verification":false,"verification_type":null,"role":"owner"}
    """

    /// Minimal `MyHomesResponse` for tests that need to land on the
    /// MyHomes list before triggering the wizard.
    static let defaultMyHomesJSON = """
    {"homes":[],"message":"ok"}
    """

    /// Minimal `HomeDetailResponse` for the dashboard route.
    static let defaultHomeDetailJSON = """
    {"home":{
      "id":"home_test","name":"412 Elm St","address":"412 Elm St",
      "city":"Portland","state":"OR","zipcode":"97214",
      "home_type":null,"visibility":"public","description":null,
      "created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z",
      "owner":null,"occupants":[],"location":null,
      "isOwner":true,"isPendingOwner":false,"pendingClaimId":null,
      "isOccupant":true,"owners":[],"can_delete_home":true
    }}
    """

    /// Minimal `HomePublicProfileResponse`.
    static let defaultHomePublicProfileJSON = """
    {"home":{
      "id":"home_test","name":"412 Elm St","address":"412 Elm St",
      "city":"Portland","state":"OR","zipcode":"97214",
      "home_type":null,"visibility":"public","description":null,
      "created_at":"2025-01-01T00:00:00Z",
      "hasVerifiedOwner":false,"verifiedOwner":null,
      "userMembershipStatus":"member","userResidencyClaim":null,
      "memberCount":1,"nearbyGigs":0
    }}
    """

    /// Single-row `GigsListResponse` for the Gigs feed + the matching
    /// detail row for the T2.6 TransactionalDetailShell capture.
    static let defaultGigsListJSON = """
    {"gigs":[{
      "id":"g_demo",
      "title":"Hang 3 shelves",
      "description":"Three IKEA Lack shelves on drywall — studs already located.",
      "price":60,
      "category":"handyman",
      "status":"open",
      "created_at":"2025-01-01T00:00:00Z",
      "user_id":"u_demo",
      "bid_count":4,
      "distance_miles":0.2,
      "pickup_address":"Rose Court, Unit 4B"
    }],"total":1}
    """

    static let defaultGigDetailJSON = """
    {"gig":{
      "id":"g_demo",
      "title":"Hang 3 shelves",
      "description":"Three IKEA Lack shelves on drywall — studs already located.",
      "price":60,
      "category":"handyman",
      "status":"open",
      "created_at":"2025-01-01T00:00:00Z",
      "user_id":"u_demo",
      "bid_count":4,
      "distance_miles":0.2,
      "pickup_address":"Rose Court, Unit 4B",
      "latitude":45.587,
      "longitude":-122.399,
      "locationUnlocked":false,
      "location":{"latitude":45.587,"longitude":-122.399}
    }}
    """

    static let defaultChatConversationsJSON = """
    {"conversations":[],"total":0,"totalUnread":0}
    """

    static let defaultChatStatsJSON = """
    {"stats":{"total_chats":0,"total_messages":0,"total_unread":0,"direct_chats":0,"gig_chats":0,"home_chats":0}}
    """

    /// Persona overview for `/api/personas/me` — paired with the
    /// audience / posts / tiers / stats / threads stubs below to keep
    /// the T3.3 Public Profile screen stable for the 15_PublicProfile
    /// screenshot.
    static let defaultPersonaMeJSON = """
    {
      "persona": {
        "id": "p_demo",
        "handle": "mayabuilds",
        "displayName": "Maya Builds",
        "avatarUrl": null,
        "bio": "Building things in the Mission.",
        "category": "creator",
        "audienceLabel": "followers",
        "followerCount": 12,
        "postCount": 7
      },
      "channel": {
        "id": "ch_demo", "title": "Maya Broadcast", "status": "active"
      }
    }
    """

    static let defaultAudienceJSON = """
    {
      "persona": null,
      "items": [
        {"membershipId":"m1","fanHandle":"alex","fanDisplayName":"Alex M.",
         "status":"active","tier":{"rank":1,"name":"Followers"},
         "verifiedLocal":true,"tenureMonths":3,"joinedMonth":"2026-02"},
        {"membershipId":"m2","fanHandle":"billie","fanDisplayName":"Billie B.",
         "status":"active","tier":{"rank":2,"name":"Members"},
         "tenureMonths":12,"joinedMonth":"2025-05"},
        {"membershipId":"m3","fanHandle":"casey","fanDisplayName":"Casey K.",
         "status":"active","tier":{"rank":3,"name":"Insiders"},
         "tenureMonths":6,"joinedMonth":"2025-11"}
      ],
      "counts": {
        "totalActive": 12, "pending": 3,
        "byTier": {"1": 8, "2": 3, "3": 1, "4": 0}
      }
    }
    """

    static let defaultPersonaPostsJSON = """
    {"posts":[
      {"id":"u1","body":"New mural going up next week.",
       "created_at":"2026-05-14T18:00:00Z","visibility":"followers",
       "delivered_count":40,"read_count":31},
      {"id":"u2","body":"Workshop seats just opened — Members get first pick.",
       "created_at":"2026-05-13T09:00:00Z","visibility":"tier_or_above",
       "target_tier_rank":2,"delivered_count":3,"read_count":2}
    ]}
    """

    static let defaultPersonaTiersJSON = """
    {"tiers":[
      {"id":"t1","rank":1,"name":"Followers","priceCents":0,"currency":"usd"},
      {"id":"t2","rank":2,"name":"Members","priceCents":500,"currency":"usd"},
      {"id":"t3","rank":3,"name":"Insiders","priceCents":2500,"currency":"usd"}
    ]}
    """

    static let defaultMembershipStatsJSON = """
    {"counts":{"followers":8,"members":3,"insiders":1,"direct":0}}
    """

    static let defaultPersonaThreadsJSON = """
    {"threads":[
      {"id":"th1","membershipId":"m1","fanHandle":"alex","fanDisplayName":"Alex M.",
       "tier":{"rank":2,"name":"Members"},
       "lastMessagePreview":"Loved the workshop! Any plans for July?",
       "lastMessageAt":"2026-05-15T10:00:00Z","unreadCount":2}
    ]}
    """

    /// The visitor-side persona returned by GET /api/personas/:handle
    /// — paired with the stubs below so the T3.4 Privacy Handshake
    /// wizard renders cleanly for `16_PrivacyHandshake`.
    static let defaultHandshakePersonaJSON = """
    {
      "persona": {
        "id": "p_demo", "handle": "mayabuilds",
        "displayName": "Maya Builds", "bio": "Building things in the Mission.",
        "category": "creator", "audienceLabel": "followers",
        "followerCount": 12, "postCount": 7
      },
      "channel": null
    }
    """

    static let defaultFanHandleSuggestionJSON = """
    {"suggestion":"fan_8a2c41","locked":false,"identity":null}
    """

    static let defaultFollowStatusJSON = """
    {"following":false,"status":"none","relationshipType":null,"notificationLevel":"none"}
    """

    static let defaultHandshakeSuccessJSON = """
    {"follow":{"id":"f_demo","status":"active","relationshipType":"follower"},
     "status":"active",
     "membership":{"id":"m_demo","fan_handle":"fan_8a2c41","tier_id":"t1","status":"active"}}
    """

    /// Home invite preview — used by the 17_TokenAccept screenshot.
    static let defaultHomeInviteJSON = """
    {
      "invitation": {
        "id": "inv_demo", "status": "pending",
        "proposed_role": "co_owner",
        "invitee_email": "alice@example.com",
        "expires_at": "2026-06-01T00:00:00Z",
        "created_at": "2026-05-15T10:00:00Z"
      },
      "home": {
        "id": "home_demo", "name": "412 Elm St",
        "city": "Portland, OR", "home_type": "single_family"
      },
      "inviter": {
        "name": "Maya K.", "username": "mayak", "profilePicture": null
      }
    }
    """

    static let defaultHomeAcceptJSON = """
    {
      "homeId": "home_demo",
      "occupancy": {"id": "occ_demo", "role": "co_owner"},
      "merged": false,
      "accepted_role_base": "co_owner"
    }
    """

    /// Ceremonial Mail Compose recipients list — used by the
    /// 19_CeremonialMail screenshot.
    static let defaultMailComposeRecipientsJSON = """
    {"recipients":[
      {"userId":"u_maya","name":"Maya K.","username":"mayak",
       "homeId":"home_demo","homeAddress":"412 Elm St, Portland, OR",
       "isVerified":true,"homeMediaUrl":null,"isOnPantopus":true},
      {"userId":"u_omar","name":"Omar B.","username":"omarb",
       "homeId":"home_omar","homeAddress":"77 Birch Ln, Portland, OR",
       "isVerified":false,"homeMediaUrl":null,"isOnPantopus":true}
    ]}
    """

    static let defaultMailComposeHomeContextJSON = """
    {
      "homeId":"home_demo",
      "addressDisplay":"412 Elm St, Portland, OR",
      "memberCount":2,
      "homeMediaUrl":null,
      "privateDeliveryAvailable":true,
      "members":[
        {"userId":"u_maya","name":"Maya K.","role":"co_owner"},
        {"userId":"u_alice","name":"Alice D.","role":"co_owner"}
      ]
    }
    """

    static let defaultMailSendJSON = """
    {"message":"Letter sent","mail":{"id":"mail_demo","subject":"A note from a friend","created_at":"2026-05-15T12:00:00Z"}}
    """

    static let defaultHubOverviewJSON = """
    {
      "user":{
        "id":"u_test","name":"Alice Doe","firstName":"Alice","username":"alice",
        "avatarUrl":null,"email":"alice@example.com"
      },
      "context":{"activeHomeId":"home_demo","activePersona":{"type":"personal"}},
      "availability":{"hasHome":true,"hasBusiness":false,"hasPayoutMethod":true},
      "homes":[{
        "id":"home_demo","name":"412 Elm St","addressShort":"412 Elm St",
        "city":"Portland","state":"OR","latitude":45.5202,"longitude":-122.6742,
        "isPrimary":true,"roleBase":"owner"
      }],
      "businesses":[],
      "setup":{
        "steps":[
          {"key":"profile","done":true},
          {"key":"home","done":true},
          {"key":"payments","done":true}
        ],
        "allDone":true,
        "profileCompleteness":{
          "score":1.0,
          "checks":{"firstName":true,"lastName":true,"photo":true,"bio":true,"skills":true},
          "missingFields":[]
        }
      },
      "statusItems":[],
      "cards":{
        "personal":{"unreadChats":0,"earnings":0,"gigsNearby":3,"rating":4.8,"reviewCount":12},
        "home":{"newMail":0,"billsDue":[],"tasksDue":[],"memberCount":2},
        "business":null
      },
      "jumpBackIn":[
        {"title":"Finish shelf install","route":"/app/gigs/gig-shelves","icon":"hammer"},
        {"title":"List the spare bike","route":"/app/marketplace/item-bike","icon":"shoppingBag"}
      ],
      "activity":[
        {"id":"act_1","pillar":"personal","title":"Maya replied to your post",
         "at":"2026-05-22T15:00:00Z","read":false,"route":"/app/pulse/post-demo"}
      ],
      "neighborDensity":{"count":42,"radiusMiles":1.5,"milestone":"active"}
    }
    """

    static let defaultHubTodayJSON = """
    {
      "today":{
        "weather":{"temperatureF":67,"conditions":"Sunny"},
        "aqi":{"label":"Good"},
        "commute":{"label":"Light traffic"}
      },
      "error":null
    }
    """

    static let defaultHubDiscoveryJSON = """
    {"items":[
      {"id":"gig-shelves","type":"gig","title":"Hang 3 floating shelves",
       "meta":"0.2 mi · 4 bids","category":"Handyman","avatarUrl":null,
       "route":"/app/gigs/gig-shelves","subtitle":"Today near 412 Elm",
       "price":"$60","rating":null,"verified":true,"isFree":false,
       "isWanted":false,"createdAt":"2026-05-22T15:00:00Z"},
      {"id":"biz-clean","type":"business","title":"Maya's Clean Team",
       "meta":"Verified · 0.4 mi","category":"Cleaning","avatarUrl":null,
       "route":"/app/businesses/biz-clean","subtitle":"Same-day apartment cleanups",
       "price":null,"rating":4.9,"verified":true,"isFree":false,
       "isWanted":false,"createdAt":"2026-05-22T14:30:00Z"},
      {"id":"listing-bike","type":"listing","title":"Vintage Trek road bike",
       "meta":"$240 · 0.7 mi","category":"Goods","avatarUrl":null,
       "route":"/app/marketplace/listing-bike","subtitle":"56cm, ready to ride",
       "price":"$240","rating":null,"verified":false,"isFree":false,
       "isWanted":false,"createdAt":"2026-05-22T13:45:00Z"}
    ]}
    """

    /// Notifications list used by the 21_Notifications screenshot. Two
    /// unread rows so the "Mark all read" action lights up and the
    /// projection covers both NEW chip + chevron variants once any one
    /// row gets tapped.
    static let defaultNotificationsListJSON = """
    {"notifications":[
      {"id":"n_1","user_id":"u_test","type":"post","title":"Maya posted in your block",
       "body":"\\"Anyone seen the moving truck on Elm?\\"","icon":null,
       "link":"/post/p_demo","is_read":false,
       "created_at":"2026-05-15T10:00:00Z","context":null},
      {"id":"n_2","user_id":"u_test","type":"gig","title":"New bid on your gig",
       "body":"$60 — Hang 3 shelves","icon":null,
       "link":"/gig/g_demo","is_read":false,
       "created_at":"2026-05-15T09:30:00Z","context":null},
      {"id":"n_3","user_id":"u_test","type":"home_member_request","title":"Membership request",
       "body":"Sam wants to join your home","icon":null,
       "link":"/homes/home_test/members?tab=requests","is_read":true,
       "created_at":"2026-05-15T08:00:00Z","context":null}
    ],"unreadCount":2,"hasMore":false}
    """

    /// Ceremonial mail item — used by the 20_CeremonialMailOpen
    /// screenshot. Includes the object_payload that decides the
    /// stationery / ink / seal / voice postscript tones.
    static let defaultCeremonialMailItemJSON = """
    {
      "mail": {
        "id":"mail_demo",
        "subject":"A note from a friend",
        "content":"Dear Alice,\\n\\nI was thinking about the afternoon we spent at the old library — the smell of paper, the dust drifting in the light.\\n\\nI hope this letter finds you well.\\n\\nWith warmth,\\nMaya",
        "type":"letter",
        "mail_type":"letter",
        "drawer":"inbox",
        "lifecycle":"delivered",
        "viewed":false,
        "ack_required":false,
        "payout_amount":0,
        "trust_level":"verified",
        "created_at":"2026-05-15T12:00:00Z",
        "sender":{"name":"Maya K.","username":"mayak"},
        "sender_display":"Maya K.",
        "sender_trust":"pantopus_user",
        "package":null,
        "timeline":[],
        "object_payload":{
          "stationeryTheme":"midnight_blue",
          "inkSelection":"navy",
          "sealChoice":"wax_red",
          "intent":"say_hello",
          "returnAddressShared":false,
          "voicePostscriptUri":"https://uploads.test/voice/v1.m4a"
        }
      }
    }
    """

    /// Identity Center overview — all four identities populated so the
    /// 14_IdentityCenter screenshot captures the loaded state with
    /// Profile-links toggles, blocked counts, and the Live chip on the
    /// Public profile card.
    static let defaultIdentityCenterJSON = """
    {
      "private_account": {
        "id": "u_demo", "email": "alice@example.com", "name": "Alice Doe",
        "verified": true
      },
      "local_profile": {
        "id": "lp_demo", "handle": "alice.d", "display_name": "Alice D.",
        "post_count": 47, "connection_count": 23, "verified": true
      },
      "audience_profile": {
        "id": "ap_demo", "handle": "aliceonline", "display_name": "Alice Online",
        "follower_count": 1247, "post_cadence": "weekly", "status": "live"
      },
      "bridges": {"show_persona_on_local": true, "show_local_on_persona": false},
      "homes": [{"id": "home_demo", "name": "412 Elm St"}],
      "business_profiles": [
        {"id": "biz_demo", "display_name": "Alice Masonry", "is_active": true}
      ],
      "persona_count": 1,
      "block_counts": {"personal": 2, "audience": 5}
    }
    """
}
#endif
