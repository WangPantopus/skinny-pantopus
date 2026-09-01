//
//  MailboxMapViewModelTests.swift
//  PantopusTests
//
//  Covers the A11.4 Mailbox map VM: load surfaces the seeded spots,
//  pin selection drives the detail state (and the active chip), the
//  category filter narrows the rail, back-to-list restores it, and a
//  seeded error survives load.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailboxMapViewModelTests: XCTestCase {
    private func makeVM(
        seededState: MailboxMapState? = nil,
        todayWeekday: Int = 4
    ) -> MailboxMapViewModel {
        MailboxMapViewModel(
            spots: MailboxMapSampleData.spots,
            seededState: seededState,
            todayWeekday: todayWeekday
        )
    }

    func testLoadSurfacesPopulated() async {
        let vm = makeVM()
        await vm.load()
        guard case let .populated(spots) = vm.state else {
            return XCTFail("Expected .populated, got \(vm.state)")
        }
        XCTAssertEqual(spots.count, MailboxMapSampleData.spots.count)
        XCTAssertEqual(spots.count, 12)
    }

    func testSelectMovesToSelected() async {
        let vm = makeVM()
        await vm.load()
        vm.select("hayes-valley-po")
        guard case let .selected(spot, spots) = vm.state else {
            return XCTFail("Expected .selected, got \(vm.state)")
        }
        XCTAssertEqual(spot.id, "hayes-valley-po")
        XCTAssertEqual(spot.kind, .post)
        XCTAssertEqual(spots.count, 12, "Selected state carries the full list for context pins")
        XCTAssertNil(vm.activeKind, "Selecting a pin must not change the list filter")
    }

    func testSelectUnknownIdIsIgnored() async {
        let vm = makeVM()
        await vm.load()
        vm.select("does-not-exist")
        guard case .populated = vm.state else {
            return XCTFail("Unknown id should leave the populated state untouched")
        }
    }

    func testBackToListRestoresPopulated() async {
        let vm = makeVM()
        await vm.load()
        vm.select("hayes-valley-po")
        vm.backToList()
        guard case let .populated(spots) = vm.state else {
            return XCTFail("Expected .populated after back-to-list")
        }
        XCTAssertEqual(spots.count, 12)
    }

    func testSelectKindFiltersRail() async {
        let vm = makeVM()
        await vm.load()
        vm.selectKind(.post)
        guard case let .populated(spots) = vm.state else {
            return XCTFail("Expected .populated after filter")
        }
        XCTAssertEqual(vm.activeKind, .post)
        XCTAssertEqual(spots.count, 2, "Two post offices in the sample set")
        XCTAssertTrue(spots.allSatisfy { $0.kind == .post })
    }

    func testSelectKindNilShowsAll() async {
        let vm = makeVM()
        await vm.load()
        vm.selectKind(.locker)
        vm.selectKind(nil)
        guard case let .populated(spots) = vm.state else {
            return XCTFail("Expected .populated after clearing the filter")
        }
        XCTAssertNil(vm.activeKind)
        XCTAssertEqual(spots.count, 12)
    }

    func testSelectKindFromDetailReturnsToList() async {
        let vm = makeVM()
        await vm.load()
        vm.select("hayes-valley-po")
        vm.selectKind(.locker)
        guard case let .populated(spots) = vm.state else {
            return XCTFail("Tapping a chip from the detail panel returns to the list")
        }
        XCTAssertTrue(spots.allSatisfy { $0.kind == .locker })
    }

    func testSeededErrorSurvivesLoad() async {
        let vm = makeVM(seededState: .error(message: "Couldn't load mailbox spots."))
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Seeded error should survive load")
        }
    }

    func testDetentDefaultsToStandardAndUpdates() {
        let vm = makeVM()
        XCTAssertEqual(vm.detent, .standard)
        vm.setDetent(.expanded)
        XCTAssertEqual(vm.detent, .expanded)
        vm.setDetent(.collapsed)
        XCTAssertEqual(vm.detent, .collapsed)
    }

    func testTodayWeekdayIsInjected() {
        let vm = makeVM(todayWeekday: 6)
        XCTAssertEqual(vm.todayWeekday, 6)
    }

    func testEverySpotHasAFullWeekStrip() {
        for spot in MailboxMapSampleData.spots {
            XCTAssertEqual(spot.weekHours.count, 7, "\(spot.id) should carry a 7-day strip")
            XCTAssertFalse(spot.services.isEmpty, "\(spot.id) should list at least one service")
        }
    }
}
