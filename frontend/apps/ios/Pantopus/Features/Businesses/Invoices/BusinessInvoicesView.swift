//
//  BusinessInvoicesView.swift
//  Pantopus
//
//  A10.7 owner surface — "Invoices". Status-filter chips over a paged list
//  of invoice cards (recipient · dates · total · status pill · line items ·
//  platform fee), a "New invoice" sheet, and a destructive Void action
//  behind a confirm.
//
//  Mirrors RN `src/components/business/tabs/InvoicesTab.tsx` and Android
//  `BusinessInvoicesScreen.kt`.
//

import SwiftUI

/// Owner-only invoicing surface for a single business.
public struct BusinessInvoicesView: View {
    @State private var viewModel: BusinessInvoicesViewModel
    @State private var showsCreateSheet = false
    @State private var voidTarget: BusinessInvoiceRow?

    public init(businessId: String) {
        _viewModel = State(initialValue: BusinessInvoicesViewModel(businessId: businessId))
    }

    /// Preview / test seam.
    init(viewModel: BusinessInvoicesViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            filterRail
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appBg)
        .navigationTitle("Invoices")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showsCreateSheet = true } label: {
                    Icon(.plus, size: 18, strokeWidth: 2.4, color: Theme.Color.business)
                }
                .accessibilityLabel("New invoice")
                .accessibilityIdentifier("businessInvoices.new")
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("businessInvoices.screen")
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .sheet(isPresented: $showsCreateSheet) {
            CreateBusinessInvoiceSheet(viewModel: viewModel) { showsCreateSheet = false }
        }
        .confirmationDialog(
            "Void invoice?",
            isPresented: voidBinding,
            titleVisibility: .visible,
            presenting: voidTarget
        ) { row in
            Button("Void \(row.totalLabel) invoice", role: .destructive) {
                let id = row.id
                voidTarget = nil
                Task { await viewModel.voidInvoice(id: id) }
            }
            .accessibilityIdentifier("businessInvoices_voidConfirm")
            Button("Keep invoice", role: .cancel) { voidTarget = nil }
        } message: { row in
            Text("The \(row.totalLabel) invoice to \(row.recipientName) can't be collected once voided. This cannot be undone.")
        }
        .overlay(alignment: .bottom) { actionToast }
    }

    private var voidBinding: Binding<Bool> {
        Binding(
            get: { voidTarget != nil },
            set: { if !$0 { voidTarget = nil } }
        )
    }

    // MARK: - Filter chips

    private var filterRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(BusinessInvoiceFilter.allCases) { option in
                    Button { viewModel.filter = option } label: {
                        Text(option.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(
                                viewModel.filter == option
                                    ? Theme.Color.appTextInverse
                                    : Theme.Color.appTextSecondary
                            )
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, 6)
                            .background(
                                viewModel.filter == option
                                    ? Theme.Color.business
                                    : Theme.Color.appSurface
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(
                                    viewModel.filter == option ? Color.clear : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("businessInvoices.filter.\(option.rawValue)")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appBg)
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case let .loaded(rows):
            ScrollView {
                LazyVStack(spacing: Spacing.s3) {
                    ForEach(rows) { row in
                        invoiceCard(row)
                            .onAppear {
                                if row.id == rows.last?.id {
                                    Task { await viewModel.loadMoreIfNeeded() }
                                }
                            }
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s10)
            }
            .accessibilityIdentifier("businessInvoices.list")
        case .empty:
            EmptyState(
                icon: .receiptText,
                headline: viewModel.filter == .all
                    ? "No invoices yet"
                    : "No \(viewModel.filter.label.lowercased()) invoices",
                subcopy: "Create an invoice to bill a customer after service delivery.",
                cta: EmptyState.CTA(title: "New invoice") {
                    await MainActor.run { showsCreateSheet = true }
                },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .accessibilityIdentifier("businessInvoices.empty")
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load invoices",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .accessibilityIdentifier("businessInvoices.error")
        }
    }

    private var loadingSkeleton: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<4, id: \.self) { _ in
                Shimmer(height: 132, cornerRadius: Radii.lg)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("businessInvoices.loading")
    }

    // MARK: - Invoice card

    private func invoiceCard(_ row: BusinessInvoiceRow) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.recipientName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text([row.createdLabel, row.dueLabel].compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                VStack(alignment: .trailing, spacing: Spacing.s1) {
                    Text(row.totalLabel)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    statusPill(row.status, label: row.statusLabel)
                }
            }

            if let memo = row.memo {
                Text(memo)
                    .font(.system(size: 13))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)

            VStack(spacing: 2) {
                ForEach(row.lineItems) { item in
                    HStack {
                        Text(item.title)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Spacer(minLength: Spacing.s2)
                        Text(item.amountLabel)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                HStack {
                    Text("Platform fee")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Spacer(minLength: Spacing.s2)
                    Text(row.feeLabel)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .padding(.top, Spacing.s1)
            }

            if row.canVoid {
                Button { voidTarget = row } label: {
                    Text("Void invoice")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s1)
                .accessibilityIdentifier("businessInvoices.void.\(row.id)")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessInvoices.row.\(row.id)")
    }

    private func statusPill(_ status: String, label: String) -> some View {
        Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Self.statusForeground(status))
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(Self.statusBackground(status))
            .clipShape(Capsule())
    }

    static func statusForeground(_ status: String) -> Color {
        switch status {
        case "paid": Theme.Color.success
        case "void": Theme.Color.error
        case "overdue": Theme.Color.warning
        case "sent", "viewed": Theme.Color.info
        default: Theme.Color.appTextSecondary
        }
    }

    static func statusBackground(_ status: String) -> Color {
        switch status {
        case "paid": Theme.Color.successBg
        case "void": Theme.Color.errorBg
        case "overdue": Theme.Color.warningBg
        case "sent", "viewed": Theme.Color.infoBg
        default: Theme.Color.appBorderSubtle
        }
    }

    // MARK: - Action toast

    @ViewBuilder private var actionToast: some View {
        switch viewModel.action {
        case let .succeeded(message):
            toast(message, background: Theme.Color.success)
        case let .failed(message):
            toast(message, background: Theme.Color.error)
        case .idle, .working:
            EmptyView()
        }
    }

    private func toast(_ message: String, background: Color) -> some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(Spacing.s4)
            .accessibilityIdentifier("businessInvoices.actionToast")
            .onTapGesture { viewModel.clearAction() }
            .task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                viewModel.clearAction()
            }
    }
}

#Preview("Invoices") {
    NavigationStack {
        BusinessInvoicesView(
            viewModel: BusinessInvoicesViewModel(
                businessId: "biz",
                rows: [
                    BusinessInvoiceRow(
                        id: "1",
                        recipientName: "Jamal T.",
                        createdLabel: "Mar 4, 2026",
                        dueLabel: "Due Mar 18, 2026",
                        totalLabel: "$180.00",
                        feeLabel: "$9.00",
                        status: "sent",
                        memo: "Deep clean, 2 bedrooms",
                        lineItems: [
                            BusinessInvoiceRow.LineItem(id: 0, title: "Deep clean ×2", amountLabel: "$180.00")
                        ],
                        canVoid: true
                    )
                ]
            )
        )
    }
}
