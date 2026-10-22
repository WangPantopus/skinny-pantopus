//
//  ReceivedInvoicesViewModel.swift
//  Pantopus
//
//  Backs `ReceivedInvoicesView`: the invoices businesses sent the signed-in
//  person, from `GET /api/businesses/invoices/received` (route
//  `backend/routes/businesses.js:4747`, which leaves out void invoices). The
//  "Invoice Received" notification was the only way to an invoice; this list,
//  opened from the Wallet, is the way back once that is gone. Unpaid invoices
//  come first under a banner with what is owed, and each row opens
//  `InvoiceDetailView` to pay. Rows use the Bills list's amount + status chip.
//  Mirrors Android `ReceivedInvoicesViewModel.kt` and web `/app/invoices`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class ReceivedInvoicesViewModel: ListOfRowsDataSource {
    let title = "Invoices"

    var topBarAction: TopBarAction? {
        nil
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = ""

    var fab: FABAction? {
        nil
    }

    private(set) var state: ListOfRowsState = .loading
    var refreshFailureMessage: String?

    /// What is owed, above the rows, while anything is unpaid.
    var banner: BannerConfig? {
        guard case .loaded = state, let invoices else { return nil }
        let today = Date()
        let unpaid = invoices.filter(Self.isUnpaid)
        guard !unpaid.isEmpty else { return nil }
        let owed = unpaid.reduce(0) { $0 + $1.totalCents }
        let overdue = unpaid.filter { Self.isOverdue($0, now: today) }.count
        let count = unpaid.count == 1 ? "1 invoice" : "\(unpaid.count) invoices"
        return BannerConfig(
            icon: .receiptText,
            title: "\(InvoiceDetailViewModel.money(owed)) to pay",
            subtitle: overdue > 0 ? "\(count) · \(overdue) overdue · tap one to pay by card" : "\(count) · tap one to pay by card",
            tint: overdue > 0 ? .warning : .primary
        )
    }

    private var invoices: [BusinessInvoiceDTO]?
    private let api: APIClient
    private let onOpenInvoice: @Sendable (String) -> Void

    /// The server answers at most 50 a page. A household has a handful, so every page is read before the list splits
    /// them into unpaid and paid.
    private static let pageSize = 50
    private static let maxPages = 10

    init(api: APIClient = .shared, onOpenInvoice: @escaping @Sendable (String) -> Void = { _ in }) {
        self.api = api
        self.onOpenInvoice = onOpenInvoice
    }

    /// The first appearance shows the skeleton. Coming back from an invoice runs the shell's `.task` again, which
    /// re-reads in place, so a payment made there shows here.
    func load() async {
        if invoices == nil { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Every page is read up front.
    func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            invoices = try await Self.fetchAll(api: api)
            rebuildState()
        } catch {
            if Task.isCancelled { return }
            let message = (error as? LocalizedError)?.errorDescription ?? "Couldn't load your invoices."
            if invoices == nil {
                state = .error(message: message)
            } else {
                refreshFailureMessage = message
            }
        }
    }

    private static func fetchAll(api: APIClient) async throws -> [BusinessInvoiceDTO] {
        var seen = Set<String>()
        var all: [BusinessInvoiceDTO] = []
        for page in 1...maxPages {
            let response: BusinessInvoiceListResponse = try await api.request(
                BusinessInvoicesEndpoints.receivedInvoices(page: page, pageSize: pageSize)
            )
            for invoice in response.invoices where seen.insert(invoice.id).inserted {
                all.append(invoice)
            }
            if response.invoices.count < pageSize || all.count >= (response.pagination?.total ?? 0) { break }
        }
        return all
    }

    private func rebuildState() {
        guard let invoices else { return }
        guard !invoices.isEmpty else {
            state = .empty(ListOfRowsState.EmptyContent(
                icon: .receiptText,
                headline: "No invoices yet",
                subcopy: "When a business you hire on Pantopus sends you an invoice, it shows up here so you can pay it."
            ))
            return
        }
        let today = Date()
        let unpaid = invoices.filter(Self.isUnpaid)
        // Overdue first, then the newest (the server's order); paid ones stay newest first.
        let toPay = unpaid.filter { Self.isOverdue($0, now: today) } + unpaid.filter { !Self.isOverdue($0, now: today) }
        let paid = invoices.filter { !Self.isUnpaid($0) }
        var sections: [RowSection] = []
        if !toPay.isEmpty {
            sections.append(RowSection(
                id: "toPay",
                header: "To pay",
                rows: toPay.map { row(for: $0, now: today) },
                count: toPay.count
            ))
        }
        if !paid.isEmpty {
            sections.append(RowSection(
                id: "paid",
                header: "Paid",
                rows: paid.map { row(for: $0, now: today) },
                count: paid.count
            ))
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    private func row(for invoice: BusinessInvoiceDTO, now: Date) -> RowModel {
        let projection = Self.project(invoice, now: now)
        let invoiceId = invoice.id
        let open = onOpenInvoice
        return RowModel(
            id: invoice.id,
            title: invoice.business?.displayName ?? "Business",
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: .typeIcon(.receiptText, background: Theme.Color.businessBg, foreground: Theme.Color.business),
            trailing: .amountWithChip(
                amount: InvoiceDetailViewModel.money(invoice.totalCents),
                chipText: projection.chipText,
                chipVariant: projection.chipVariant,
                chipIcon: projection.chipIcon
            ),
            onTap: { open(invoiceId) },
            // Not opened yet: the server turns `sent` into `viewed` when the invoice is read.
            highlight: invoice.status == "sent" ? .unread : nil
        )
    }

    // MARK: - Projection

    struct Projection: Equatable {
        let subtitle: String
        let chipText: String
        let chipVariant: StatusChipVariant
        let chipIcon: PantopusIcon
    }

    static func project(_ invoice: BusinessInvoiceDTO, now: Date) -> Projection {
        let due = InvoiceDetailViewModel.shortDate(invoice.dueDate, preservingDay: true)
        if !isUnpaid(invoice) {
            let paid = InvoiceDetailViewModel.shortDate(invoice.paidAt)
            return Projection(subtitle: paid.map { "Paid \($0)" } ?? "Paid", chipText: "Paid", chipVariant: .success, chipIcon: .check)
        }
        if isOverdue(invoice, now: now) {
            return Projection(
                subtitle: due.map { "Overdue · was due \($0)" } ?? "Overdue",
                chipText: "Overdue",
                chipVariant: .error,
                chipIcon: .alertCircle
            )
        }
        let subtitle = due.map { "Due \($0)" }
            ?? InvoiceDetailViewModel.shortDate(invoice.createdAt).map { "Sent \($0)" }
            ?? "Payment requested"
        return Projection(subtitle: subtitle, chipText: "Unpaid", chipVariant: .warning, chipIcon: .clock)
    }

    static func isUnpaid(_ invoice: BusinessInvoiceDTO) -> Bool {
        ["sent", "viewed", "overdue"].contains(invoice.status)
    }

    /// Past due once the due day has ended where the person is. A due date is a calendar day stored as midnight
    /// UTC, so its day is read in UTC.
    static func isOverdue(_ invoice: BusinessInvoiceDTO, now: Date) -> Bool {
        guard isUnpaid(invoice) else { return false }
        if invoice.status == "overdue" { return true }
        guard let raw = invoice.dueDate, let dueDay = calendarDay(raw) else { return false }
        return dueDay < dayString(now, timeZone: .current)
    }

    private static func calendarDay(_ raw: String) -> String? {
        if raw.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil { return raw }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = fractional.date(from: raw) ?? plain.date(from: raw) else { return nil }
        return dayString(date, timeZone: .gmt)
    }

    private static func dayString(_ date: Date, timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
