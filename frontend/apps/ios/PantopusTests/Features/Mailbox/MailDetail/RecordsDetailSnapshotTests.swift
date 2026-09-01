//
//  RecordsDetailSnapshotTests.swift
//  PantopusTests
//
//  A17.10 — structural render snapshots for the Records ceremonial
//  variant across both designed states: open (File-in-vault CTA + no
//  related strip) and filed (Status row prepended + retention banner +
//  related quarterlies). Same pattern as `CeremonialVariantsSnapshotTests`:
//  until `swift-snapshot-testing` ships in `project.yml`, each fixture
//  asserts a valid hosting hierarchy with non-zero geometry, backed by
//  invariant checks on the sample record.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class RecordsDetailSnapshotTests: XCTestCase {
    // MARK: - Render states

    func test_records_layout_open_renders() {
        assertRenders(
            RecordsDetailLayout(
                content: makeContent(title: RecordsSampleData.recordTitle),
                records: MailItemSampleData.recordsOpen,
                fileInFlight: false,
                onBack: {},
                onFileInVault: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_records_layout_filed_renders() {
        let content = MailDetailContent.replacingRecordsFiled(
            makeContent(title: "Filed statement"),
            with: true,
            filedAtLabel: "Today 2:14 PM · retention 7y"
        )
        assertRenders(
            RecordsDetailLayout(
                content: content,
                records: MailItemSampleData.recordsFiled,
                fileInFlight: false,
                onBack: {},
                onFileInVault: {},
                onOpenSenderProfile: { _ in },
                onSaveToVault: {}
            )
        )
    }

    func test_records_components_render() {
        assertRenders(IssuerCard(issuer: MailItemSampleData.recordsOpen.issuer))
        assertRenders(
            VaultBreadcrumb(
                trail: MailItemSampleData.recordsOpen.vaultTrail,
                retentionLine: MailItemSampleData.recordsOpen.retentionLine,
                isFiled: false
            ) {}
        )
        assertRenders(
            RelatedRecords(records: MailItemSampleData.recordsFiled.related, total: 8)
        )
    }

    // MARK: - Sample-data invariants

    func test_openFixture_shape() {
        let record = MailItemSampleData.recordsOpen
        XCTAssertFalse(record.isFiled)
        XCTAssertEqual(record.pageCount, 4)
        XCTAssertEqual(record.openingFacts.count, 5)
        XCTAssertEqual(record.elfOpen.bullets.count, 3)
        XCTAssertEqual(record.related.count, 3, "Three quarterly siblings")
        // The breadcrumb terminates on the current folder (2026).
        XCTAssertEqual(record.vaultTrail.last?.isCurrent, true)
        XCTAssertEqual(record.vaultTrail.filter(\.isCurrent).count, 1)
        XCTAssertEqual(record.vaultTrail.count, 5)
        // Net change is the positive-tone emphasis fact.
        let positive = record.openingFacts.filter { $0.tone == .positive }
        XCTAssertEqual(positive.count, 1)
        XCTAssertEqual(positive.first?.kind, .change)
        XCTAssertEqual(positive.first?.value, "+$3,419.08")
        // Account is the mono fact.
        XCTAssertEqual(record.openingFacts.first { $0.mono }?.kind, .account)
    }

    func test_openFacts_omitStatusRow() {
        let facts = MailItemSampleData.recordsOpen.factsForState(filed: false)
        XCTAssertEqual(facts.count, 5)
        XCTAssertNil(facts.first { $0.kind == .status })
    }

    func test_filedFacts_prependStatusRow() {
        let facts = MailItemSampleData.recordsFiled.factsForState(filed: true)
        XCTAssertEqual(facts.count, 6)
        XCTAssertEqual(facts.first?.kind, .status)
        XCTAssertEqual(facts.first?.value, "Filed in Vault")
        XCTAssertEqual(facts.first?.tone, .positive)
    }

    func test_filedFixture_shape() {
        let record = MailItemSampleData.recordsFiled
        XCTAssertTrue(record.isFiled)
        XCTAssertEqual(record.elfFiled.bullets.count, 3)
        XCTAssertNotNil(record.filedAtLabel)
    }

    func test_withFiled_flipsOnlyFiledFields() {
        let open = MailItemSampleData.recordsOpen
        let filed = open.withFiled(true, filedAtLabel: "Today 2:14 PM · retention 7y")
        XCTAssertNotEqual(open.isFiled, filed.isFiled)
        XCTAssertNil(open.filedAtLabel)
        XCTAssertNotNil(filed.filedAtLabel)
        // Everything else is untouched.
        XCTAssertEqual(filed.title, open.title)
        XCTAssertEqual(filed.openingFacts, open.openingFacts)
        XCTAssertEqual(filed.vaultTrail, open.vaultTrail)
        XCTAssertEqual(filed.related, open.related)
    }

    // MARK: - Fixtures

    private func makeContent(title: String) -> MailDetailContent {
        MailDetailContent(
            mailId: "mail-records",
            category: .records,
            trust: .verified,
            detailTrust: .verified,
            senderDisplayName: RecordsSampleData.senderName,
            senderMeta: "Retirement Services",
            senderTypeLabel: "Verified sender",
            carrierLine: "via Pantopus Mail",
            senderInitials: "MW",
            senderUserId: nil,
            title: title,
            excerpt: nil,
            referenceLabel: "Statement MWM-2026-Q1-9981842",
            createdAtLabel: "9h ago",
            expiresAtLabel: nil,
            readStatusLabel: "Unread",
            bodyParagraphs: [],
            attachments: [],
            aiSummary: nil,
            ackRequired: false,
            isAcknowledged: false,
            recordsDetail: MailItemSampleData.recordsOpen
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: view
                .frame(width: 390, height: 2200)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 2200)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
