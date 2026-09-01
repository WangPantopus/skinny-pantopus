//
//  EventTypeFormatTests.swift
//  PantopusTests
//
//  Stream I2 — formatting, slug + colour-swatch helpers for B1/B2.
//

import XCTest
@testable import Pantopus

final class EventTypeFormatTests: XCTestCase {
    func testDurationFormatting() {
        XCTAssertEqual(EventTypeFormat.duration(30), "30 min")
        XCTAssertEqual(EventTypeFormat.duration(60), "1 hr")
        XCTAssertEqual(EventTypeFormat.duration(90), "1 hr 30 min")
    }

    func testDurationsAndLocation() {
        let summary = EventTypeFormat.durationsAndLocation([30, 60], location: .phone)
        XCTAssertEqual(summary, "30, 1 hr · Phone")
    }

    func testPriceContainsAmount() {
        XCTAssertTrue(EventTypeFormat.price(cents: 12000, currency: "USD").contains("120"))
        XCTAssertTrue(EventTypeFormat.price(cents: 12050, currency: "USD").contains("120.5"))
    }

    func testSlugify() {
        XCTAssertEqual(EventTypeFormat.slugify("Intro Call!"), "intro-call")
        XCTAssertEqual(EventTypeFormat.slugify("  Hello   World  "), "hello-world")
        XCTAssertEqual(EventTypeFormat.slugify("Café meetup"), "cafe-meetup")
    }

    func testIsValidSlug() {
        XCTAssertTrue(EventTypeFormat.isValidSlug("intro-call"))
        XCTAssertFalse(EventTypeFormat.isValidSlug("Intro"))
        XCTAssertFalse(EventTypeFormat.isValidSlug("-bad"))
        XCTAssertFalse(EventTypeFormat.isValidSlug(""))
    }

    func testSwatchMatch() {
        XCTAssertEqual(EventTypeSwatch.match("#7C3AED"), .violet)
        XCTAssertEqual(EventTypeSwatch.match("#7c3aed"), .violet)
        XCTAssertEqual(EventTypeSwatch.match(nil), .sky)
        XCTAssertEqual(EventTypeSwatch.match("not-a-hex"), .sky)
    }

    func testLocationModeMapping() {
        XCTAssertEqual(EventLocationMode.from("in_person"), .inPerson)
        XCTAssertEqual(EventLocationMode.from(nil), .video)
        XCTAssertEqual(EventLocationMode.inPerson.label, "In person")
        XCTAssertNotNil(EventLocationMode.inPerson.detailField)
        XCTAssertNil(EventLocationMode.ask.detailField)
    }
}
