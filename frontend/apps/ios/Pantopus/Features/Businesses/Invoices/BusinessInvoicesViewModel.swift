//
//  BusinessInvoicesViewModel.swift
//  Pantopus
//
//  A10.7 owner surface — "Invoices". Paged list of the invoices this
//  business has billed, plus create and void. The server owns every money
//  field (`subtotal_cents` / `fee_cents` / `total_cents`); the client only
//  submits unit price × quantity and formats what comes back.
//
//  Mirrors RN `src/components/business/tabs/InvoicesTab.tsx`.
//

import Foundation

/// Status filter chips, mirroring RN's `FILTER_OPTIONS`.
public enum BusinessInvoiceFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case all
    case sent
    case viewed
    case paid
    case overdue
    case void

    public var id: String {
        rawValue
    }

    /// Value sent as `?status=`; `nil` for "All".
    public var queryValue: String? {
        self == .all ? nil : rawValue
    }

    public var label: String {
        switch self {
        case .all: "All"
        case .sent: "Sent"
        case .viewed: "Viewed"
        case .paid: "Paid"
        case .overdue: "Overdue"
        case .void: "Void"
        }
    }
}

/// One projected invoice row.
public struct BusinessInvoiceRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let recipientName: String
    public let createdLabel: String
    public let dueLabel: String?
    public let totalLabel: String
    public let feeLabel: String
    /// Raw backend status, lower-cased (`sent`, `paid`, `void`, …).
    public let status: String
    public let memo: String?
    public let lineItems: [LineItem]
    /// RN only offers Void on `sent / viewed / overdue`.
    public let canVoid: Bool

    public struct LineItem: Sendable, Hashable, Identifiable {
        public let id: Int
        public let title: String
        public let amountLabel: String

        public init(id: Int, title: String, amountLabel: String) {
            self.id = id
            self.title = title
            self.amountLabel = amountLabel
        }
    }

    public init(
        id: String,
        recipientName: String,
        createdLabel: String,
        dueLabel: String?,
        totalLabel: String,
        feeLabel: String,
        status: String,
        memo: String?,
        lineItems: [LineItem],
        canVoid: Bool
    ) {
        self.id = id
        self.recipientName = recipientName
        self.createdLabel = createdLabel
        self.dueLabel = dueLabel
        self.totalLabel = totalLabel
        self.feeLabel = feeLabel
        self.status = status
        self.memo = memo
        self.lineItems = lineItems
        self.canVoid = canVoid
    }

    public var statusLabel: String {
        status.uppercased()
    }
}

/// Render state for the Invoices screen.
public enum BusinessInvoicesState: Sendable, Equatable {
    case loading
    case loaded([BusinessInvoiceRow])
    case empty
    case error(message: String)
}

/// Post-action banner.
public enum BusinessInvoicesAction: Sendable, Equatable {
    case idle
    case working
    case succeeded(message: String)
    case failed(message: String)
}

/// One editable line item in the create sheet (strings, because the fields
/// are free text until submit).
public struct InvoiceLineItemDraft: Sendable, Hashable, Identifiable {
    public var id = UUID()
    public var description: String = ""
    /// Dollars as typed, e.g. "125.50".
    public var amount: String = ""
    public var quantity: String = "1"

    public init(description: String = "", amount: String = "", quantity: String = "1") {
        self.description = description
        self.amount = amount
        self.quantity = quantity
    }
}

@Observable
@MainActor
public final class BusinessInvoicesViewModel {
    public private(set) var state: BusinessInvoicesState = .loading
    public private(set) var action: BusinessInvoicesAction = .idle
    /// Whether another page is available (drives infinite scroll).
    public private(set) var hasMore = false

    public var filter: BusinessInvoiceFilter = .all {
        didSet {
            guard oldValue != filter else { return }
            Task { await load() }
        }
    }

    // Create-invoice draft (owned here so the sheet stays a dumb view).
    public var recipientUserId: String = ""
    public var dueDate: String = ""
    public var memo: String = ""
    public var lineItems: [InvoiceLineItemDraft] = [InvoiceLineItemDraft()]
    public private(set) var isCreating = false
    public private(set) var createError: String?

    private let businessId: String
    private let api: APIClient
    private var page = 1
    private var rows: [BusinessInvoiceRow] = []
    private var isLoadingPage = false
    private let seededRows: [BusinessInvoiceRow]?

    private static let pageSize = 20

    /// Production initialiser — `APIClient` is module-internal, so the
    /// public entry point must not name it.
    public convenience init(businessId: String) {
        self.init(businessId: businessId, api: .shared)
    }

    init(businessId: String, api: APIClient, seededRows: [BusinessInvoiceRow]? = nil) {
        self.businessId = businessId
        self.api = api
        self.seededRows = seededRows
        if let seededRows {
            state = seededRows.isEmpty ? .empty : .loaded(seededRows)
        }
    }

    /// Preview seam.
    public init(businessId: String, rows: [BusinessInvoiceRow]) {
        self.businessId = businessId
        api = .shared
        seededRows = rows
        state = rows.isEmpty ? .empty : .loaded(rows)
    }

    public func load() async {
        guard seededRows == nil else { return }
        page = 1
        rows = []
        hasMore = false
        state = .loading
        await fetchPage()
    }

    public func refresh() async {
        guard seededRows == nil else { return }
        page = 1
        rows = []
        hasMore = false
        await fetchPage()
    }

    /// Called from the list's last row.
    public func loadMoreIfNeeded() async {
        guard seededRows == nil, hasMore, !isLoadingPage else { return }
        page += 1
        await fetchPage()
    }

    private func fetchPage() async {
        isLoadingPage = true
        defer { isLoadingPage = false }
        do {
            let response: BusinessInvoiceListResponse = try await api.request(
                BusinessFinanceEndpoints.invoices(
                    businessId: businessId,
                    page: page,
                    pageSize: Self.pageSize,
                    status: filter.queryValue
                )
            )
            let mapped = response.invoices.map(Self.row(from:))
            rows.append(contentsOf: mapped)
            let total = response.pagination?.total ?? rows.count
            hasMore = rows.count < total && !mapped.isEmpty
            state = rows.isEmpty ? .empty : .loaded(rows)
        } catch {
            // A failed *subsequent* page shouldn't wipe what's on screen.
            if rows.isEmpty {
                state = .error(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load invoices."
                )
            } else {
                page = max(1, page - 1)
                action = .failed(message: "Couldn't load more invoices.")
            }
        }
    }

    // MARK: - Void

    /// `PATCH …/invoices/:id { status: 'void' }`. The confirm lives in the
    /// view (RN: "Void Invoice · Are you sure? This cannot be undone.").
    public func voidInvoice(id: String) async {
        guard seededRows == nil else { return }
        action = .working
        do {
            _ = try await api.request(
                BusinessFinanceEndpoints.voidInvoice(businessId: businessId, invoiceId: id),
                as: BusinessInvoiceResponse.self
            )
            action = .succeeded(message: "Invoice voided.")
            await refresh()
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't void the invoice."
            )
        }
    }

    // MARK: - Create

    public func addLineItem() {
        lineItems.append(InvoiceLineItemDraft())
    }

    public func removeLineItem(id: UUID) {
        guard lineItems.count > 1 else { return }
        lineItems.removeAll { $0.id == id }
    }

    public func resetDraft() {
        recipientUserId = ""
        dueDate = ""
        memo = ""
        lineItems = [InvoiceLineItemDraft()]
        createError = nil
    }

    /// Validate + `POST …/invoices`. Returns true when the invoice was sent
    /// (the sheet dismisses on true). Copy mirrors RN's alerts.
    @discardableResult
    public func createInvoice() async -> Bool {
        guard seededRows == nil else { return false }
        createError = nil
        let recipient = recipientUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !recipient.isEmpty else {
            createError = "Recipient user ID is required"
            return false
        }
        var parsed: [CreateBusinessInvoiceLineItem] = []
        for item in lineItems {
            let description = item.description.trimmingCharacters(in: .whitespacesAndNewlines)
            let amount = item.amount.trimmingCharacters(in: .whitespacesAndNewlines)
            if description.isEmpty || amount.isEmpty { continue }
            guard let cents = Self.cents(fromDollars: amount), cents > 0 else {
                createError = "Invalid amount: \(item.amount)"
                return false
            }
            parsed.append(
                CreateBusinessInvoiceLineItem(
                    description: description,
                    amountCents: cents,
                    quantity: max(1, Int(item.quantity.trimmingCharacters(in: .whitespaces)) ?? 1)
                )
            )
        }
        guard !parsed.isEmpty else {
            createError = "At least one line item is required"
            return false
        }

        isCreating = true
        defer { isCreating = false }
        let due = dueDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let note = memo.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            _ = try await api.request(
                BusinessFinanceEndpoints.createInvoice(
                    businessId: businessId,
                    body: CreateBusinessInvoiceRequest(
                        recipientUserId: recipient,
                        lineItems: parsed,
                        dueDate: due.isEmpty ? nil : due,
                        memo: note.isEmpty ? nil : note
                    )
                ),
                as: BusinessInvoiceResponse.self
            )
            resetDraft()
            action = .succeeded(message: "Invoice sent.")
            await refresh()
            return true
        } catch {
            createError = (error as? APIError)?.errorDescription ?? "Failed to create invoice"
            return false
        }
    }

    public func clearAction() {
        action = .idle
    }

    // MARK: - Mapping (pure — unit-test surface)

    /// "125.50" → 12550. Rejects anything that isn't a positive decimal.
    public static func cents(fromDollars text: String) -> Int? {
        let cleaned = text.replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard let value = Double(cleaned), value.isFinite, value > 0 else { return nil }
        return Int((value * 100).rounded())
    }

    /// `1250` → `"$12.50"`. Two decimals, matching RN's `formatCents`.
    public static func money(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }

    static let voidableStatuses: Set<String> = ["sent", "viewed", "overdue"]

    public static func row(from dto: BusinessInvoiceDTO) -> BusinessInvoiceRow {
        let status = dto.status.lowercased()
        let items = dto.lineItems.enumerated().map { index, item in
            BusinessInvoiceRow.LineItem(
                id: index,
                title: item.quantity > 1 ? "\(item.description) ×\(item.quantity)" : item.description,
                amountLabel: money(item.amountCents * max(1, item.quantity))
            )
        }
        return BusinessInvoiceRow(
            id: dto.id,
            recipientName: dto.recipient?.displayName(fallback: "Unknown") ?? "Unknown",
            createdLabel: shortDate(dto.createdAt) ?? "—",
            dueLabel: shortDate(dto.dueDate).map { "Due \($0)" },
            totalLabel: money(dto.totalCents),
            feeLabel: money(dto.feeCents),
            status: status,
            memo: dto.memo?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            lineItems: items,
            canVoid: voidableStatuses.contains(status)
        )
    }

    /// ISO-8601 (with or without fractional seconds) or `YYYY-MM-DD` →
    /// a locale-short date.
    static func shortDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: raw)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: raw)
        }
        if date == nil {
            let plain = DateFormatter()
            plain.dateFormat = "yyyy-MM-dd"
            plain.timeZone = TimeZone(identifier: "UTC")
            date = plain.date(from: String(raw.prefix(10)))
        }
        guard let date else { return nil }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
