//
//  HomeSecurityViewModelTests.swift
//  PantopusTests
//
//  P5.1 / A14.2 — projection tests for the per-home Security screen.
//  Locks the shape (only the enforced address-precision toggle is offered;
//  all nine stored toggles stay in the model) plus the helper-line copy —
//  the strings here MUST stay in sync with the Android
//  `HomeSecurityHelpers` object so that iOS+Android parity holds.
//
//  P3F: the view-model now reads `GET /api/homes/:id/privacy` and PATCHes
//  each flip. Projection tests use the explicit preview factory; networking
//  fixtures provide a successful required read before testing mutations.
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

    private let balancedResponse = """
    {"privacy":{"home_id":"home-1","guest_approval":true,"member_name_visibility":true,
    "address_precision":false,"activity_visibility":true,"map_opt_out":false,
    "notification_previews":true,"doc_lock":true,"photo_blur":false,"vault_auto_lock":false}}
    """

    private func makeSeededVM(variant: HomeSecurityViewModel.Variant) -> HomeSecurityViewModel {
        HomeSecurityViewModel.preview(variant: variant)
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
        XCTAssertEqual(groups.map(\.id), ["accessControl"])
        XCTAssertEqual(groups.first?.rows.map(\.id), [HomeSecurityViewModel.Toggles.addressPrecision])
        for row in groups.flatMap(\.rows) {
            if case .toggle = row.control { /* ok */ } else {
                XCTFail("Row \(row.id) should be a toggle")
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
            "Place shows this Home's full street address, including the unit number."
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
            "Place shows this Home's street without the unit number."
        )
    }

    func testToggleFlipUpdatesState() async {
        SequencedURLProtocol.sequence = [.status(200, body: balancedResponse), .status(200, body: "{}")]
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
        // GET succeeds with addressPrecision off; PATCH fails → revert.
        SequencedURLProtocol.sequence = [.status(200, body: balancedResponse), .status(500, body: "{}")]
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
