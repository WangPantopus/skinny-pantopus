//
//  JustMovedCardTests.swift
//  PantopusTests
//
//  The first-week card's window and its local memory of ticks and dismissal.
//

import XCTest
@testable import Pantopus

final class JustMovedCardTests: XCTestCase {
    private func iso(_ daysAgo: Int) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date())!)
    }

    func test_window_is_sixty_days_back_and_two_weeks_ahead() {
        XCTAssertTrue(isRecentMove(iso(0)))
        XCTAssertTrue(isRecentMove(iso(59)))
        XCTAssertFalse(isRecentMove(iso(61)))
        XCTAssertTrue(isRecentMove(iso(-10)))
        XCTAssertFalse(isRecentMove(iso(-20)))
        XCTAssertFalse(isRecentMove(nil))
        XCTAssertFalse(isRecentMove("not a date"))
        XCTAssertTrue(isRecentMove(iso(3) + "T00:00:00Z"), "timestamps are read by their date prefix")
    }

    func test_store_keeps_ticks_and_dismissal_per_home() {
        let defaults = UserDefaults(suiteName: "JustMovedCardTests")!
        defaults.removePersistentDomain(forName: "JustMovedCardTests")
        let a = JustMovedStore(homeId: "h1", defaults: defaults)
        let b = JustMovedStore(homeId: "h2", defaults: defaults)

        XCTAssertTrue(a.done.isEmpty)
        a.setDone([.mail, .block])
        XCTAssertEqual(a.done, [.mail, .block])
        XCTAssertTrue(b.done.isEmpty, "ticks are per home")

        XCTAssertFalse(a.isDismissed)
        a.dismiss()
        XCTAssertTrue(a.isDismissed)
        XCTAssertFalse(b.isDismissed)
    }
}
