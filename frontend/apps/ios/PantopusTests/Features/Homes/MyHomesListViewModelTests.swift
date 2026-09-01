//
//  MyHomesListViewModelTests.swift
//  PantopusTests
//
//  T6.3f / P14 — covers the refreshed `MyHomesListViewModel`. Validates:
//    - load → loaded / empty / error transitions
//    - row projection (title, subtitle assembly, role label, "Active
//      home" chip on the primary-owner row, .home identity ring,
//      ringProgress reflects ownership_status)
//    - banner appears only when rows are loaded
//    - FAB tinted `.home` with .secondaryCreate variant
//

import XCTest
@testable import Pantopus

@MainActor
final class MyHomesListViewModelTests: XCTestCase {
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

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"homes\":[]}")]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "You don\u{2019}t belong to any homes yet")
        XCTAssertEqual(content.ctaTitle, "Claim a home")
        XCTAssertNil(vm.banner, "Banner is suppressed when there are no homes")
    }

    func testLoadPopulatedRendersRichRows() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"homes":[
              {"id":"h1","name":"Birch Lane","address":"412 Birch Ln","city":"Elm Park","state":"NY",
               "ownership_status":"verified","is_primary_owner":true,
               "occupancy":{"id":"o1","role":"owner","role_base":"owner","is_active":true,
                            "verification_status":"verified"}},
              {"id":"h2","name":null,"address":"88 Greenwood Ave","city":"Sellwood","state":"OR",
               "ownership_status":null,
               "occupancy":{"id":"o2","role":"lease_resident","role_base":"lease_resident",
                            "is_active":true,"verification_status":"verified"}}
            ]}
            """)
        ]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let rows = sections.first?.rows else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 2)
        // Primary-owner row carries Active-home chip + nickname title.
        XCTAssertEqual(rows[0].id, "h1")
        XCTAssertEqual(rows[0].title, "Birch Lane")
        XCTAssertEqual(rows[0].subtitle, "Owner · Elm Park, NY")
        XCTAssertEqual(rows[0].chips?.count, 1)
        XCTAssertEqual(rows[0].chips?.first?.text, "Active home")
        if case let .avatar(_, _, identity, ringProgress) = rows[0].leading {
            XCTAssertEqual(identity, .home)
            XCTAssertEqual(ringProgress, 1.0)
        } else {
            XCTFail("Expected .avatar leading on primary row")
        }
        // Tenant row drops to address title + tenant role + lower ring.
        XCTAssertEqual(rows[1].title, "88 Greenwood Ave")
        XCTAssertEqual(rows[1].subtitle, "Tenant · Sellwood, OR")
        XCTAssertNil(rows[1].chips, "Active-home chip is primary-only")
        if case let .avatar(_, _, _, ringProgress) = rows[1].leading {
            XCTAssertEqual(ringProgress, 0.3)
        } else {
            XCTFail("Expected .avatar leading on tenant row")
        }
        // Banner shows count + tap hint when populated.
        XCTAssertNotNil(vm.banner)
        XCTAssertEqual(vm.banner?.title, "2 homes you belong to")
        XCTAssertEqual(vm.banner?.tint, .home)
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MyHomesListViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testFabUsesHomeIdentityTintAndSecondaryCreate() {
        let vm = MyHomesListViewModel()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.tint, .home)
        XCTAssertEqual(fab.accessibilityLabel, "Claim a home")
        if case .secondaryCreate = fab.variant {} else {
            XCTFail("Expected .secondaryCreate variant, got \(fab.variant)")
        }
    }
}
