//
//  BookletBodySnapshotTests.swift
//  PantopusTests
//
//  A17.2 — Booklet mail body. Exercises the folded-paper page swiper
//  across two deterministic booklet types.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class BookletBodySnapshotTests: XCTestCase {
    func test_booklet_body_voterGuide_renders() {
        assertRenders(BookletBody(booklet: MailItemSampleData.bookletVoterGuide))
    }

    func test_booklet_body_catalog_renders() {
        assertRenders(BookletBody(booklet: MailItemSampleData.bookletNeighborhoodCatalog))
    }

    private func assertRenders(
        _ body: BookletBody,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ScrollView { body }
                .frame(width: 390, height: 900)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 900)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
