//
//  InvoiceDetailViewModel.swift
//  Pantopus
//
//  A09.4 Invoice — the recipient's view of a business invoice, wired to the
//  real backend:
//    GET  /api/businesses/invoices/{id}          → the invoice we render
//    POST /api/businesses/invoices/{id}/pay      → PaymentIntent client secret
//    POST /api/businesses/invoices/{id}/confirm  → flip it to `paid`
//  Pay presents the same Stripe PaymentSheet the gig / listing checkouts use
//  (`CheckoutCoordinator`), then re-reads the invoice from the server — we
//  never mark it paid locally, and every figure on screen is the server's
//  own `*_cents` value, only formatted here.
//

import Foundation
import Observation

/// Where the "Pay" CTA currently sits, so the view can surface the right
/// result toast (success / declined / canceled) after PaymentSheet returns.
public enum InvoicePaymentStatus: Sendable, Equatable {
    case idle
    case paying
    case paid
    case canceled
    case declined(message: String)
}

@Observable
@MainActor
public final class InvoiceDetailViewModel {
    public private(set) var state: ContentDetailState = .loading
    /// Drives the post-checkout toast in the view (`checkout.*` surfaces).
    public private(set) var paymentStatus: InvoicePaymentStatus = .idle

    private let invoiceId: String
    private let api: APIClient
    private let checkout: CheckoutCoordinator
    /// The last invoice read from the server — the single source of truth for
    /// what is payable and for what amount.
    private var invoice: BusinessInvoiceDTO?

    /// Production initializer — shared API client + real PaymentSheet.
    /// `public` and parameter-free because `APIClient` is module-internal.
    public convenience init(invoiceId: String) {
        self.init(invoiceId: invoiceId, api: .shared)
    }

    /// Designated initializer. Internal (not `public`) because `APIClient` is
    /// an internal type — mirrors `MembersListViewModel`.
    init(
        invoiceId: String,
        api: APIClient = .shared,
        checkout: CheckoutCoordinator = CheckoutCoordinator()
    ) {
        self.invoiceId = invoiceId
        self.api = api
        self.checkout = checkout
    }

    public func load() async {
        await fetch(showLoading: true)
    }

    public func refresh() async {
        await fetch(showLoading: true)
    }

    /// Run the real pay → PaymentSheet → confirm sequence. The invoice is
    /// re-read from the server afterwards; the paid frame (A09.4) is whatever
    /// the backend says it is.
    public func payNow() async {
        guard let invoice, Self.isPayable(invoice.status) else {
            paymentStatus = .declined(message: Self.unpayableMessage(for: invoice?.status))
            return
        }
        paymentStatus = .paying
        let payment: PayInvoiceResponse
        do {
            payment = try await api.request(BusinessInvoicesEndpoints.payInvoice(id: invoiceId))
        } catch {
            paymentStatus = .declined(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't start this payment. Please try again."
            )
            return
        }
        let outcome = await checkout.present(payment.sheetParams)
        switch outcome {
        case .paid:
            // The charge succeeded — tell the server so the invoice flips to
            // `paid`. A failure here is not a payment failure (the Stripe
            // webhook also reconciles), so we still report success and let the
            // re-read decide what the screen shows.
            _ = try? await api.request(
                BusinessInvoicesEndpoints.confirmInvoicePayment(id: invoiceId),
                as: BusinessInvoiceResponse.self
            )
            paymentStatus = .paid
            await fetch(showLoading: false)
        case .canceled:
            paymentStatus = .canceled
        case let .declined(message), let .failed(message):
            paymentStatus = .declined(message: message)
        }
    }

    /// Clear a result toast once the view has shown it.
    public func clearPaymentStatus() {
        paymentStatus = .idle
    }

    /// Short summary handed to the paid dock's Share action (system share
    /// sheet). Mirrors the Android string exactly, and quotes the server's
    /// own total so the shared text can never disagree with the screen.
    public var shareSummary: String {
        let reference = Self.reference(for: invoiceId)
        guard let invoice else { return "Invoice \(reference) via Pantopus" }
        let total = Self.money(invoice.totalCents)
        return invoice.status == "paid"
            ? "Invoice \(reference) · Paid \(total) via Pantopus"
            : "Invoice \(reference) · \(total) due via Pantopus"
    }

    // MARK: - Backend

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let response: BusinessInvoiceResponse = try await api.request(
                BusinessInvoicesEndpoints.receivedInvoice(id: invoiceId)
            )
            invoice = response.invoice
            state = .loaded(Self.project(response.invoice))
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load this invoice."
            )
        }
    }

    /// Payable statuses, mirroring the backend guard at
    /// `backend/routes/businesses.js:4661`.
    static func isPayable(_ status: String) -> Bool {
        ["sent", "viewed", "overdue"].contains(status)
    }

    private static func unpayableMessage(for status: String?) -> String {
        switch status {
        case "paid": "This invoice has already been paid."
        case "void": "This invoice has been voided."
        case .none: "Couldn't load this invoice."
        default: "This invoice isn't payable yet."
        }
    }

    // MARK: - Projection

    /// Project the server's invoice onto the A09.4 frame. Every amount comes
    /// straight from the invoice's `*_cents` columns.
    static func project(_ invoice: BusinessInvoiceDTO) -> ContentDetailContent {
        let isPaid = invoice.status == "paid"
        let isVoid = invoice.status == "void"
        let total = money(invoice.totalCents)
        let businessName = invoice.business?.displayName ?? "Business"

        var modules: [ContentDetailModule] = [
            .fromTo(ContentDetailFromTo(
                from: ContentDetailParty(label: "From", name: businessName, sub: "Business", accent: .business),
                to: ContentDetailParty(label: "To", name: "You", sub: "Personal", accent: .personal)
            ))
        ]
        if isPaid {
            modules.append(.callout(ContentDetailCallout(
                identifier: "invoice-paid",
                style: .banner,
                tone: .success,
                icon: .checkCircle,
                iconTone: .successOutline,
                title: "Invoice paid",
                subtitle: paidSubtitle(invoice),
                subtitleMono: false
            )))
        } else if isVoid {
            modules.append(.callout(ContentDetailCallout(
                identifier: "invoice-void",
                style: .banner,
                tone: .neutral,
                icon: .xCircle,
                iconTone: .primary,
                title: "This invoice has been voided",
                subtitle: nil
            )))
        }
        modules.append(lineItemsModule(invoice, isPaid: isPaid))
        if let memo = invoice.memo?.trimmingCharacters(in: .whitespacesAndNewlines), !memo.isEmpty {
            modules.append(.description(ContentDetailDescription(
                title: "Note from sender",
                icon: nil,
                body: memo
            )))
        }

        return ContentDetailContent(
            kind: .invoice,
            statusPill: statusPill(invoice),
            hero: ContentDetailHero(
                title: heroTitle(invoice, businessName: businessName),
                monoId: monoId(invoice),
                priceLine: total,
                priceCaption: isPaid ? nil : "total · \(currencyCode(invoice))",
                priceTone: isPaid ? .success : .auto,
                priceTrailingLabel: isPaid ? "paid in full" : nil,
                priceCheckDisc: isPaid
            ),
            modules: modules,
            dock: dock(invoice, total: total, isPaid: isPaid, isVoid: isVoid)
        )
    }

    private static func heroTitle(_ invoice: BusinessInvoiceDTO, businessName: String) -> String {
        let named = invoice.lineItems
            .map { $0.description.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if named.count == 1, let only = named.first { return only }
        return "Invoice from \(businessName)"
    }

    private static func monoId(_ invoice: BusinessInvoiceDTO) -> String {
        var parts = [reference(for: invoice.id)]
        if let issued = shortDate(invoice.createdAt) { parts.append("issued \(issued)") }
        if invoice.status == "paid", let paid = shortDate(invoice.paidAt) {
            parts.append("paid \(paid)")
        } else if let due = shortDate(invoice.dueDate) {
            parts.append("due \(due)")
        }
        return parts.joined(separator: " · ")
    }

    private static func statusPill(_ invoice: BusinessInvoiceDTO) -> ContentDetailPill {
        switch invoice.status {
        case "paid":
            let suffix = shortDate(invoice.paidAt).map { " · \($0)" } ?? ""
            return ContentDetailPill(label: "Paid\(suffix)", icon: .checkCircle, tone: .success)
        case "void":
            return ContentDetailPill(label: "Voided", icon: .xCircle, tone: .error)
        case "overdue":
            let suffix = shortDate(invoice.dueDate).map { " · due \($0)" } ?? ""
            return ContentDetailPill(label: "Overdue\(suffix)", icon: .alertCircle, tone: .warning)
        case "viewed", "sent":
            if let due = shortDate(invoice.dueDate) {
                return ContentDetailPill(label: "Due \(due)", icon: .clock, tone: .info)
            }
            return ContentDetailPill(label: "Payment requested", icon: .clock, tone: .info)
        default:
            return ContentDetailPill(label: invoice.status.capitalized, icon: .clock, tone: .neutral)
        }
    }

    /// Line-item table. The server stores a unit `amount_cents` + `quantity`
    /// per row (no per-row total column), so the row total is the same
    /// multiplication RN does — the invoice's own subtotal / total are never
    /// recomputed here.
    private static func lineItemsModule(_ invoice: BusinessInvoiceDTO, isPaid: Bool) -> ContentDetailModule {
        let rows = invoice.lineItems.enumerated().map { index, item in
            ContentDetailLineItem(
                id: "line-\(index)",
                item: item.description,
                qty: "\(item.quantity)",
                unit: money(item.amountCents),
                total: money(item.amountCents * max(item.quantity, 1))
            )
        }
        // The platform fee is deducted from the business's payout, not added
        // to what the recipient owes (`businesses.js:4796`), so it is never
        // shown as a charge here. Subtotal only appears when it differs from
        // the total the server is billing.
        let fees: [ContentDetailSummaryRow] = invoice.subtotalCents != invoice.totalCents
            ? [ContentDetailSummaryRow(id: "subtotal", label: "Subtotal", value: money(invoice.subtotalCents))]
            : []
        return .lineItems(ContentDetailLineItems(
            title: "Line items",
            icon: .file,
            rows: rows,
            fees: fees,
            totalLabel: isPaid ? "Paid" : "Total",
            totalValue: money(invoice.totalCents),
            totalTone: isPaid ? .success : .primary
        ))
    }

    private static func dock(
        _ invoice: BusinessInvoiceDTO,
        total: String,
        isPaid: Bool,
        isVoid: Bool
    ) -> ContentDetailDock {
        if isPaid {
            return ContentDetailDock(
                secondary: ContentDetailDockButton(label: "Share", icon: .share),
                primary: ContentDetailDockButton(label: "Paid in full", icon: .checkCircle, enabled: false)
            )
        }
        if isVoid {
            return ContentDetailDock(
                primary: ContentDetailDockButton(label: "Invoice voided", icon: .xCircle, enabled: false)
            )
        }
        if isPayable(invoice.status) {
            return ContentDetailDock(
                primary: ContentDetailDockButton(label: "Pay \(total)", icon: .creditCard)
            )
        }
        return ContentDetailDock(
            primary: ContentDetailDockButton(label: "Not payable yet", icon: .clock, enabled: false)
        )
    }

    private static func paidSubtitle(_ invoice: BusinessInvoiceDTO) -> String? {
        shortDate(invoice.paidAt).map { "Paid on \($0)" }
    }

    // MARK: - Formatting

    /// Short, human reference for an invoice UUID — the first block, upper-cased.
    static func reference(for invoiceId: String) -> String {
        let head = invoiceId.split(separator: "-").first.map(String.init) ?? invoiceId
        return String(head.prefix(8)).uppercased()
    }

    static func currencyCode(_ invoice: BusinessInvoiceDTO) -> String {
        let raw = (invoice.currency ?? "usd").trimmingCharacters(in: .whitespacesAndNewlines)
        return raw.isEmpty ? "USD" : raw.uppercased()
    }

    private static let centsFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()

    /// Integer cents → `"$1,284.50"`. Formatting only — no rounding or
    /// re-derivation of the server's amount.
    static func money(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        let plain = centsFormatter.string(from: NSNumber(value: dollars)) ?? String(format: "%.2f", dollars)
        return "$\(plain)"
    }

    private static let iso8601Fraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    /// ISO-8601 timestamp → `"Dec 14"`; nil when the value is absent /
    /// unparseable (the caller then omits that clause entirely).
    static func shortDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        guard let date = iso8601Fraction.date(from: raw) ?? iso8601Plain.date(from: raw) else { return nil }
        return shortDateFormatter.string(from: date)
    }
}
