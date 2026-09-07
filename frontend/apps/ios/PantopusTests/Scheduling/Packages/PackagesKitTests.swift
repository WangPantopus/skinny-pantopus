//
//  PackagesKitTests.swift
//  PantopusTests
//
//  Stream I15 — pure-function coverage for the packages/invoices formatters and
//  the invoice line-item parser. No network.
//

import XCTest
@testable import Pantopus

final class PackagesKitTests: XCTestCase {
    // MARK: Money

    func testFormatRendersCentsAsAmount() {
        XCTAssertTrue(SchedulingMoney.format(cents: 22000, currency: "USD").contains("220"))
        XCTAssertTrue(SchedulingMoney.format(cents: 0, currency: "USD").contains("0"))
        // nil cents reads as zero, never crashes.
        XCTAssertTrue(SchedulingMoney.format(cents: nil, currency: nil).contains("0"))
    }

    func testPerSessionDividesTotal() {
        XCTAssertTrue(SchedulingMoney.perSession(totalCents: 22000, sessions: 5).contains("44"))
        // Zero sessions must not divide by zero.
        XCTAssertTrue(SchedulingMoney.perSession(totalCents: 22000, sessions: 0).contains("0"))
    }

    func testParseCents() {
        XCTAssertEqual(SchedulingMoney.parseCents("$240.00"), 24000)
        XCTAssertEqual(SchedulingMoney.parseCents("240"), 24000)
        XCTAssertEqual(SchedulingMoney.parseCents("240.5"), 24050)
        XCTAssertNil(SchedulingMoney.parseCents(""))
        XCTAssertNil(SchedulingMoney.parseCents("abc"))
    }

    func testParseCentsCommaDecimalLocale() {
        // A comma-decimal keypad emits "240,50" — must parse as 240.50, not
        // inflate 100x by dropping the separator.
        let german = Locale(identifier: "de_DE")
        XCTAssertEqual(SchedulingMoney.parseCents("240,50", locale: german), 24050)
        XCTAssertEqual(SchedulingMoney.parseCents("240", locale: german), 24000)
        // Dot-locale input is unaffected by the locale plumbing.
        XCTAssertEqual(SchedulingMoney.parseCents("240.50", locale: Locale(identifier: "en_US")), 24050)
    }

    func testParseCentsRejectsNonASCIIDigitsAndOverflow() {
        // Arabic-Indic digits must fail to nil (surfaced upstream), never
        // mis-parse.
        XCTAssertNil(SchedulingMoney.parseCents("٢٤٠"))
        // 17+ digit input would overflow Int once scaled to cents — clamp to
        // nil instead of trapping.
        XCTAssertNil(SchedulingMoney.parseCents("99999999999999999999"))
        // Knife-edge: a product rounding to exactly 2^63 passes a
        // `<= Double(Int.max)` guard (Int.max rounds UP to 2^63 as a Double)
        // but still traps Int(_:) — Int(exactly:) must reject it.
        XCTAssertNil(SchedulingMoney.parseCents("92233720368547758.08"))
    }

    // MARK: Invoice line items

    private func jsonValue(_ raw: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(raw.utf8))
    }

    func testLineItemParsingTolerantOfKeyNaming() throws {
        let value = try jsonValue(#"""
        [
          {"description":"Haircut · 45 min","quantity":1,"unit_amount_cents":4800,"total_cents":4800},
          {"name":"5-session package","total_cents":22000},
          {"foo":"bar"}
        ]
        """#)
        let items = InvoiceParsing.lineItems(from: value)
        // The metadata-only `{"foo":"bar"}` row is skipped (no money).
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].label, "Haircut · 45 min")
        XCTAssertEqual(items[0].quantity, 1)
        XCTAssertEqual(items[0].unitCents, 4800)
        XCTAssertEqual(items[0].totalCents, 4800)
        XCTAssertEqual(items[1].label, "5-session package")
        XCTAssertEqual(items[1].totalCents, 22000)
    }

    func testLineItemParsingEmptyForNonArray() throws {
        XCTAssertTrue(InvoiceParsing.lineItems(from: nil).isEmpty)
        XCTAssertTrue(try InvoiceParsing.lineItems(from: jsonValue(#"{"not":"an array"}"#)).isEmpty)
    }

    // MARK: Grouping

    func testGroupingPreservesOrderByDay() {
        let a = makeInvoice(id: "a", created: "2026-06-12T10:00:00Z")
        let b = makeInvoice(id: "b", created: "2026-06-12T09:00:00Z")
        let c = makeInvoice(id: "c", created: "2026-06-10T09:00:00Z")
        let sections = InvoiceGrouping.byDay([a, b, c])
        XCTAssertEqual(sections.count, 2)
        XCTAssertEqual(sections[0].invoices.map(\.id), ["a", "b"])
        XCTAssertEqual(sections[1].invoices.map(\.id), ["c"])
    }

    private func makeInvoice(id: String, created: String) -> InvoiceDTO {
        let raw = #"{"id":"\#(id)","total_cents":1000,"currency":"USD","created_at":"\#(created)"}"#
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(InvoiceDTO.self, from: Data(raw.utf8))
    }
}
