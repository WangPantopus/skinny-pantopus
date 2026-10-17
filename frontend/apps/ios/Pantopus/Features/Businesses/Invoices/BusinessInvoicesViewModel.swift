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
    /// The recipient, picked from the people this crew already knows.
    public private(set) var recipient: InvoiceRecipientDTO?
    public var recipientQuery: String = ""
    public private(set) var recipientOptions: [InvoiceRecipientDTO] = []
    public private(set) var isSearchingRecipients = false
    public private(set) var recipientSearchError: String?
    public var dueDate: String = ""
    public var memo: String = ""
    public var lineItems: [InvoiceLineItemDraft] = [InvoiceLineItemDraft()]
    public private(set) var isCreating = false
    public private(set) var createError: String?

    private let businessId: String
    private let api: APIClient
    private var page = 1
    /// A retry of the same draft (a lost reply, a second tap) keeps its request
    /// id, so the server answers with the invoice it already sent.
    private var pendingCreate: (draft: CreateBusinessInvoiceRequest, id: String)?
    private var rows: [BusinessInvoiceRow] = []
    private var isLoadingPage = false
    private var recipientSearchTask: Task<Void, Never>?
    private var recipientSearchSequence = 0
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

    // MARK: - Recipient

    /// Suggestions as the sheet opens, then matches as the owner types (250 ms).
    public func searchRecipients(immediately: Bool = false) {
        recipientSearchTask?.cancel()
        guard seededRows == nil, recipient == nil else { return }
        recipientSearchSequence += 1
        let sequence = recipientSearchSequence
        let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        recipientSearchError = nil
        isSearchingRecipients = true
        recipientSearchTask = Task { [weak self] in
            if !immediately {
                do {
                    try await Task.sleep(nanoseconds: 250_000_000)
                } catch {
                    return
                }
            }
            await self?.runRecipientSearch(query, sequence: sequence)
        }
    }

    public func selectRecipient(_ person: InvoiceRecipientDTO) {
        recipientSearchTask?.cancel()
        recipientSearchSequence += 1
        isSearchingRecipients = false
        recipient = person
        createError = nil
    }

    public func clearRecipient() {
        recipient = nil
        searchRecipients(immediately: true)
    }

    private func runRecipientSearch(_ query: String, sequence: Int) async {
        let people: [InvoiceRecipientDTO]
        do {
            people = try await api.request(
                BusinessFinanceEndpoints.invoiceRecipients(businessId: businessId, query: query),
                as: InvoiceRecipientsResponse.self
            ).people
        } catch {
            guard sequence == recipientSearchSequence else { return }
            recipientOptions = []
            isSearchingRecipients = false
            recipientSearchError = (error as? APIError)?.errorDescription ?? "Couldn't load recipients. Try again."
            return
        }
        // A newer search (or a pick) supersedes this one.
        guard sequence == recipientSearchSequence else { return }
        recipientOptions = people
        isSearchingRecipients = false
    }

    public func resetDraft() {
        recipientSearchTask?.cancel()
        recipientSearchSequence += 1
        recipientSearchError = nil
        isSearchingRecipients = false
        recipient = nil
        recipientQuery = ""
        recipientOptions = []
        dueDate = ""
        memo = ""
        lineItems = [InvoiceLineItemDraft()]
        createError = nil
    }

    /// Validate + `POST …/invoices`. Returns true when the invoice was sent
    /// (the sheet dismisses on true). Copy mirrors RN's alerts.
    @discardableResult
    public func createInvoice() async -> Bool {
        guard seededRows == nil, !isCreating else { return false }
        createError = nil
        guard let recipientId = recipient?.id else {
            createError = "Choose who to invoice"
            return false
        }
        var parsed: [CreateBusinessInvoiceLineItem] = []
        for (index, item) in lineItems.enumerated() {
            let description = item.description.trimmingCharacters(in: .whitespacesAndNewlines)
            let amount = item.amount.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !description.isEmpty, !amount.isEmpty else {
                createError = "Complete the description and amount for line \(index + 1), or remove it."
                return false
            }
            guard let cents = Self.cents(fromDollars: amount), cents > 0 else {
                createError = "Enter a positive amount with at most two decimal places, up to $999,999.99."
                return false
            }
            guard let quantity = Int(item.quantity.trimmingCharacters(in: .whitespacesAndNewlines)),
                  (1...10000).contains(quantity)
            else {
                createError = "Quantity for line \(index + 1) must be a whole number from 1 to 10,000."
                return false
            }
            parsed.append(
                CreateBusinessInvoiceLineItem(
                    description: description,
                    amountCents: cents,
                    quantity: quantity
                )
            )
        }
        guard !parsed.isEmpty else {
            createError = "At least one line item is required"
            return false
        }
        guard parsed.reduce(0, { $0 + $1.amountCents * $1.quantity }) <= 99_999_999 else {
            createError = "The invoice total cannot exceed $999,999.99."
            return false
        }

        isCreating = true
        defer { isCreating = false }
        let due = dueDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let note = memo.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = CreateBusinessInvoiceRequest(
            recipientUserId: recipientId,
            lineItems: parsed,
            dueDate: due.isEmpty ? nil : due,
            memo: note.isEmpty ? nil : note
        )
        if pendingCreate?.draft != draft { pendingCreate = (draft, UUID().uuidString) }
        do {
            _ = try await api.request(
                BusinessFinanceEndpoints.createInvoice(
                    businessId: businessId,
                    body: CreateBusinessInvoiceRequest(
                        recipientUserId: draft.recipientUserId,
                        lineItems: draft.lineItems,
                        dueDate: draft.dueDate,
                        memo: draft.memo,
                        clientRequestId: pendingCreate?.id
                    )
                ),
                as: BusinessInvoiceResponse.self
            )
            pendingCreate = nil
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
}

public extension BusinessInvoicesViewModel {
    /// "125.50" → 12550. Rejects anything that isn't a positive decimal.
    static func cents(fromDollars text: String) -> Int? {
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("$") { cleaned.removeFirst() }
        let pattern = #"^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?$"#
        guard cleaned.range(of: pattern, options: .regularExpression) != nil else { return nil }
        let parts = cleaned.replacingOccurrences(of: ",", with: "").split(separator: ".")
        guard let first = parts.first, let dollars = Int(first), dollars <= 999_999 else { return nil }
        let fraction = parts.count == 2 ? String(parts[1]) : ""
        let cents = dollars * 100 + (Int(fraction.padding(toLength: 2, withPad: "0", startingAt: 0)) ?? 0)
        return cents > 0 ? cents : nil
    }

    /// `1250` → `"$12.50"`. Two decimals, matching RN's `formatCents`.
    static func money(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }

    internal static let voidableStatuses: Set<String> = ["sent", "viewed", "overdue"]

    static func row(from dto: BusinessInvoiceDTO) -> BusinessInvoiceRow {
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
            dueLabel: shortDate(dto.dueDate, preservingDay: true).map { "Due \($0)" },
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
    internal static func shortDate(_ raw: String?, preservingDay: Bool = false) -> String? {
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
        return date.formatted(Date.FormatStyle(
            date: .abbreviated, time: .omitted, timeZone: preservingDay ? .gmt : .current
        ))
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
