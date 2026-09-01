//
//  InvoicesListView.swift
//  Pantopus
//
//  G12 Invoices List (owner) — Stream I15. Day-grouped invoice rows + a totals
//  summary, with the Stripe-not-connected gate. Matches `invoiceslist-frames.jsx`
//  within the InvoiceDTO's available fields. Tokens only.
//

import SwiftUI

struct InvoicesListView: View {
    @State private var model: InvoicesListViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: InvoicesListViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            PkgTopBar(title: "Invoices", onBack: { dismiss() }, trailing: {
                PkgTopBarIconButton(icon: .search, accessibilityLabel: "Search", tint: Theme.Color.appText) {
                    model.search()
                }
            })
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.invoices.list")
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .comingSoon:
            PkgComingSoon(title: "Invoices")
        case .gate:
            PkgStripeGate(
                icon: .receipt,
                title: "Connect payments to invoice for services",
                message: "Pantopus uses Stripe to send and collect invoices."
            ) { model.connectPayments() }
        case let .error(message):
            PkgErrorState(message: message) { Task { await model.load() } }
        case .empty:
            EmptyState(
                icon: .receipt,
                headline: "No invoices yet",
                subcopy: "Invoices appear here once you take a booking or sell a package.",
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .padding(.top, Spacing.s10)
        case .loaded:
            loadedBody
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                summary
                filterChips
                ForEach(model.sections) { section in
                    Text(section.day.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s1)
                        .padding(.top, Spacing.s1)
                    PkgRowCard {
                        ForEach(Array(section.invoices.enumerated()), id: \.element.id) { index, invoice in
                            InvoiceRow(
                                initials: model.payerInitials(invoice),
                                reference: model.reference(invoice),
                                service: model.service(invoice),
                                amount: model.amount(invoice),
                                status: model.invoiceStatus(invoice),
                                ownerType: model.theme.title.lowercased()
                            ) { model.openInvoice(invoice) }
                            if index < section.invoices.count - 1 { Divider().background(Theme.Color.appBorder) }
                        }
                    }
                }
                Color.clear.frame(height: Spacing.s8)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .refreshable { await model.refresh() }
    }

    /// Horizontal status filter chips (`invoiceslist-frames.jsx` `FilterChips`)
    /// — business-violet on the selected chip, hairline-bordered surface
    /// otherwise. Selection is view-only until the DTO carries `status`.
    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(InvoicesListViewModel.InvoiceFilter.allCases) { filter in
                    let on = model.selectedFilter == filter
                    Button { model.selectFilter(filter) } label: {
                        Text(filter.rawValue)
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 30)
                            .background(on ? model.accent : Theme.Color.appSurface)
                            .overlay {
                                if !on {
                                    Capsule().stroke(Theme.Color.appBorder, lineWidth: 1)
                                }
                            }
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var summary: some View {
        PkgCard(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
            HStack(spacing: Spacing.s0) {
                // Design: "Outstanding" (amber when any overdue) / "Collected · month"
                // (`invoiceslist-frames.jsx` lines 25, 30). The DTO carries no `status`
                // or `paid_at`, so Outstanding = total of all invoices and Collected ·
                // month = invoice count — the two-column layout, label strings, and amber
                // treatment are correct; the values will sharpen once the DTO fields land.
                stat(label: "Outstanding", value: model.outstandingLabel, overdue: model.hasOverdue)
                Rectangle().fill(Theme.Color.appBorder).frame(width: 1, height: 40)
                stat(label: "Collected · month", value: model.collectedMonthLabel, overdue: false)
            }
        }
    }

    /// One summary column. `overdue` paints the label + value amber to match the
    /// design's `Summary overdue` treatment (driven by `model.hasOverdue`).
    private func stat(label: String, value: String, overdue: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(overdue ? Theme.Color.warning : Theme.Color.appTextSecondary)
            Text(value)
                .font(.system(size: 21, weight: .heavy))
                .tracking(-0.5)
                .monospacedDigit()
                .foregroundStyle(overdue ? Theme.Color.warning : Theme.Color.appText)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                // Two-column summary skeleton (design frame 4 `Card`).
                PkgCard(padding: EdgeInsets(top: 14, leading: 14, bottom: 14, trailing: 14)) {
                    HStack(spacing: Spacing.s3) {
                        summaryStatSkeleton
                        summaryStatSkeleton
                    }
                }
                PkgRowCard {
                    ForEach(0..<4, id: \.self) { i in
                        HStack(spacing: 11) {
                            Shimmer(width: 34, height: 34, cornerRadius: Radii.pill)
                            VStack(alignment: .leading, spacing: 6) { Shimmer(width: 120, height: 11)
                                Shimmer(width: 80, height: 8)
                            }
                            Spacer()
                            Shimmer(width: 50, height: 24, cornerRadius: Radii.pill)
                        }
                        .padding(.vertical, 13)
                        if i < 3 { Divider().background(Theme.Color.appBorder) }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
    }

    private var summaryStatSkeleton: some View {
        VStack(alignment: .leading, spacing: 6) {
            Shimmer(width: 60, height: 9)
            Shimmer(width: 50, height: 18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Row

private struct InvoiceRow: View {
    let initials: String
    /// Mono reference. Design's bold primary line is the payer name; the lean
    /// DTO has no payer display name, so the reference currently serves as the
    /// primary line (and the design's mono treatment is preserved on it). When
    /// the payer name lands it becomes the primary and the reference returns to
    /// the sub-line `INV-… · service` per design.
    let reference: String
    let service: String
    let amount: String
    /// Backend status string (paid/sent/overdue/void/refunded/draft).
    /// The DTO currently carries no `status` field so this is nil until
    /// the field lands — when present the `PkgChip` renders automatically.
    var status: String?
    let ownerType: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(SchedulingGradient.linear(for: ownerType))
                    Text(initials)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(reference)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(service)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                // Design trailing: amount + tone-coloured status pill
                // (`invoiceslist-frames.jsx` line 57-58). Pill renders when
                // the DTO `status` field is present; hidden otherwise.
                VStack(alignment: .trailing, spacing: 3) {
                    Text(amount)
                        .font(.system(size: 13.5, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                    if let status {
                        InvoiceStatusChip(status: status)
                    }
                }
            }
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Invoice \(reference), \(service), \(amount)")
    }
}
