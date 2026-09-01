//
//  BillDetailView.swift
//  Pantopus
//
//  Read-mostly Bill detail. Built on the shared `ContentDetailShell`
//  (T2.6 archetype). Fetches the parent bills list to find the matching
//  row by id, then renders payee + amount header, status / due / paid
//  meta rows, and the splits (read-only — backend has no POST for
//  splits today, see parity audit).
//
//  Actions: "Mark paid" + "Remove" — both go via
//  `PUT /api/homes/:id/bills/:billId`. Remove is a soft delete with
//  `status: "cancelled"` because there's no DELETE handler.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class BillDetailViewModel {
    enum State: Equatable {
        case loading
        case loaded(BillDTO, [BillSplitDTO])
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isSaving: Bool = false
    private(set) var saveError: String?

    private let homeId: String
    private let billId: String
    private let api: APIClient
    private let onChanged: @Sendable () -> Void
    private let onClose: @Sendable () -> Void

    init(
        homeId: String,
        billId: String,
        api: APIClient = .shared,
        onChanged: @escaping @Sendable () -> Void = {},
        onClose: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.billId = billId
        self.api = api
        self.onChanged = onChanged
        self.onClose = onClose
    }

    func load() async {
        state = .loading
        do {
            // Fetch the parent list + the splits in parallel. Backend
            // doesn't expose a GET-by-id for bills today; the list is
            // small (typical < ~100 rows) so re-fetching is cheap.
            async let billsTask: GetHomeBillsResponse =
                api.request(HomesEndpoints.bills(homeId: homeId))
            async let splitsTask: GetBillSplitsResponse =
                api.request(HomesEndpoints.billSplits(homeId: homeId, billId: billId))

            let bills = try await billsTask.bills
            let splits = await (try? splitsTask.splits) ?? []
            guard let bill = bills.first(where: { $0.id == billId }) else {
                state = .error(message: "This bill is no longer available.")
                return
            }
            state = .loaded(bill, splits)
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this bill."
            )
        }
    }

    func markPaid() async {
        await update(request: UpdateBillRequest(
            status: "paid",
            paidAt: ISO8601DateFormatter().string(from: Date())
        ))
    }

    /// Soft-delete — backend has no DELETE handler for bills.
    func remove() async {
        await update(request: UpdateBillRequest(status: "cancelled"))
        if case .loaded = state {
            onClose()
        }
    }

    private func update(request: UpdateBillRequest) async {
        guard !isSaving else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let response: HomeBillResponse = try await api.request(
                HomesEndpoints.updateBill(homeId: homeId, billId: billId, request: request)
            )
            onChanged()
            if case let .loaded(_, splits) = state {
                state = .loaded(response.bill, splits)
            }
        } catch {
            saveError = (error as? APIError)?.errorDescription
                ?? "Couldn't update this bill."
        }
    }
}

struct BillDetailView: View {
    @State private var viewModel: BillDetailViewModel
    private let onBack: @Sendable () -> Void
    private let onEdit: @Sendable () -> Void

    init(
        homeId: String,
        billId: String,
        onBack: @escaping @Sendable () -> Void,
        onEdit: @escaping @Sendable () -> Void = {},
        onChanged: @escaping @Sendable () -> Void = {}
    ) {
        _viewModel = State(initialValue: BillDetailViewModel(
            homeId: homeId,
            billId: billId,
            onChanged: onChanged
        ) {
            Task { @MainActor in onBack() }
        })
        self.onBack = onBack
        self.onEdit = onEdit
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                LoadingShell(onBack: onBack)
            case let .loaded(bill, splits):
                LoadedShell(
                    bill: bill,
                    splits: splits,
                    saving: viewModel.isSaving,
                    saveError: viewModel.saveError,
                    onBack: onBack,
                    onEdit: { onEdit() },
                    onMarkPaid: markPaid,
                    onRemove: removeBill
                )
            case let .error(message):
                ErrorShell(
                    message: message,
                    onBack: onBack
                ) {
                    Task { await viewModel.load() }
                }
            }
        }
        .accessibilityIdentifier("billDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onAppear { Analytics.track(.screenBillDetailViewed) }
        .task { await viewModel.load() }
    }

    private func markPaid() {
        Task { await viewModel.markPaid() }
    }

    private func removeBill() {
        Task { await viewModel.remove() }
    }
}

// MARK: - Shells

private struct LoadingShell: View {
    let onBack: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Bill",
            onBack: onBack,
            header: {
                Shimmer(height: 100, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(spacing: Spacing.s3) {
                    Shimmer(height: 60, cornerRadius: Radii.md)
                    Shimmer(height: 60, cornerRadius: Radii.md)
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

private struct ErrorShell: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void
    var body: some View {
        ContentDetailShell(
            title: "Bill",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load this bill",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { onRetry() }
                )
                .frame(height: 400)
            }
        )
    }
}

private struct LoadedShell: View {
    let bill: BillDTO
    let splits: [BillSplitDTO]
    let saving: Bool
    let saveError: String?
    let onBack: () -> Void
    let onEdit: () -> Void
    let onMarkPaid: () -> Void
    let onRemove: () -> Void

    var body: some View {
        let projection = BillsListViewModel.project(bill: bill, now: Date())
        let isPaid = bill.status == "paid"
        let autoPay = projection.status == .scheduled
        return ContentDetailShell(
            title: "Bill",
            onBack: onBack,
            header: {
                BillHeader(
                    payee: projection.payee,
                    amount: projection.amount,
                    chipText: projection.chipText,
                    chipVariant: projection.chipVariant,
                    chipIcon: projection.chipIcon,
                    category: projection.category,
                    autoPay: autoPay
                )
                .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    DetailGrid(bill: bill)
                    if !splits.isEmpty {
                        SplitsSection(splits: splits, totalAmount: bill.displayAmount)
                    }
                    if let saveError {
                        Text(saveError)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                    }
                    Button(action: onEdit) {
                        HStack(spacing: Spacing.s2) {
                            Icon(.pencil, size: 16, color: Theme.Color.primary600)
                            Text("Edit bill")
                                .pantopusTextStyle(.small)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.primary600)
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                    .accessibilityIdentifier("billDetail_edit")
                    Button(role: .destructive, action: onRemove) {
                        HStack(spacing: Spacing.s2) {
                            Icon(.trash2, size: 16, color: Theme.Color.error)
                            Text("Remove bill")
                                .pantopusTextStyle(.small)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.error)
                        }
                    }
                    .accessibilityIdentifier("billDetail_remove")
                    .disabled(saving)
                }
                .padding(.horizontal, Spacing.s4)
            },
            cta: {
                PrimaryButton(
                    title: isPaid ? "Already paid" : "Mark paid",
                    isLoading: saving,
                    isEnabled: !isPaid && !saving
                ) {
                    await MainActor.run { onMarkPaid() }
                }
                .accessibilityIdentifier("billDetail_markPaid")
            }
        )
    }
}

private struct BillHeader: View {
    let payee: String
    let amount: String
    let chipText: String
    let chipVariant: StatusChipVariant
    let chipIcon: PantopusIcon?
    let category: UtilityCategory
    let autoPay: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(category.background)
                        .frame(width: 48, height: 48)
                    Icon(category.icon, size: 24, color: category.foreground)
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HStack(spacing: Spacing.s2) {
                        Text(payee)
                            .pantopusTextStyle(.h3)
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(2)
                        if autoPay {
                            HStack(spacing: 3) {
                                Icon(.arrowsRepeat, size: 11, color: Theme.Color.info)
                                Text("Auto-pay")
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.info)
                            }
                            .padding(.horizontal, Spacing.s2)
                            .padding(.vertical, 3)
                            .background(Theme.Color.infoBg)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                        }
                    }
                    Text(amount)
                        .pantopusTextStyle(.body)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.appText)
                }
                Spacer(minLength: Spacing.s0)
            }
            StatusChip(chipText, variant: chipVariant, icon: chipIcon)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }
}

private struct DetailGrid: View {
    let bill: BillDTO

    var body: some View {
        let category = UtilityCategory.from(payee: bill.providerName)
        return VStack(spacing: Spacing.s0) {
            row(label: "Category", value: category.label)
            divider
            row(label: "Status", value: bill.status.capitalized)
            if bill.status == "scheduled" {
                divider
                row(label: "Auto-pay", value: "Scheduled")
            }
            if let due = BillsListViewModel.formatDateShort(iso: bill.dueDate) {
                divider
                row(label: "Due", value: due)
            }
            if let paid = BillsListViewModel.formatDateShort(iso: bill.paidAt) {
                divider
                row(label: "Paid on", value: paid)
            }
            if let currency = bill.currency, currency != "USD" {
                divider
                row(label: "Currency", value: currency)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

private struct SplitsSection: View {
    let splits: [BillSplitDTO]
    let totalAmount: Decimal

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.users, size: 16, color: Theme.Color.primary600)
                Text("Split between")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
            }
            VStack(spacing: Spacing.s0) {
                ForEach(Array(splits.enumerated()), id: \.element.id) { index, split in
                    splitRow(split: split)
                    if index < splits.count - 1 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
        }
    }

    private func splitRow(split: BillSplitDTO) -> some View {
        HStack {
            Text(split.user?.name ?? split.user?.username ?? "Member")
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Text(BillsListViewModel.formatCurrency(split.amount))
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }
}

#Preview {
    BillDetailView(homeId: "preview", billId: "bill-1", onBack: {}, onEdit: {})
}
