//
//  DTODecodingTests.swift
//  PantopusTests
//
//  Decodes a representative fixture JSON for each DTO in Prompt P3's
//  endpoint table and asserts key fields round-trip.
//

import XCTest
@testable import Pantopus

final class DTODecodingTests: XCTestCase {
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private func decode<T: Decodable>(_: T.Type, from string: String) throws -> T {
        try decoder.decode(T.self, from: Data(string.utf8))
    }

    // MARK: - Auth

    func testLoginResponseDecodes() throws {
        let json = """
        {
          "message": "Login successful",
          "accessToken": "at_123",
          "refreshToken": "rt_123",
          "expiresIn": 3600,
          "expiresAt": 1800000000,
          "user": {
            "id": "u_1", "email": "a@b.co", "username": "alice",
            "name": "Alice Doe", "firstName": "Alice", "middleName": null,
            "lastName": "Doe", "phoneNumber": null, "address": null,
            "city": null, "state": null, "zipcode": null,
            "accountType": "personal", "role": "member",
            "verified": true, "createdAt": "2025-01-01T00:00:00Z"
          }
        }
        """
        let response = try decode(LoginResponse.self, from: json)
        XCTAssertEqual(response.accessToken, "at_123")
        XCTAssertEqual(response.user.firstName, "Alice")
        XCTAssertTrue(response.user.verified)
    }

    func testRefreshResponseDecodes() throws {
        let json = """
        { "ok": true, "accessToken": "new_at", "expiresAt": 1800000001 }
        """
        let response = try decode(RefreshResponse.self, from: json)
        XCTAssertTrue(response.ok)
        XCTAssertEqual(response.accessToken, "new_at")
    }

    // MARK: - Users profile

    func testProfileResponseDecodes() throws {
        let json = """
        {
          "user": {
            "id": "u_1", "email": "a@b.co", "username": "alice",
            "firstName": "Alice", "lastName": "Doe", "name": "Alice Doe",
            "accountType": "personal", "role": "member", "verified": true,
            "residency": null, "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-02T00:00:00Z"
          },
          "invite_progress": null
        }
        """
        let response = try decode(ProfileResponse.self, from: json)
        XCTAssertEqual(response.user.id, "u_1")
        XCTAssertEqual(response.user.name, "Alice Doe")
    }

    // MARK: - Hub

    func testHubResponseDecodes() throws {
        let json = """
        {
          "user": { "id": "u1", "name": "Alice", "firstName": "Alice", "username": "alice", "avatarUrl": null, "email": "a@b.co" },
          "context": { "activeHomeId": "h1", "activePersona": { "type": "personal" } },
          "availability": { "hasHome": true, "hasBusiness": false, "hasPayoutMethod": false },
          "homes": [],
          "businesses": [],
          "setup": { "steps": [], "allDone": true, "profileCompleteness": {
            "score": 0.8,
            "checks": { "firstName": true, "lastName": true, "photo": false, "bio": false, "skills": false },
            "missingFields": ["photo"]
          } },
          "statusItems": [],
          "cards": {
            "personal": { "unreadChats": 0, "earnings": 0, "gigsNearby": 0, "rating": 0, "reviewCount": 0 },
            "home": null,
            "business": null
          },
          "jumpBackIn": [],
          "activity": [],
          "neighborDensity": null
        }
        """
        let hub = try decode(HubResponse.self, from: json)
        XCTAssertEqual(hub.user.username, "alice")
        XCTAssertTrue(hub.availability.hasHome)
        XCTAssertEqual(hub.setup.profileCompleteness.missingFields, ["photo"])
    }

    func testHubTodayDecodes() throws {
        let json = "{ \"today\": { \"weather\": { \"temperatureF\": 72 } } }"
        let response = try decode(HubTodayResponse.self, from: json)
        XCTAssertNotNil(response.today)
    }

    func testHubDiscoveryDecodes() throws {
        let json = """
        { "items": [{
          "id": "g1", "type": "gig", "title": "Mow lawn", "meta": "$40",
          "category": "yard", "avatarUrl": null, "route": "/g/g1"
        }] }
        """
        let response = try decode(HubDiscoveryResponse.self, from: json)
        XCTAssertEqual(response.items.first?.category, "yard")
    }

    // MARK: - Homes

    func testMyHomesResponseDecodes() throws {
        let json = """
        {
          "homes": [
            {
              "id": "h1", "name": "Main", "address": "1 Main", "city": "X", "state": "CA", "zipcode": "90000",
              "ownership_status": "verified", "is_primary_owner": true, "verification_tier": "attom_attested"
            }
          ]
        }
        """
        let response = try decode(MyHomesResponse.self, from: json)
        XCTAssertEqual(response.homes.count, 1)
        XCTAssertEqual(response.homes[0].home.city, "X")
        XCTAssertEqual(response.homes[0].ownershipStatus, "verified")
    }

    func testHomePublicProfileDecodes() throws {
        let json = """
        { "home": {
          "id": "h1", "name": null, "address": "1 Main", "city": "X", "state": "CA",
          "zipcode": "90000", "home_type": "single_family", "visibility": "public",
          "description": null, "created_at": "2025-01-01T00:00:00Z",
          "hasVerifiedOwner": false, "verifiedOwner": null,
          "userMembershipStatus": "none", "userResidencyClaim": null,
          "memberCount": 0, "nearbyGigs": 3
        } }
        """
        let response = try decode(HomePublicProfileResponse.self, from: json)
        XCTAssertEqual(response.home.nearbyGigs, 3)
        XCTAssertEqual(response.home.userMembershipStatus, "none")
    }

    func testCheckAddressResponseDecodes() throws {
        let json = "{ \"exists\": true, \"homeCount\": 2, \"hasVerifiedMembers\": false }"
        let response = try decode(CheckAddressResponse.self, from: json)
        XCTAssertTrue(response.exists)
        XCTAssertEqual(response.homeCount, 2)
    }

    /// Real `POST /api/homes/check-address` envelope
    /// (`backend/routes/home.js:661`): status + home_id + is_multi_unit
    /// + formatted_address, with the legacy triple derived.
    func testCheckAddressResponseDecodesBackendShape() throws {
        let json = """
        { "status": "HOME_FOUND_CLAIMED", "home_id": "home_1",
          "is_multi_unit": true, "formatted_address": "412 Elm St, Apt 3B, Brooklyn, NY, 11211" }
        """
        let response = try decode(CheckAddressResponse.self, from: json)
        XCTAssertTrue(response.isAlreadyClaimed)
        XCTAssertEqual(response.homeId, "home_1")
        XCTAssertTrue(response.isMultiUnit)
        XCTAssertEqual(response.formattedAddress, "412 Elm St, Apt 3B, Brooklyn, NY, 11211")
        XCTAssertTrue(response.exists)
        XCTAssertTrue(response.hasVerifiedMembers)
    }

    // MARK: - Mailbox V1

    func testMailboxListDecodes() throws {
        let json = """
        { "mail": [{
          "id": "m1", "type": "notice", "viewed": false, "archived": false, "starred": false,
          "tags": ["urgent"], "priority": "normal", "created_at": "2025-01-01T00:00:00Z"
        }], "count": 1 }
        """
        let response = try decode(MailboxListResponse.self, from: json)
        XCTAssertEqual(response.count, 1)
        XCTAssertEqual(response.mail[0].tags, ["urgent"])
    }

    func testAckResponseDecodes() throws {
        let json = "{ \"message\": \"ok\", \"ackStatus\": \"acknowledged\" }"
        let response = try decode(AckResponse.self, from: json)
        XCTAssertEqual(response.ackStatus, "acknowledged")
    }

    // MARK: - Mailbox V2

    func testDrawerListDecodes() throws {
        let json = """
        { "drawers": [{
          "drawer": "personal", "display_name": "Personal", "icon": "inbox",
          "unread_count": 3, "urgent_count": 1, "last_item_at": "2025-02-01T00:00:00Z"
        }] }
        """
        let response = try decode(DrawerListResponse.self, from: json)
        XCTAssertEqual(response.drawers[0].drawer, "personal")
        XCTAssertEqual(response.drawers[0].displayName, "Personal")
    }

    func testPackageStatusUpdateDecodes() throws {
        let json = """
        { "message": "ok", "status": "delivered", "previousStatus": "out_for_delivery" }
        """
        let response = try decode(PackageStatusUpdateResponse.self, from: json)
        XCTAssertEqual(response.status, "delivered")
        XCTAssertEqual(response.previousStatus, "out_for_delivery")
    }
}
