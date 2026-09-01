//
//  MyTasksMagicTaskTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

@MainActor
final class MyTasksMagicTaskTests: XCTestCase {
    private struct FormatCase {
        let raw: String
        let label: String
        let icon: PantopusIcon
    }

    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    func testMagicTaskRowUsesMagicArchetypeTileAndOverline() {
        let dto = makeGig(
            id: "mt1",
            status: "open",
            bidCount: 0,
            sourceFlow: "magic",
            taskArchetype: "home_service"
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.archetypeOverline, "Mount & install")
        if case .magicArchetypeTile = row.leading {
            // pass
        } else {
            XCTFail("Magic task row should use magicArchetypeTile leading variant")
        }
    }

    func testNonMagicTaskRowKeepsCategoryGradientIconAndNoOverline() {
        let dto = makeGig(
            id: "cl1",
            status: "open",
            bidCount: 0,
            sourceFlow: "classic",
            taskArchetype: "home_service"
        )
        let row = renderRow(for: dto)
        XCTAssertNil(row.archetypeOverline)
        if case .categoryGradientIcon = row.leading {
            // pass
        } else {
            XCTFail("Non-magic row should use categoryGradientIcon")
        }
    }

    func testMagicTaskRowWithUnknownArchetypeFallsBackToGeneralOverline() {
        let dto = makeGig(
            id: "mt2",
            status: "open",
            sourceFlow: "magic",
            taskArchetype: nil
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.archetypeOverline, "Magic task")
    }

    func testEngagementModeBadgeRendersForAllFourFormats() {
        let cases = [
            FormatCase(raw: "in_person", label: "In person", icon: .mapPin),
            FormatCase(raw: "drop_off", label: "Drop-off", icon: .package),
            FormatCase(raw: "remote", label: "Remote", icon: .monitor),
            FormatCase(raw: "hybrid", label: "Hybrid", icon: .shuffle)
        ]

        for formatCase in cases {
            let dto = makeGig(
                id: "mode-\(formatCase.raw)",
                status: "open",
                bidCount: 1,
                sourceFlow: "magic",
                taskArchetype: "general",
                taskFormat: formatCase.raw
            )
            let row = renderRow(for: dto)
            // Status chip is always first; mode chip is appended second.
            XCTAssertEqual(row.chips?.count, 2, "mode \(formatCase.raw) missing chip")
            let modeChip = row.chips?[1]
            XCTAssertEqual(modeChip?.text, formatCase.label, "mode \(formatCase.raw) wrong label")
            XCTAssertEqual(modeChip?.icon, formatCase.icon, "mode \(formatCase.raw) wrong icon")
            if case .custom = modeChip?.tint {
                // pass
            } else {
                XCTFail("mode chip for \(formatCase.raw) should use custom tint, not status")
            }
        }
    }

    func testEngagementModeBadgeOmittedWhenTaskFormatIsNil() {
        let dto = makeGig(
            id: "no-mode",
            status: "open",
            bidCount: 1,
            sourceFlow: "classic",
            taskArchetype: nil,
            taskFormat: nil
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.chips?.count, 1)
    }

    func testEngagementModeBadgeOmittedForUnknownTaskFormat() {
        let dto = makeGig(
            id: "weird-mode",
            status: "open",
            bidCount: 1,
            sourceFlow: "magic",
            taskArchetype: "general",
            taskFormat: "telepathy"
        )
        let row = renderRow(for: dto)
        XCTAssertEqual(row.chips?.count, 1)
    }

    func testArchetypeOverlineTruncatesAtTwentyFourChars() {
        let archetypeWithLongLabel = MyTasksArchetype.from(rawArchetype: "home_service")
        XCTAssertEqual(archetypeWithLongLabel.overlineLabel, "Mount & install")
        XCTAssertLessThanOrEqual(archetypeWithLongLabel.overlineLabel.count, 24)
    }

    func testIsMagicTaskTrueWhenSourceFlowIsMagicCaseInsensitive() {
        XCTAssertTrue(isMagicTask(makeGig(id: "1", status: "open", sourceFlow: "magic")))
        XCTAssertTrue(isMagicTask(makeGig(id: "2", status: "open", sourceFlow: "MAGIC")))
        XCTAssertFalse(isMagicTask(makeGig(id: "3", status: "open", sourceFlow: "classic")))
        XCTAssertFalse(isMagicTask(makeGig(id: "4", status: "open", sourceFlow: nil)))
    }

    private func renderRow(for dto: MyGigDTO) -> RowModel {
        let status = MyTasksViewModel.derivedStatus(for: dto, now: Self.fixedNow)
        let projection = MyTasksViewModel.GigProjection(
            dto: dto,
            tab: MyTasksViewModel.tabFor(status: status),
            status: status,
            footer: MyTasksViewModel.footerFor(status: status, bidCount: dto.bidCount ?? 0)
        )
        return MyTasksViewModel.row(
            projection: projection,
            now: Self.fixedNow,
            callbacks: MyTasksViewModel.RowCallbacks()
        )
    }

    private func makeGig(
        id: String,
        status: String,
        bidCount: Int = 0,
        sourceFlow: String? = nil,
        taskArchetype: String? = nil,
        taskFormat: String? = nil
    ) -> MyGigDTO {
        MyGigDTO(
            id: id,
            title: "Test gig",
            price: 100,
            category: "handyman",
            status: status,
            createdAt: "2026-05-13T09:00:00Z",
            updatedAt: "2026-05-15T10:00:00Z",
            userId: "u_me",
            bidCount: bidCount,
            sourceFlow: sourceFlow,
            taskArchetype: taskArchetype,
            taskFormat: taskFormat
        )
    }
}
