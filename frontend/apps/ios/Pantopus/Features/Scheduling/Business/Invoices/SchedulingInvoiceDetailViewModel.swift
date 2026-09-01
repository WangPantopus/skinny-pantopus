//
//  SchedulingInvoiceDetailViewModel.swift
//  Pantopus
//
//  G13 Invoice Detail (owner) — Stream I15. Renders `GET /invoices/:id` and the
//  owner "send" action (`POST /invoices/:id/send`). Behind
//  `SchedulingFeatureFlags.paidEnabled`. Matches `invoicedetail-frames.jsx`
//  within the InvoiceDTO's fields (see InvoicesKit note: no status / timeline /
//  due date / memo / payer name → those design sections are omitted).
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class SchedulingInvoiceDetailViewModel {
    enum Phase: Equatable { case loading, loaded, error(String), comingSoon }

    // MARK: Inputs

    let owner: SchedulingOwner
    let invoiceId: String
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var invoice: InvoiceDTO?
    private(set) var lineItems: [InvoiceLineItem] = []
    private(set) var sending = false
    private(set) var showSentToast = false
    /// Inline send failure — keeps the loaded invoice mounted (phase `.error`
    /// is reserved for load failures; blanking a loaded invoice on a failed
    /// send discarded the whole detail).
    private(set) var sendError: String?

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var totalLabel: String {
        SchedulingMoney.format(cents: invoice?.totalCents, currency: invoice?.currency)
    }

    var currencyCode: String {
        (invoice?.currency ?? "USD").uppercased()
    }

    var reference: String {
        "INV-" + invoiceId.prefix(6).uppercased()
    }

    var issuedLabel: String {
        PackagesFormat.dayString(invoice?.createdAt) ?? "—"
    }

    var recipientLabel: String {
        guard let recipient = invoice?.recipientUserId else { return "Customer" }
        return "Customer · " + recipient.prefix(6).uppercased()
    }

    /// Net-14 due date (`invoicedetail-frames.jsx` mono header `· due Jun 18`).
    /// The DTO carries no explicit `due_date`, but the Payment-terms section
    /// states "Net 14 from issue", so the due day is derived deterministically
    /// from `created_at + 14 days` — consistent with the stated terms rather
    /// than fabricated. Falls back to nil (segment dropped) when the issue
    /// timestamp can't be parsed.
    var dueLabel: String? {
        guard let iso = invoice?.createdAt, let issued = SchedulingTime.parseUTC(iso),
              let due = Calendar.current.date(byAdding: .day, value: 14, to: issued) else { return nil }
        return SchedulingTime.localString(
            date: due,
            tz: SchedulingTime.deviceTimeZoneIdentifier,
            dateStyle: .medium,
            timeStyle: .none
        )
    }

    /// Payment-timeline events (`invoicedetail-frames.jsx` `Timeline`). The DTO
    /// has no lifecycle field, so the rail is fed by the data that does exist:
    /// `Created` (always, from `created_at`) plus a `Sent to customer` dot once
    /// the in-session `send()` succeeds. The richer Paid/Deposit/Refunded/Voided
    /// events from the design need the absent `status`/`paid_at` and stay
    /// deferred — but the section chrome + real Created/Sent dots render now.
    var timelineEvents: [TimelineEvent] {
        var events: [TimelineEvent] = [
            TimelineEvent(label: "Created", time: issuedLabel, tone: .neutral)
        ]
        if didSend {
            events.append(TimelineEvent(label: "Sent to customer", time: sentLabel ?? "Just now", tone: .accent))
        }
        return events
    }

    struct TimelineEvent: Identifiable {
        enum Tone { case neutral, accent, success }
        let label: String
        let time: String
        let tone: Tone

        /// Deterministic identity: `timelineEvents` is computed fresh on every
        /// body evaluation, and a `UUID()` per construction made SwiftUI tear
        /// down and rebuild every rail row on unrelated state flips. Labels are
        /// unique within the rail ("Created", "Sent to customer").
        var id: String {
            label
        }
    }

    private(set) var didSend = false
    private var sentLabel: String?

    /// Mono header (`invoicedetail-frames.jsx`): `INV-… · issued <day> · due <day>`.
    /// The `· due` segment is appended only when a Net-14 due day is derivable.
    var headerLine: String {
        var line = "\(reference) · issued \(issuedLabel)"
        if let due = dueLabel { line += " · due \(due)" }
        return line
    }

    var shareText: String {
        "\(reference) · \(totalLabel)"
    }

    /// Best-available invoice status for the top-bar pill and dock CTA set.
    /// The DTO carries no `status` field; we derive the lifecycle state from
    /// the data that does exist:
    ///   • After a successful in-session `send()` → "sent"
    ///   • Otherwise → "draft" (the safest pre-send state)
    /// Wire directly to `invoice.status` once the DTO gap is resolved.
    var invoiceStatusString: String {
        didSend ? "sent" : "draft"
    }

    /// Dock CTA configuration per invoice status (`invoicedetail-frames.jsx`
    /// lines 196–202). Seven variants:
    ///   draft   → Send only
    ///   sent    → Mark paid + Resend + Overflow
    ///   paid    → Share + Download PDF
    ///   partial → Mark paid + Send balance
    ///   overdue → Mark paid + Resend + Overflow
    ///   void    → Share only
    ///   refunded→ Share + Download PDF
    /// Until the DTO exposes `status`, this is driven by `invoiceStatusString`
    /// (draft → Send; sent → Mark paid + Resend + Overflow).
    enum DockConfig {
        case sendOnly
        case markPaidResendOverflow
        case shareDownload
        case markPaidSendBalance
        case shareOnly
    }

    var dockConfig: DockConfig {
        switch invoiceStatusString {
        case "sent", "overdue": .markPaidResendOverflow
        case "paid", "refunded": .shareDownload
        case "partial": .markPaidSendBalance
        case "void": .shareOnly
        default: .sendOnly // draft (and any unknown)
        }
    }

    init(
        owner: SchedulingOwner,
        invoiceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.invoiceId = invoiceId
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
            let result: InvoiceResponse = try await client.request(SchedulingEndpoints.getInvoice(owner: owner, id: invoiceId))
            invoice = result.invoice
            lineItems = InvoiceParsing.lineItems(from: result.invoice.lineItems)
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load that invoice.")
        } catch {
            phase = .error("Couldn't load that invoice.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Actions

    /// Mark the invoice as paid (dock CTA for sent/overdue/partial states).
    /// Deferred — no backend endpoint exposed yet; placeholder keeps the dock
    /// CTA set structurally faithful to the design.
    func markPaid() {}

    /// Download a PDF receipt (dock CTA for paid/refunded states).
    /// Deferred — no PDF endpoint exposed yet; placeholder for design parity.
    func downloadPDF() {}

    /// Show the overflow menu (dock CTA for sent/overdue states — Void, etc.).
    /// Deferred — no actions sheet built yet; placeholder for design parity.
    func showOverflow() {}

    /// Send the invoice to its recipient (in-app notification; does not mutate
    /// invoice state server-side).
    func send() async {
        sending = true
        sendError = nil
        defer { sending = false }
        do {
            try await client.send(SchedulingEndpoints.sendInvoice(owner: owner, id: invoiceId))
            didSend = true
            sentLabel = SchedulingTime.localString(
                date: Date(),
                tz: SchedulingTime.deviceTimeZoneIdentifier,
                dateStyle: .medium,
                timeStyle: .none
            )
            flashSent()
        } catch let error as SchedulingError {
            sendError = error.userMessage ?? "Couldn't send the invoice."
        } catch {
            sendError = "Couldn't send the invoice."
        }
    }

    private func flashSent() {
        showSentToast = true
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            showSentToast = false
        }
    }

    // MARK: Line-item formatting

    func unitLabel(_ item: InvoiceLineItem) -> String {
        guard let unit = item.unitCents else { return "—" }
        return SchedulingMoney.format(cents: unit, currency: invoice?.currency)
    }

    func lineTotalLabel(_ item: InvoiceLineItem) -> String {
        guard let total = item.totalCents else { return "—" }
        return SchedulingMoney.format(cents: total, currency: invoice?.currency)
    }
}
