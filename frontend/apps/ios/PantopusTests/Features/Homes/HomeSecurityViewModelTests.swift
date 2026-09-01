//
//  HomeSecurityViewModelTests.swift
//  PantopusTests
//
//  P5.1 / A14.2 — projection tests for the per-home Security toggles.
//  Locks the audit's required shape (3 groups × 3 toggles = 9) plus
//  the helper-line copy contract — the strings here MUST stay in
//  sync with the Android `HomeSecurityHelpers` object so that
//  iOS+Android parity holds.
//
//  P3F: the view-model now reads `GET /api/homes/:id/privacy` and PATCHes
//  each flip. The projection tests drive a stubbed `APIClient` whose GET
//  fails so the view-model falls back to its `variant` seed (the offline
//  baseline), keeping the projection assertions data-source-agnostic. The
//  networked happy-path + rollback are covered separately.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeSecurityViewModelTests: XCTestCase {
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

    /// VM whose `load()` GET fails (no stubbed response), so it falls back
    /// to the `variant` seed.
    private func makeSeededVM(variant: HomeSecurityViewModel.Variant) -> HomeSecurityViewModel {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        return HomeSecurityViewModel(homeId: "home-1", api: makeAPI(), variant: variant)
    }

    func testBalancedVariantHasFiveTogglesOn() async {
        let vm = makeSeededVM(variant: .balanced)
        await vm.load()
        XCTAssertEqual(vm.toggles.values.filter { $0 }.count, 5)
    }

    func testStrictVariantHasNineTogglesOn() async {
        let vm = makeSeededVM(variant: .strict)
        await vm.load()
        XCTAssertEqual(vm.toggles.count, 9)
        XCTAssertTrue(vm.toggles.values.allSatisfy { $0 })
    }

    func testGroupShapeMatchesAudit() async {
        let vm = makeSeededVM(variant: .balanced)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(groups.map(\.id), ["accessControl", "privacy", "documents"])
        for group in groups {
            XCTAssertEqual(group.rows.count, 3, "Group \(group.id) should have 3 toggles")
            for row in group.rows {
                if case .toggle = row.control { /* ok */ } else {
                    XCTFail("Row \(row.id) should be a toggle")
                }
            }
        }
    }

    func testBalancedHelpersUseMixedStateCopy() async {
        let vm = makeSeededVM(variant: .balanced)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let helpers = Dictionary(uniqueKeysWithValues: groups.map { ($0.id, $0.helper) })
        XCTAssertEqual(
            helpers["accessControl"],
            "Guest approval is on, so guests need an owner-tap to enter."
        )
        XCTAssertEqual(
            helpers["privacy"],
            "Visible to verified neighbors only. Address used for deliveries."
        )
        XCTAssertEqual(
            helpers["documents"],
            "Docs unlock with Face ID. Previews still appear in chat."
        )
    }

    func testStrictHelpersShiftToConsequenceLanguage() async {
        let vm = makeSeededVM(variant: .strict)
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let helpers = Dictionary(uniqueKeysWithValues: groups.map { ($0.id, $0.helper) })
        XCTAssertEqual(
            helpers["accessControl"],
            "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
        )
        XCTAssertEqual(
            helpers["privacy"],
            "Hidden from the neighborhood map, previews suppressed. Outsiders only see your home name."
        )
        XCTAssertEqual(
            helpers["documents"],
            "All docs require Face ID. Previews stay blurred everywhere, including notifications."
        )
    }

    func testGuestApprovalOffShowsTighten() async {
        // GET fails → balanced seed; PATCH succeeds so the flip sticks.
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(200, body: "{}")]
        let vm = HomeSecurityViewModel(homeId: "home-1", api: makeAPI(), variant: .balanced)
        await vm.load()
        await vm.toggleRow(HomeSecurityViewModel.Toggles.guestApproval, isOn: false)
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let access = groups.first { $0.id == "accessControl" }
        XCTAssertEqual(
            access?.helper,
            "Guest approval is off — anyone with a code is in. Tighten this if you're away."
        )
    }

    func testToggleFlipUpdatesState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(200, body: "{}")]
        let vm = HomeSecurityViewModel(homeId: "home-1", api: makeAPI(), variant: .balanced)
        await vm.load()
        await vm.toggleRow(HomeSecurityViewModel.Toggles.addressPrecision, isOn: true)
        XCTAssertEqual(vm.toggles[HomeSecurityViewModel.Toggles.addressPrecision], true)
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = groups.flatMap(\.rows).first { $0.id == HomeSecurityViewModel.Toggles.addressPrecision }
        if case let .toggle(isOn) = row?.control {
            XCTAssertTrue(isOn)
        } else {
            XCTFail("Expected toggle control")
        }
    }

    // MARK: - Networking

    func testLoadAppliesServerToggles() async {
        // Server says map_opt_out is on — overriding the balanced seed's off.
        let json = """
        {"privacy":{"home_id":"home-1","guest_approval":true,"member_name_visibility":true,\
        "address_precision":false,"activity_visibility":true,"map_opt_out":true,\
        "notification_previews":true,"doc_lock":true,"photo_blur":false,"vault_auto_lock":false}}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let vm = HomeSecurityViewModel(homeId: "home-1", api: makeAPI(), variant: .balanced)
        await vm.load()
        XCTAssertEqual(vm.toggles[HomeSecurityViewModel.Toggles.mapOptOut], true)
    }

    func testToggleRollsBackOnPatchFailure() async {
        // GET fails → balanced seed (addressPrecision off); PATCH fails → revert.
        SequencedURLProtocol.sequence = [.status(500, body: "{}"), .status(500, body: "{}")]
        let vm = HomeSecurityViewModel(homeId: "home-1", api: makeAPI(), variant: .balanced)
        await vm.load()
        await vm.toggleRow(HomeSecurityViewModel.Toggles.addressPrecision, isOn: true)
        XCTAssertEqual(
            vm.toggles[HomeSecurityViewModel.Toggles.addressPrecision],
            false,
            "A failed PATCH must roll the toggle back"
        )
    }
}
