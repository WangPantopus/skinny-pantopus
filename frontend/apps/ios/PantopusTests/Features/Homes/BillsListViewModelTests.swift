//
//  BillsListViewModelTests.swift
//  PantopusTests
//
//  Covers the Bills VM (T6.0a re-skin of T5.2.2):
//    - four-state transitions
//    - 6-state chip derivation (due / dueSoon / overdue / scheduled /
//      paid / cancelled)
//    - per-status projection (chip text + subtitle + inlineChip +
//      highlight)
//    - utility-category inference from payee string (one test per
//      utility)
//    - banner summary projection (30-day total + overdue count)
//    - tab filtering across the new chip set
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class BillsListViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    /// Fixed "now" so chip derivation + subtitle formatting are deterministic.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(api: APIClient? = nil) -> BillsListViewModel {
        // Capture the frozen value locally so the closure is trivially
        // Sendable (no Self-isolated access).
        let frozen = Self.fixedNow
        return BillsListViewModel(
            homeId: "home-1",
            api: api ?? makeAPI()
        ) { frozen }
    }

    private func makeBill(
        status: String = "pending",
        dueDate: String? = "2026-05-25T00:00:00Z",
        providerName: String? = nil,
        amount: Decimal = 10,
        paidAt: String? = nil
    ) -> BillDTO {
        BillDTO(
            id: "b",
            homeId: "h",
            billType: "x",
            providerName: providerName,
            amount: amount,
            dueDate: dueDate,
            status: status,
            paidAt: paidAt
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"bills\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No bills tracked yet")
        XCTAssertEqual(content.ctaTitle, "Add a bill")
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedResponseMapsRowsToAmountWithChipTrailing() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"bills":[
              {"id":"b1","home_id":"home-1","bill_type":"electric",
               "provider_name":"ConEd Electric","amount":142.80,
               "due_date":"2026-05-25T00:00:00Z","status":"pending"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections[0].rows.count, 1)
        let row = sections[0].rows[0]
        XCTAssertEqual(row.id, "b1")
        XCTAssertEqual(row.title, "ConEd Electric")
        guard case let .amountWithChip(amount, chipText, _, _) = row.trailing else {
            XCTFail("Expected amountWithChip trailing")
            return
        }
        XCTAssertEqual(amount, "$142.80")
        XCTAssertEqual(chipText, "Due")
        // Leading is typeIcon with the electric category palette.
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading, got \(row.leading)")
            return
        }
        XCTAssertEqual(icon, .zap)
    }

    // MARK: - 6-state chip derivation

    func testChipStatusCancelledWins() {
        let bill = makeBill(status: "cancelled", dueDate: "2026-05-01T00:00:00Z", paidAt: "2026-05-08T00:00:00Z")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .cancelled)
    }

    func testChipStatusPaidWins() {
        let bill = makeBill(status: "paid", dueDate: "2030-01-01T00:00:00Z", paidAt: "2026-05-08T00:00:00Z")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .paid)
    }

    func testChipStatusScheduledRespectsStatusField() {
        let bill = makeBill(status: "scheduled")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .scheduled)
    }

    func testChipStatusOverdueWhenDueInPastAndNotPaid() {
        let bill = makeBill(dueDate: "2026-05-01T00:00:00Z")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .overdue)
    }

    func testChipStatusDueSoonWhenDueWithin7Days() {
        // fixedNow = 2026-05-15; 6 days out = 2026-05-21 → dueSoon
        let bill = makeBill(dueDate: "2026-05-21T00:00:00Z")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .dueSoon)
    }

    func testChipStatusDueWhenBeyondSevenDays() {
        // fixedNow = 2026-05-15; 14 days out = 2026-05-29 → due
        let bill = makeBill(dueDate: "2026-05-29T00:00:00Z")
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .due)
    }

    func testChipStatusDueWhenNoDueDate() {
        let bill = makeBill(dueDate: nil)
        XCTAssertEqual(BillsListViewModel.chipStatus(for: bill, now: Self.fixedNow), .due)
    }

    // MARK: - Per-status projection (chip text + subtitle + highlight)

    func testProjectionPaidSubtitle() {
        let projection = BillsListViewModel.project(
            bill: makeBill(
                status: "paid",
                dueDate: "2026-05-08T00:00:00Z",
                providerName: "Verizon Fios",
                amount: 89.99,
                paidAt: "2026-05-08T00:00:00Z"
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Paid")
        XCTAssertEqual(projection.chipVariant, .success)
        XCTAssertEqual(projection.subtitle, "Paid May 8")
        XCTAssertEqual(projection.amount, "$89.99")
        XCTAssertNil(projection.inlineChip)
        XCTAssertNil(projection.highlight)
    }

    func testProjectionCancelledRendersMutedHighlight() {
        let projection = BillsListViewModel.project(
            bill: makeBill(status: "cancelled", dueDate: "2026-05-01T00:00:00Z"),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Cancelled")
        XCTAssertEqual(projection.chipVariant, .neutral)
        XCTAssertEqual(projection.subtitle, "Cancelled")
        XCTAssertEqual(projection.highlight, .muted)
    }

    func testProjectionOverdueSubtitle() {
        let projection = BillsListViewModel.project(
            bill: makeBill(
                dueDate: "2026-05-05T00:00:00Z",
                providerName: "Elm St HOA",
                amount: 325.00
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Overdue")
        XCTAssertEqual(projection.chipVariant, .error)
        XCTAssertEqual(projection.subtitle, "Overdue · was due May 5")
        XCTAssertEqual(projection.category, .hoa)
    }

    func testProjectionDueSoonSubtitle() {
        let projection = BillsListViewModel.project(
            bill: makeBill(
                dueDate: "2026-05-20T00:00:00Z",
                providerName: "Verizon Fios",
                amount: 89.99
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Due soon")
        XCTAssertEqual(projection.chipVariant, .warning)
        XCTAssertEqual(projection.subtitle, "Due May 20")
    }

    func testProjectionScheduledAttachesAutoPayInlineChip() {
        let projection = BillsListViewModel.project(
            bill: makeBill(
                status: "scheduled",
                dueDate: "2026-05-18T00:00:00Z",
                providerName: "Verizon Fios",
                amount: 89.99
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Scheduled")
        XCTAssertEqual(projection.chipVariant, .info)
        XCTAssertEqual(projection.subtitle, "Auto-pays May 18")
        XCTAssertEqual(projection.inlineChip?.text, "Auto-pay")
        XCTAssertEqual(projection.inlineChip?.icon, .arrowsRepeat)
    }

    func testProjectionDueSubtitle() {
        let projection = BillsListViewModel.project(
            bill: makeBill(
                dueDate: "2026-05-29T00:00:00Z",
                providerName: "National Grid Gas",
                amount: 67.40
            ),
            now: Self.fixedNow
        )
        XCTAssertEqual(projection.chipText, "Due")
        XCTAssertEqual(projection.chipVariant, .warning)
        XCTAssertEqual(projection.subtitle, "Due May 29")
        XCTAssertEqual(projection.category, .gas)
    }

    // MARK: - Utility category inference (one test per utility)

    func testCategoryElectric() {
        XCTAssertEqual(UtilityCategory.from(payee: "ConEd Electric"), .electric)
        XCTAssertEqual(UtilityCategory.from(payee: "PG&E"), .electric)
        XCTAssertEqual(UtilityCategory.from(payee: "Duke Energy"), .electric)
        XCTAssertEqual(UtilityCategory.from(payee: "Eversource"), .electric)
    }

    func testCategoryGas() {
        XCTAssertEqual(UtilityCategory.from(payee: "National Grid Gas"), .gas)
        XCTAssertEqual(UtilityCategory.from(payee: "SoCalGas"), .gas)
        XCTAssertEqual(UtilityCategory.from(payee: "Atmos Energy"), .gas)
    }

    func testCategoryWater() {
        XCTAssertEqual(UtilityCategory.from(payee: "NYC Water Board"), .water)
        XCTAssertEqual(UtilityCategory.from(payee: "City Sewer Division"), .water)
        XCTAssertEqual(UtilityCategory.from(payee: "Aqua America"), .water)
    }

    func testCategoryInternet() {
        XCTAssertEqual(UtilityCategory.from(payee: "Verizon Fios"), .internetService)
        XCTAssertEqual(UtilityCategory.from(payee: "Comcast Xfinity"), .internetService)
        XCTAssertEqual(UtilityCategory.from(payee: "Spectrum Internet"), .internetService)
        XCTAssertEqual(UtilityCategory.from(payee: "Starlink"), .internetService)
    }

    func testCategoryHOA() {
        XCTAssertEqual(UtilityCategory.from(payee: "Elm St HOA"), .hoa)
        XCTAssertEqual(UtilityCategory.from(payee: "Sunset Condo Association"), .hoa)
        XCTAssertEqual(UtilityCategory.from(payee: "Birch Strata Corp"), .hoa)
    }

    func testCategoryInsurance() {
        XCTAssertEqual(UtilityCategory.from(payee: "State Farm Renters"), .insurance)
        XCTAssertEqual(UtilityCategory.from(payee: "GEICO Auto"), .insurance)
        XCTAssertEqual(UtilityCategory.from(payee: "Allstate Home Insurance"), .insurance)
    }

    func testCategoryTrash() {
        XCTAssertEqual(UtilityCategory.from(payee: "Waste Management"), .trash)
        XCTAssertEqual(UtilityCategory.from(payee: "Recology"), .trash)
        XCTAssertEqual(UtilityCategory.from(payee: "City Refuse Service"), .trash)
    }

    func testCategoryPhone() {
        XCTAssertEqual(UtilityCategory.from(payee: "T-Mobile"), .phone)
        XCTAssertEqual(UtilityCategory.from(payee: "Sprint Wireless"), .phone)
        XCTAssertEqual(UtilityCategory.from(payee: "Mint Mobile"), .phone)
    }

    func testCategoryGenericFallbackForUnknownPayee() {
        XCTAssertEqual(UtilityCategory.from(payee: nil), .generic)
        XCTAssertEqual(UtilityCategory.from(payee: ""), .generic)
        XCTAssertEqual(UtilityCategory.from(payee: "Some Random Vendor"), .generic)
    }

    // MARK: - Banner summary

    func testBannerSummaryWithOverdueAndUpcoming() {
        let bills: [BillDTO] = [
            // Overdue $325 — counts toward total + overdue
            makeBill(id: "b1", dueDate: "2026-05-05T00:00:00Z", providerName: "HOA", amount: 325),
            // Due soon $89.99 — counts toward total
            makeBill(id: "b2", dueDate: "2026-05-20T00:00:00Z", providerName: "Fios", amount: 89.99),
            // Beyond 30 days $48 — excluded from total
            makeBill(id: "b3", dueDate: "2026-07-01T00:00:00Z", providerName: "Water", amount: 48),
            // Paid $42 — excluded entirely
            makeBill(id: "b4", status: "paid", dueDate: "2026-05-08T00:00:00Z", amount: 42, paidAt: "2026-05-08T00:00:00Z"),
            // Cancelled $99 — excluded entirely
            makeBill(id: "b5", status: "cancelled", dueDate: "2026-05-08T00:00:00Z", amount: 99)
        ]
        let summary = BillsListViewModel.summarize(bills: bills, now: Self.fixedNow)
        // 325 (overdue, within 30d) + 89.99 (due soon, within 30d) = 414.99
        XCTAssertEqual(summary.totalDueLabel, "$414.99")
        XCTAssertEqual(summary.overdueCount, 1)
    }

    func testBannerSummaryEmptyWhenAllPaidOrCancelled() {
        let bills: [BillDTO] = [
            makeBill(id: "b1", status: "paid", dueDate: "2026-05-08T00:00:00Z", amount: 42, paidAt: "2026-05-08T00:00:00Z"),
            makeBill(id: "b2", status: "cancelled", dueDate: "2026-05-08T00:00:00Z", amount: 99)
        ]
        let summary = BillsListViewModel.summarize(bills: bills, now: Self.fixedNow)
        XCTAssertNil(summary.totalDueLabel)
        XCTAssertEqual(summary.overdueCount, 0)
        XCTAssertFalse(summary.hasContent)
    }

    func testBannerSubtitleShowsNextBillWhenNoOverdue() {
        let bills: [BillDTO] = [
            // Due in 6 days — `dueSoon` chip; banner picks it as next-up
            makeBill(id: "b1", dueDate: "2026-05-21T00:00:00Z", providerName: "Fios", amount: 89.99)
        ]
        let summary = BillsListViewModel.summarize(bills: bills, now: Self.fixedNow)
        XCTAssertEqual(summary.overdueCount, 0)
        XCTAssertNotNil(summary.nextBillSubtitle)
        XCTAssertTrue(summary.nextBillSubtitle?.contains("next bill") ?? false)
    }

    // MARK: - Tab filtering

    func testTabFilterUpcomingIncludesDueDueSoonOverdueScheduledExcludesPaidCancelled() async {
        SequencedURLProtocol.sequence = [.status(200, body: mixedBillsJSON)]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = "upcoming"
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let ids = Set(sections.flatMap(\.rows).map(\.id))
        XCTAssertEqual(ids, Set(["b-due", "b-dueSoon", "b-overdue", "b-scheduled"]))
    }

    func testTabFilterPaidIncludesOnlyPaid() async {
        SequencedURLProtocol.sequence = [.status(200, body: mixedBillsJSON)]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = "paid"
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections[0].rows.map(\.id), ["b-paid"])
    }

    func testTabFilterAllExcludesCancelled() async {
        SequencedURLProtocol.sequence = [.status(200, body: mixedBillsJSON)]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = "all"
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let ids = Set(sections.flatMap(\.rows).map(\.id))
        XCTAssertEqual(ids, Set(["b-due", "b-dueSoon", "b-overdue", "b-scheduled", "b-paid"]))
        XCTAssertFalse(ids.contains("b-cancelled"))
    }

    // MARK: - FAB variant + tint

    func testFabIsCanonicalCreateWithHomeTint() {
        let vm = makeVM()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        if case .canonicalCreate = fab.variant {
            // OK
        } else {
            XCTFail("Expected canonicalCreate variant, got \(fab.variant)")
        }
        XCTAssertEqual(fab.tint, .home)
        XCTAssertEqual(fab.icon, .plus)
    }

    func testTopBarActionIsNilByDesign() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction)
    }

    // MARK: - Fixtures

    private var mixedBillsJSON: String {
        """
        {"bills":[
          {"id":"b-due","home_id":"home-1","bill_type":"x",
           "provider_name":"Due Bill","amount":10,
           "due_date":"2026-05-29T00:00:00Z","status":"pending"},
          {"id":"b-dueSoon","home_id":"home-1","bill_type":"x",
           "provider_name":"Soon Bill","amount":10,
           "due_date":"2026-05-21T00:00:00Z","status":"pending"},
          {"id":"b-overdue","home_id":"home-1","bill_type":"x",
           "provider_name":"Overdue Bill","amount":10,
           "due_date":"2026-05-01T00:00:00Z","status":"pending"},
          {"id":"b-scheduled","home_id":"home-1","bill_type":"x",
           "provider_name":"Scheduled Bill","amount":10,
           "due_date":"2026-05-25T00:00:00Z","status":"scheduled"},
          {"id":"b-paid","home_id":"home-1","bill_type":"x",
           "provider_name":"Paid Bill","amount":10,
           "due_date":"2026-05-08T00:00:00Z","status":"paid",
           "paid_at":"2026-05-08T00:00:00Z"},
          {"id":"b-cancelled","home_id":"home-1","bill_type":"x",
           "provider_name":"Cancelled Bill","amount":10,
           "due_date":"2026-05-08T00:00:00Z","status":"cancelled"}
        ]}
        """
    }

    /// `makeBill` overload for explicit ids (used by the banner-summary
    /// + mixed-fixture tests).
    private func makeBill(
        id: String,
        status: String = "pending",
        dueDate: String? = "2026-05-25T00:00:00Z",
        providerName: String? = nil,
        amount: Decimal = 10,
        paidAt: String? = nil
    ) -> BillDTO {
        BillDTO(
            id: id,
            homeId: "h",
            billType: "x",
            providerName: providerName,
            amount: amount,
            dueDate: dueDate,
            status: status,
            paidAt: paidAt
        )
    }
}
