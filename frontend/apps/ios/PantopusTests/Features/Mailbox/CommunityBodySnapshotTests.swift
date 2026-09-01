//
//  CommunityBodySnapshotTests.swift
//  PantopusTests
//
//  A17.4 - structural render snapshots for Community mail subtypes.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class CommunityBodySnapshotTests: XCTestCase {
    func test_community_event_renders() {
        assertRenders(
            CommunityBody(
                community: MailItemSampleData.communityEvent,
                authorName: "Aliyah W.",
                authorInitials: "AW"
            )
        )
    }

    func test_community_poll_renders() {
        assertRenders(
            CommunityBody(
                community: MailItemSampleData.communityPoll,
                authorName: "Aliyah W.",
                authorInitials: "AW"
            )
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ScrollView { view }
                .frame(width: 390, height: 1500)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1500)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
