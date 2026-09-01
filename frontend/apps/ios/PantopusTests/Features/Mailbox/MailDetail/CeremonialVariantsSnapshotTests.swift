//
//  CeremonialVariantsSnapshotTests.swift
//  PantopusTests
//
//  A17.1, A17.5–A17.8 — structural snapshots for the bespoke generic
//  layout extraction plus the four new ceremonial variants (Coupon,
//  Gig, Memory, Package). Mirrors `MailDetailSnapshotTests` for the
//  booklet/community/certified families.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class CeremonialVariantsSnapshotTests: XCTestCase {
    // MARK: - A17.1 Generic (now a bespoke file)

    func test_generic_layout_renders() {
        assertRenders(
            GenericMailDetailLayout(
                content: makeContent(category: .notice, title: "Generic layout extraction"),
                ackInFlight: false,
                onBack: {},
                onAcknowledge: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    // MARK: - A17.5 Coupon

    func test_coupon_layout_unused_renders() {
        assertRenders(
            CouponDetailLayout(
                content: makeContent(category: .coupon, title: "25% off at Brass Owl"),
                coupon: MailItemSampleData.couponUnused,
                redeemInFlight: false,
                onBack: {},
                onRedeem: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_coupon_layout_redeemed_renders() {
        let content = MailDetailContent.replacingAck(
            makeContent(category: .coupon, title: "Redeemed coupon"),
            with: true
        )
        assertRenders(
            CouponDetailLayout(
                content: content,
                coupon: MailItemSampleData.couponRedeemed,
                redeemInFlight: false,
                onBack: {},
                onRedeem: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    // MARK: - A17.6 Gig

    func test_gig_layout_received_renders() {
        assertRenders(
            GigMailDetailLayout(
                content: makeContent(category: .gig, title: "Sofa move — bid received"),
                gig: MailItemSampleData.gigReceived,
                bidInFlight: false,
                onBack: {},
                onAccept: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_gig_layout_accepted_renders() {
        assertRenders(
            GigMailDetailLayout(
                content: makeContent(category: .gig, title: "Sofa move — accepted"),
                gig: MailItemSampleData.gigAccepted,
                bidInFlight: false,
                onBack: {},
                onAccept: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    // MARK: - A17.7 Memory

    func test_memory_layout_fresh_renders() {
        assertRenders(
            MemoryDetailLayout(
                content: makeContent(category: .memory, title: MemorySampleData.memory.title),
                memory: MemorySampleData.memory,
                saveInFlight: false,
                onBack: {},
                onSaveMemory: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_memory_layout_saved_renders() {
        assertRenders(
            MemoryDetailLayout(
                content: makeContent(category: .memory, title: "Saved memory"),
                memory: MemorySampleData.savedMemory,
                saveInFlight: false,
                onBack: {},
                onSaveMemory: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    // MARK: - A17.8 Package

    func test_package_layout_out_for_delivery_renders() {
        assertRenders(
            PackageDetailLayout(
                content: makeContent(category: .package, title: "Out for delivery"),
                package: MailItemSampleData.packageOutForDelivery,
                ackInFlight: false,
                onBack: {},
                onAcknowledgeDelivery: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_package_layout_delivered_renders() {
        let content = MailDetailContent.replacingAck(
            makeContent(category: .package, title: "Delivered"),
            with: true
        )
        assertRenders(
            PackageDetailLayout(
                content: content,
                package: MailItemSampleData.packageDelivered,
                ackInFlight: false,
                onBack: {},
                onAcknowledgeDelivery: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_package_layout_ups_delivered_renders() {
        let content = MailDetailContent.replacingAck(
            makeContent(category: .package, title: "UPS package delivered"),
            with: true
        )
        assertRenders(
            PackageDetailLayout(
                content: content,
                package: MailItemSampleData.packageUpsDelivered,
                ackInFlight: false,
                onBack: {},
                onAcknowledgeDelivery: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    // MARK: - Fixtures

    private func makeContent(
        category: MailItemCategory,
        title: String
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: "mail-\(category.rawValue)",
            category: category,
            trust: .verified,
            detailTrust: category.detailTrust,
            senderDisplayName: "Sender Name",
            senderMeta: "@sender",
            senderTypeLabel: "Verified sender",
            carrierLine: "via Pantopus Mail",
            senderInitials: "SN",
            senderUserId: "sender-1",
            title: title,
            excerpt: "A short preview line keeps the subject block in the same shape as production mail.",
            referenceLabel: "Ref \(category.rawValue.uppercased())-2026",
            createdAtLabel: "Fri May 15, 2026",
            expiresAtLabel: nil,
            readStatusLabel: "Unread",
            bodyParagraphs: [],
            attachments: [],
            aiSummary: nil,
            ackRequired: false,
            isAcknowledged: false
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 1800)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1800)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
