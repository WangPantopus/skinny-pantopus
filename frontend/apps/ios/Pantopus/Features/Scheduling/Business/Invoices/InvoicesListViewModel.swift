//
//  InvoicesListViewModel.swift
//  Pantopus
//
//  G12 Invoices List (owner, business-only) — Stream I15. Lists `GET /invoices`
//  grouped by created day, with the Stripe-not-connected gate from
//  `GET /payments/status`. Behind `SchedulingFeatureFlags.paidEnabled`. Matches
//  `invoiceslist-frames.jsx` (within the limits of the minimal InvoiceDTO — see
//  InvoicesKit note: no status pills / status filters / status summary).
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class InvoicesListViewModel {
    enum Phase: Equatable { case loading, loaded, empty, gate, error(String), comingSoon }

    /// Status filter chips (`invoiceslist-frames.jsx` `FilterChips`). The DTO
    /// carries no `status`, so selecting a status chip cannot yet filter the
    /// list (deferred); `.all` is the only chip with data behind it. The chip
    /// row + selection are rendered now so the structure matches the design.
    enum InvoiceFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case paid = "Paid"
        case sent = "Sent"
        case overdue = "Overdue"
        case refunded = "Refunded"

        var id: String {
            rawValue
        }
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var invoices: [InvoiceDTO] = []
    private(set) var sections: [InvoiceDaySection] = []
    private(set) var paymentsConnected = false
    private(set) var paymentsApplicable = true

    /// Active status filter chip. View-only until the DTO carries `status`.
    var selectedFilter: InvoiceFilter = .all

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    // The two-stat summary structure (`invoiceslist-frames.jsx` `Summary`).
    // Design KPIs: "Outstanding" (amber when any invoice is overdue) /
    // "Collected · month" (driven by per-invoice `status` + `paid_at`).
    // The lean DTO omits those fields, so we surface DTO-derivable totals in
    // the same two-column / label layout — values sharpen once the fields land.

    /// Left KPI: Outstanding total (design `invoiceslist-frames.jsx` line 25).
    /// Until `status` lands, this shows the running sum of all invoices — the
    /// closest approximation we can derive from the DTO.
    var outstandingLabel: String {
        SchedulingMoney.format(cents: invoices.reduce(0) { $0 + ($1.totalCents ?? 0) }, currency: invoices.first?.currency)
    }

    /// Right KPI: Collected this month (design `invoiceslist-frames.jsx` line 30).
    /// Until `paid_at` lands, we show the invoice count with a "this month"
    /// fallback label that matches the designed slot without fabricating revenue.
    var collectedMonthLabel: String {
        "\(invoices.count)"
    }

    /// Drives the summary's amber treatment (design `Summary overdue`). No
    /// `status` in the DTO yet → always false; wire to per-invoice status once
    /// the field lands.
    var hasOverdue: Bool {
        false
    }

    /// Backend status string for a single invoice. Returns nil until the DTO
    /// exposes a `status` field — the row pill renders only when non-nil.
    func invoiceStatus(_: InvoiceDTO) -> String? {
        // InvoiceDTO currently has no `status` field. Return nil so the pill
        // is hidden rather than fabricating a status. Wire to `invoice.status`
        // once the Foundation DTO gap (InvoicesKit.swift note) is resolved.
        nil
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        guard SchedulingFeatureFlags.paidEnabled else { phase = .comingSoon
            return
        }
        phase = .loading
        do {
            if let status: PaymentsStatusDTO = try? await client.request(SchedulingEndpoints.paymentsStatus(owner: owner)) {
                paymentsConnected = status.connected
                paymentsApplicable = status.applicable
            }
            let result: InvoicesResponse = try await client.request(SchedulingEndpoints.getInvoices(owner: owner))
            invoices = result.invoices
            sections = InvoiceGrouping.byDay(invoices)
            if !invoices.isEmpty {
                phase = .loaded
            } else if paymentsApplicable, !paymentsConnected {
                phase = .gate
            } else {
                phase = .empty
            }
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load invoices.")
        } catch {
            phase = .error("Couldn't load invoices.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Actions

    func openInvoice(_ invoice: InvoiceDTO) {
        push(.invoiceDetail(owner: owner, invoiceId: invoice.id))
    }

    func connectPayments() {
        push(.paymentsSetup(owner: owner))
    }

    func selectFilter(_ filter: InvoiceFilter) {
        selectedFilter = filter
    }

    /// Top-bar search affordance (`invoiceslist-frames.jsx` `SearchBtn`). The
    /// design draws the glyph but wires no destination, and there is no invoice
    /// search route/endpoint yet — so this is a no-op placeholder (deferred)
    /// keeping the chrome structurally faithful.
    func search() {}

    // MARK: Row formatting

    func amount(_ invoice: InvoiceDTO) -> String {
        SchedulingMoney.format(cents: invoice.totalCents, currency: invoice.currency)
    }

    /// Short monospace reference from the invoice id (no invoice_number in DTO).
    func reference(_ invoice: InvoiceDTO) -> String {
        "INV-" + invoice.id.prefix(6).uppercased()
    }

    /// Service sub-label (`INV-… · {service}`) — derived from the first parsed
    /// line item. Falls back to "Service" when `line_items` carries no label.
    func service(_ invoice: InvoiceDTO) -> String {
        InvoiceParsing.lineItems(from: invoice.lineItems).first?.label ?? "Service"
    }

    /// Two-letter initials for the payer avatar disc. The DTO has no payer
    /// display name (only `recipient_user_id`), so we derive a stable two-char
    /// token from the invoice reference until the name lands (deferred).
    func payerInitials(_ invoice: InvoiceDTO) -> String {
        let token = (invoice.recipientUserId ?? invoice.id)
            .filter(\.isLetter)
            .prefix(2)
            .uppercased()
        return token.isEmpty ? "IN" : token
    }
}
