//
//  TodayDetailViewModelTests.swift
//  PantopusTests
//
//  A10.3 — Covers the Today briefing VM:
//    - initial loading state,
//    - load() selecting populated vs. alert from the content,
//    - seeded states (loading / error chrome) surviving load(),
//    - the shape of the populated + alert sample fixtures.
//
//  Today always has data, so there is no `.empty` state — the advisory
//  variant stands in for it.
//

import XCTest
@testable import Pantopus

@MainActor
final class TodayDetailViewModelTests: XCTestCase {
    // MARK: - State machine

    func testInitialStateIsLoading() {
        let vm = TodayDetailViewModel()
        guard case .loading = vm.state else {
            return XCTFail("Expected loading, got \(vm.state)")
        }
    }

    func testLoadResolvesToPopulated() async {
        let vm = TodayDetailViewModel(content: TodaySampleData.populated)
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected populated, got \(vm.state)")
        }
        XCTAssertEqual(content.temperature, "67°")
        XCTAssertEqual(content.condition, "Mostly sunny")
        XCTAssertFalse(content.isAlert)
    }

    func testLoadResolvesToAlertWhenRibbonPresent() async {
        let vm = TodayDetailViewModel(content: TodaySampleData.alert)
        await vm.load()
        guard case let .alert(content) = vm.state else {
            return XCTFail("Expected alert, got \(vm.state)")
        }
        XCTAssertNotNil(content.ribbon)
        XCTAssertTrue(content.isAlert)
        XCTAssertEqual(content.glyph, .snowflake)
    }

    func testRefreshReloadsSameState() async {
        let vm = TodayDetailViewModel(content: TodaySampleData.alert)
        await vm.refresh()
        guard case .alert = vm.state else {
            return XCTFail("Expected alert after refresh, got \(vm.state)")
        }
    }

    func testSeededStateSurvivesLoad() async {
        let vm = TodayDetailViewModel(state: .error(message: "Boom"))
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected seeded error to persist, got \(vm.state)")
        }
        XCTAssertEqual(message, "Boom")
    }

    // MARK: - Sample fixtures

    func testPopulatedFixtureShape() {
        let content = TodaySampleData.populated
        XCTAssertNil(content.ribbon)
        XCTAssertEqual(content.chips.map(\.label), ["AQI", "UV", "Wind"])
        XCTAssertEqual(content.signals.count, 4)
        XCTAssertEqual(content.around.count, 3)
        XCTAssertEqual(content.signalsTitle, "Signals · 4 today")
        XCTAssertEqual(content.signalsAccent, .personal)
        // Pollen is the only severity-tagged signal in the populated frame.
        XCTAssertEqual(content.signals.filter { $0.severity != nil }.count, 1)
    }

    func testAlertFixtureShape() {
        let content = TodaySampleData.alert
        XCTAssertEqual(content.ribbon?.title, "NWS hard-freeze warning · until 8am Fri")
        XCTAssertEqual(content.signals.count, 5)
        XCTAssertEqual(content.signalsTitle, "Signals · 5 today")
        XCTAssertEqual(content.signalsAccent, .error)
        XCTAssertTrue(content.around.isEmpty)
        // Critical (pipe) + Watch (grid) carry severity pills.
        let severities = content.signals.compactMap { $0.severity?.label }
        XCTAssertEqual(severities, ["Critical", "Watch"])
    }

    func testChipDotTonesMatchScale() {
        let chips = TodaySampleData.populated.chips
        XCTAssertEqual(chips[0].dotTone, .success) // AQI Good
        XCTAssertEqual(chips[1].dotTone, .warning) // UV High
        XCTAssertNil(chips[2].dotTone) // Wind has no scale dot in A10.3
    }
}
