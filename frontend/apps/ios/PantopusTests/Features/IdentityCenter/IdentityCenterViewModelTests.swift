//
//  IdentityCenterViewModelTests.swift
//  PantopusTests
//
//  Covers the T3.2 Profiles & Privacy view-model: load() projects all
//  four cards + bridges + privacy + disclosure rows, missing slots
//  produce SetupNeeded CTAs, and setBridge() applies optimistically
//  with a server-success or rollback-on-failure outcome.
//

import XCTest
@testable import Pantopus

@MainActor
final class IdentityCenterViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let fullJSON = """
    {
      "private_account": {"id": "u1", "email": "maria@pantopus.app", "name": "Maria K.", "verified": true},
      "local_profile": {"id": "lp1", "handle": "maria.k", "display_name": "Maria K.",
        "post_count": 47, "connection_count": 23, "verified": true},
      "audience_profile": {"id": "ap1", "handle": "mariathemason", "display_name": "Maria the Mason",
        "follower_count": 1247, "post_cadence": "weekly", "status": "live"},
      "bridges": {"show_persona_on_local": false, "show_local_on_persona": false},
      "homes": [{"id": "h1", "name": "Maple Street"}],
      "business_profiles": [
        {"id": "b1", "display_name": "Maria Masonry", "is_active": true},
        {"id": "b2", "display_name": "Side Hustle Co", "is_active": true}
      ],
      "persona_count": 1,
      "block_counts": {"personal": 2, "audience": 5}
    }
    """

    private static let noAudienceJSON = """
    {
      "private_account": {"id": "u1", "email": "maria@pantopus.app", "verified": true},
      "local_profile": {"id": "lp1", "display_name": "Maria K.", "post_count": 0, "connection_count": 0},
      "audience_profile": null,
      "bridges": null,
      "homes": [],
      "business_profiles": [],
      "persona_count": 0,
      "block_counts": {"personal": 0, "audience": 0}
    }
    """

    func testLoadProjectsAllFourCardsAndRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.identities.count, 4)
        XCTAssertEqual(loaded.identities.map(\.kind), [.local, .personal, .publicProfile, .professional])
        XCTAssertEqual(loaded.bridges.count, 2)
        XCTAssertEqual(loaded.bridges[0].id, "showPublicOnLocal")
        XCTAssertEqual(loaded.bridges[1].id, "showLocalOnPublic")
        XCTAssertEqual(loaded.privacyRows.count, 3)
        XCTAssertEqual(loaded.disclosureRows.count, 3)
        let blockedPersonal = loaded.privacyRows.first { $0.id == "blockedPersonal" }
        XCTAssertEqual(blockedPersonal?.trailing, "2")
        let businessRow = loaded.disclosureRows.first { $0.id == "businessProfiles" }
        XCTAssertEqual(businessRow?.trailing, "2")
        let homesRow = loaded.disclosureRows.first { $0.id == "homes" }
        XCTAssertEqual(homesRow?.trailing, "1 connected")
    }

    func testMissingAudienceProfileYieldsSetupCardAndNoBridges() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.noAudienceJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        let publicCard = loaded.identities.first { $0.kind == .publicProfile }
        guard case let .setupNeeded(cta) = publicCard?.status else {
            XCTFail("Expected SetupNeeded on missing audience profile")
            return
        }
        XCTAssertEqual(cta, "Create")
        XCTAssertTrue(loaded.bridges.isEmpty)
    }

    func testMissingLocalProfileYieldsSetupCard() async {
        let json = """
        {
          "private_account": {"id": "u1", "email": "maria@pantopus.app"},
          "local_profile": null,
          "audience_profile": null,
          "bridges": null,
          "homes": [],
          "business_profiles": [],
          "persona_count": 0,
          "block_counts": {"personal": 0, "audience": 0}
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let localCard = loaded.identities.first { $0.kind == .local }
        guard case let .setupNeeded(cta) = localCard?.status else {
            XCTFail("Expected SetupNeeded on missing local profile")
            return
        }
        XCTAssertEqual(cta, "Set up")
    }

    func testSetBridgeSuccessKeepsOptimisticValue() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.fullJSON),
            .status(200, body: """
            {"bridge": {"show_persona_on_local": true, "show_local_on_persona": false}}
            """)
        ]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        await vm.setBridge("showPublicOnLocal", isOn: true)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = loaded.bridges.first { $0.id == "showPublicOnLocal" }
        XCTAssertTrue(row?.isOn ?? false)
    }

    func testSetBridgeFailureRollsBack() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.fullJSON),
            .status(500, body: "{}")
        ]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        await vm.setBridge("showLocalOnPublic", isOn: true)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = loaded.bridges.first { $0.id == "showLocalOnPublic" }
        XCTAssertFalse(row?.isOn ?? true, "VM should roll back to the seed value when PATCH fails")
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testNoAudienceWithPersonaCountUsesActivateCTA() async {
        let json = """
        {
          "private_account": {"id": "u1", "email": "maria@pantopus.app"},
          "local_profile": null,
          "audience_profile": null,
          "bridges": null,
          "homes": [],
          "business_profiles": [],
          "persona_count": 2,
          "block_counts": {"personal": 0, "audience": 0}
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let publicCard = loaded.identities.first { $0.kind == .publicProfile }
        guard case let .setupNeeded(cta) = publicCard?.status else {
            XCTFail("Expected SetupNeeded")
            return
        }
        XCTAssertEqual(cta, "Activate")
    }

    func testHomesEmptyYieldsNotConnectedLabel() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.noAudienceJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let homesRow = loaded.disclosureRows.first { $0.id == "homes" }
        XCTAssertEqual(homesRow?.trailing, "Not connected")
    }

    func testProfessionalCardUsesSetupWhenNoBusinesses() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.noAudienceJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let professional = loaded.identities.first { $0.kind == .professional }
        guard case let .setupNeeded(cta) = professional?.status else {
            XCTFail("Expected SetupNeeded")
            return
        }
        XCTAssertEqual(cta, "Add")
    }

    func testPublicProfileCardShowsLiveChip() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let publicCard = loaded.identities.first { $0.kind == .publicProfile }
        XCTAssertEqual(publicCard?.chip?.label, "Live")
        XCTAssertEqual(publicCard?.chip?.tone, .success)
    }

    func testBridgesSubtextIsPresentOnBothRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        for row in loaded.bridges {
            XCTAssertNotNil(row.subtext)
        }
    }

    func testPrivacyPreviewRowHasNoTrailing() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.fullJSON)]
        let vm = IdentityCenterViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let preview = loaded.privacyRows.first { $0.id == "privacyPreview" }
        XCTAssertNil(preview?.trailing)
    }
}
