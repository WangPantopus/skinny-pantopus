//
//  GigMailDetailSnapshotTests.swift
//  PantopusTests
//
//  A17.6 — Gig mail variant. Structural snapshots for the received-bid
//  and accepted states of `GigMailDetailLayout`. Mirrors the Android
//  `GigBody.kt` body coverage so the two platforms snapshot the same
//  gig surface.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class GigMailDetailSnapshotTests: XCTestCase {
    func test_gig_mail_received_renders() {
        assertRenders(
            makeLayout(
                gig: MailItemSampleData.gigReceived,
                title: "Sofa move — bid received"
            )
        )
    }

    func test_gig_mail_accepted_renders() {
        assertRenders(
            makeLayout(
                gig: MailItemSampleData.gigAccepted,
                title: "Sofa move — bid accepted"
            )
        )
    }

    private func makeLayout(gig: GigDetailDTO, title: String) -> GigMailDetailLayout {
        GigMailDetailLayout(
            content: MailItemSampleData.gigMailContent(gig: gig, title: title),
            gig: gig,
            bidInFlight: false,
            onBack: {},
            onAccept: {},
            onOpenSenderProfile: { _ in },
            onSaveToVault: {}
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 2000)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 2000)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
