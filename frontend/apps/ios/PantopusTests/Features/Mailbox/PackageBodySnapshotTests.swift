//
//  PackageBodySnapshotTests.swift
//  PantopusTests
//
//  A17.8 - Package mail body + ceremonial layout. Structural render
//  coverage for the designed states (in transit / out for delivery /
//  delivered) across both the standalone `PackageBody` and the
//  `PackageDetailLayout` ceremonial wrapper, plus the UPS sample fixtures.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PackageBodySnapshotTests: XCTestCase {
    func test_package_inTransit_renders() {
        assertRenders(
            PackageBody(
                content: MailItemSampleData.packageInTransit,
                isReceiveEnabled: false
            )
        )
    }

    func test_package_outForDelivery_renders() {
        assertRenders(
            PackageBody(
                content: MailItemSampleData.packageOutForDelivery,
                isReceiveEnabled: false
            )
        )
    }

    func test_package_delivered_renders() {
        assertRenders(
            PackageBody(
                content: MailItemSampleData.packageDelivered,
                isReceiveEnabled: true
            )
        )
    }

    func test_package_ups_inTransit_renders() {
        assertRenders(
            PackageBody(
                content: MailItemSampleData.packageUpsInTransit,
                isReceiveEnabled: false
            )
        )
    }

    func test_package_ups_delivered_renders() {
        assertRenders(
            PackageBody(
                content: MailItemSampleData.packageUpsDelivered,
                isReceiveEnabled: true
            )
        )
    }

    func test_package_layout_outForDelivery_renders() {
        assertRenders(makeLayout(package: MailItemSampleData.packageOutForDelivery, isAcknowledged: false))
    }

    func test_package_layout_ups_delivered_renders() {
        assertRenders(makeLayout(package: MailItemSampleData.packageUpsDelivered, isAcknowledged: true))
    }

    func test_carrierBadge_renders() {
        assertRenders(
            HStack(spacing: Spacing.s3) {
                CarrierBadge(carrier: "USPS Priority Mail")
                CarrierBadge(carrier: "UPS Ground")
                CarrierBadge(carrier: "FedEx Express")
            }
        )
    }

    func test_packageTrackingTimeline_renders() {
        assertRenders(
            PackageTrackingTimeline(
                steps: MailItemSampleData.packageUpsDelivered.trackingSteps,
                carrier: "UPS"
            ) {}
        )
    }

    func test_package_fixture_shapes_matchA178() {
        // Timeline has the four canonical A17.8 stages.
        XCTAssertEqual(MailItemSampleData.packageOutForDelivery.trackingSteps.map(\.title), [
            "Shipped", "In transit", "Out for delivery", "Delivered"
        ])
        // Photo only attaches to delivered states.
        XCTAssertNil(MailItemSampleData.packageOutForDelivery.deliveryPhoto)
        XCTAssertNotNil(MailItemSampleData.packageDelivered.deliveryPhoto)
        XCTAssertFalse(MailItemSampleData.packageDelivered.handoffSteps.isEmpty)
        XCTAssertEqual(MailItemSampleData.packageDelivered.contents?.items.count, 2)
    }

    func test_package_keyFact_fixtures_present() {
        // KeyFacts: carrier · service · dimensions · weight (+ tracking url).
        let ups = MailItemSampleData.packageUpsInTransit
        XCTAssertEqual(ups.carrier, "UPS")
        XCTAssertEqual(ups.service, "UPS Ground")
        XCTAssertNotNil(ups.dimensions)
        XCTAssertNotNil(ups.weight)
        XCTAssertEqual(ups.trackingNumber, "1Z 999 AA1 0123 4567 84")
        XCTAssertTrue(ups.trackingUrl?.contains("ups.com") ?? false)

        let usps = MailItemSampleData.packageDelivered
        XCTAssertEqual(usps.service, "USPS Priority Mail")
        XCTAssertNotNil(usps.dimensions)
        XCTAssertNotNil(usps.weight)
        XCTAssertTrue(usps.trackingUrl?.contains("usps.com") ?? false)
    }

    private func makeLayout(package: PackageBodyContent, isAcknowledged: Bool) -> some View {
        PackageDetailLayout(
            content: makeContent(package: package, isAcknowledged: isAcknowledged),
            package: package,
            ackInFlight: false,
            onBack: {},
            onAcknowledgeDelivery: {},
            onOpenSenderProfile: { _ in },
            onSaveToVault: {}
        )
    }

    private func makeContent(package: PackageBodyContent, isAcknowledged: Bool) -> MailDetailContent {
        MailDetailContent(
            mailId: "package-sample",
            category: .package,
            trust: .verified,
            detailTrust: .neutral,
            senderDisplayName: "Lerina Books",
            senderMeta: "Portland, OR",
            senderTypeLabel: "Merchant",
            carrierLine: "via \(package.carrier)",
            senderInitials: "LB",
            senderUserId: nil,
            title: "Package on your porch",
            excerpt: nil,
            referenceLabel: package.trackingNumber ?? "",
            createdAtLabel: "12m ago",
            expiresAtLabel: nil,
            readStatusLabel: "Unread",
            bodyParagraphs: [],
            attachments: [],
            aiSummary: nil,
            ackRequired: true,
            isAcknowledged: isAcknowledged,
            isArchived: false,
            packageDetail: package
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ScrollView { view }
                .frame(width: 390, height: 1900)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1900)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
