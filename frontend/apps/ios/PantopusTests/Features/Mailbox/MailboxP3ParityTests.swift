//
//  MailboxP3ParityTests.swift
//  PantopusTests
//
//  M5 — covers the three RN→native parity fixes in the mailbox package:
//  the A11.4 map-pin projection, the A14.8 vacation-hold projection, and
//  the A17.1 per-category ACTIONS row (`CATEGORY_ACTIONS` + the
//  unknown-sender Pay/Sign suppression).
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class MailboxP3ParityTests: XCTestCase {
    // MARK: - CATEGORY_ACTIONS (constants.ts:25-33)

    func test_categoryActions_matchRNVerbatim() {
        let expected: [String: [String]] = [
            "bill": ["Pay", "Remind", "File", "Forward", "Dispute"],
            "legal": ["File Now", "Forward", "Remind"],
            "notice": ["Acknowledge", "Share with Household", "Create Task", "File"],
            "receipt": ["File", "Forward"],
            "community": ["Acknowledge", "Share with Household", "File"],
            "promo": ["Save Offer", "Dismiss"],
            "other": ["File", "Forward"]
        ]
        for (category, labels) in expected {
            let actions = MailCategoryActions.actions(
                forCategory: category,
                isSenderUnknown: false
            )
            XCTAssertEqual(actions.map(\.label), labels, "CATEGORY_ACTIONS[\(category)]")
        }
    }

    func test_unknownCategory_fallsBackToOther() {
        let actions = MailCategoryActions.actions(forCategory: "not-a-category", isSenderUnknown: false)
        XCTAssertEqual(actions.map(\.label), ["File", "Forward"])
        let missing = MailCategoryActions.actions(forCategory: nil, isSenderUnknown: false)
        XCTAssertEqual(missing.map(\.label), ["File", "Forward"])
    }

    func test_unknownSender_suppressesPayAndSign() {
        let actions = MailCategoryActions.actions(forCategory: "bill", isSenderUnknown: true)
        XCTAssertEqual(actions.map(\.label), ["Remind", "File", "Forward", "Dispute"])
        XCTAssertFalse(actions.contains(.pay))
        XCTAssertFalse(actions.contains(.sign))
    }

    /// Every wire key must be inside the backend allow-list at
    /// `backend/routes/mailboxV2.js:464` — RN's derived keys are not.
    func test_everyActionKeyIsBackendValid() {
        let valid: Set<String> = [
            "pay", "sign", "forward", "file", "shred", "remind",
            "split", "acknowledge", "share_household", "create_task", "dispute"
        ]
        for action in MailCategoryAction.allCases {
            XCTAssertTrue(
                valid.contains(action.actionKey),
                "\(action.label) → \(action.actionKey) is not in the backend allow-list"
            )
        }
    }

    func test_onlyDismissIsDestructive() {
        let destructive = MailCategoryAction.allCases.filter(\.isDestructive)
        XCTAssertEqual(destructive, [.dismiss])
    }

    // MARK: - A11.4 map-pin projection

    func test_mapPinProjection_mapsTypeAndCopy() throws {
        let pin = try decodePin(
            """
            {"id":"pin_1","pin_type":"civic","title":"Hydrant flush",
             "body":"Open hydrant","visible_to":"neighborhood","lat":37.7,"lng":-122.4}
            """
        )
        let spot = MailboxMapViewModel.spot(from: pin)
        XCTAssertEqual(spot.id, "pin_1")
        XCTAssertEqual(spot.kind, .civic)
        XCTAssertEqual(spot.name, "Hydrant flush")
        XCTAssertEqual(spot.address, "Open hydrant")
        XCTAssertEqual(spot.statusLabel, "neighborhood")
        XCTAssertTrue(spot.services.isEmpty, "HomeMapPin carries no services")
        XCTAssertTrue(spot.weekHours.isEmpty, "HomeMapPin carries no hours")
    }

    func test_mapPinProjection_pinTypeBuckets() {
        XCTAssertEqual(MailboxMapViewModel.spotKind(forPinType: "delivery"), .carrier)
        XCTAssertEqual(MailboxMapViewModel.spotKind(forPinType: "permit"), .civic)
        XCTAssertEqual(MailboxMapViewModel.spotKind(forPinType: "utility_work"), .civic)
        XCTAssertEqual(MailboxMapViewModel.spotKind(forPinType: nil), .drop)
    }

    func test_mapPinProjection_positionsAreStableAndInBounds() throws {
        let pin = try decodePin(#"{"id":"pin_abc","pin_type":"notice","title":"Notice"}"#)
        let first = MailboxMapViewModel.spot(from: pin)
        let second = MailboxMapViewModel.spot(from: pin)
        XCTAssertEqual(first.mapX, second.mapX)
        XCTAssertEqual(first.mapY, second.mapY)
        XCTAssertTrue((0...1).contains(first.mapX))
        XCTAssertTrue((0...1).contains(first.mapY))
    }

    // MARK: - A14.8 vacation-hold projection

    func test_vacationHoldProjection_mirrorsAndroid() throws {
        let hold = try decodeHold(
            """
            {"id":"hold_1","status":"active","start_date":"2026-12-02",
             "end_date":"2026-12-12","hold_action":"forward_to_household",
             "package_action":"hold_at_carrier","items_held_count":3}
            """
        )
        let today = try XCTUnwrap(VacationHoldViewModel.parseDay("2026-12-07"))
        let active = VacationHoldViewModel.activeHold(from: hold, today: today)
        XCTAssertEqual(active.untilLabel, "Dec 12")
        XCTAssertEqual(active.daysLeft, 5)
        XCTAssertEqual(active.stats.map(\.count), [3])
        XCTAssertEqual(active.heldItems.count, 1)
        XCTAssertNotNil(active.forwarding, "forward_to_household surfaces the forwarding card")
        XCTAssertEqual(active.activeSinceLabel, "Active since Dec 2")
    }

    func test_vacationHoldProjection_noForwardingWhenHeldInVault() throws {
        let hold = try decodeHold(
            """
            {"id":"hold_2","status":"active","start_date":"2026-12-02",
             "end_date":"2026-12-12","hold_action":"hold_in_vault","items_held_count":0}
            """
        )
        let active = VacationHoldViewModel.activeHold(from: hold)
        XCTAssertNil(active.forwarding)
        XCTAssertTrue(active.heldItems.isEmpty, "A zero count renders no ledger row")
    }

    func test_isoDayRoundTripsTheWireFormat() throws {
        let parsed = try XCTUnwrap(VacationHoldViewModel.parseDay("2026-06-09T00:00:00.000Z"))
        XCTAssertEqual(VacationHoldViewModel.isoDay(parsed), "2026-06-09")
    }

    /// The live composer must not present fixture data as the user's own.
    func test_liveDefaultDraft_carriesNoFabricatedUserData() {
        let draft = VacationScheduleDraft.liveDefault()
        XCTAssertNil(draft.forwarding)
        XCTAssertNil(draft.emergency)
        XCTAssertFalse(draft.forwardingEnabled)
        XCTAssertEqual(draft.spanDays, 8, "today → +7 days, inclusive of both endpoints")
        XCTAssertTrue(draft.isValid)
    }

    // MARK: - Helpers

    private func decodePin(_ json: String) throws -> HomeMapPinDTO {
        try JSONDecoder().decode(HomeMapPinDTO.self, from: Data(json.utf8))
    }

    private func decodeHold(_ json: String) throws -> VacationHoldDTO {
        try JSONDecoder().decode(VacationHoldDTO.self, from: Data(json.utf8))
    }
}
