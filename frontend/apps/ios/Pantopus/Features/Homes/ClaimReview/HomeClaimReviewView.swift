//
//  HomeClaimReviewView.swift
//  Pantopus
//
//  H6 — Per-home **owner** claim review (RN
//  `src/app/homes/[id]/owners/review-claim.tsx`). Reached from the
//  Owners list top-bar action.
//
//  Deliberately separate from `Features/ReviewClaims/*`, which is the
//  platform-admin queue on `/api/admin/claims*`. Nothing here talks to
//  `AdminEndpoints`.
//
//  Layout follows A08 "Review claims" (tabbed card list) with the A13.3
//  "Review Claim" verdict palette on each card's action row.
//

// swiftlint:disable type_body_length

import SwiftUI

/// Owner-facing claim triage for one home.
public struct HomeClaimReviewView: View {
    @State private var viewModel: HomeClaimReviewViewModel
    @State private var verdictConfirm: VerdictConfirm?
    @State private var relationshipConfirm: RelationshipConfirm?
    @State private var residencyConfirm: ResidencyConfirm?

    private let onBack: @MainActor () -> Void

    public init(homeId: String, onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: HomeClaimReviewViewModel(homeId: homeId))
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            if case .loaded = viewModel.state {
                HomeClaimReviewTabStrip(tabs: tabItems, selection: tabBinding)
            }
            stateBody(for: viewModel.state)
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityIdentifier("homeClaimReview")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.clearToast()
                    }
            }
        }
        .confirmationDialog(
            verdictConfirm?.verdict.title ?? "",
            isPresented: verdictDialogBinding,
            titleVisibility: .visible,
            presenting: verdictConfirm
        ) { target in
            Button(
                target.verdict.title,
                role: target.verdict.isDestructive ? ButtonRole.destructive : nil
            ) {
                Task { await viewModel.review(claimId: target.claimId, action: target.verdict) }
                verdictConfirm = nil
            }
            .accessibilityIdentifier("homeClaimReview_verdictConfirm")
            Button("Cancel", role: .cancel) { verdictConfirm = nil }
        } message: { target in
            Text(target.verdict.confirmBody)
        }
        .confirmationDialog(
            relationshipConfirm?.title ?? "",
            isPresented: relationshipDialogBinding,
            titleVisibility: .visible,
            presenting: relationshipConfirm
        ) { target in
            Button(
                target.title,
                role: target.action.isDestructive ? ButtonRole.destructive : nil
            ) {
                Task {
                    await viewModel.resolveRelationship(
                        claimId: target.claimId,
                        action: target.action
                    )
                }
                relationshipConfirm = nil
            }
            .accessibilityIdentifier("homeClaimReview_relationshipConfirm")
            Button("Cancel", role: .cancel) { relationshipConfirm = nil }
        } message: { target in
            Text(target.body)
        }
        .confirmationDialog(
            residencyConfirm?.title ?? "",
            isPresented: residencyDialogBinding,
            titleVisibility: .visible,
            presenting: residencyConfirm
        ) { target in
            Button(target.title, role: target.approve ? nil : ButtonRole.destructive) {
                Task {
                    await viewModel.reviewResidency(
                        claimId: target.claimId,
                        approve: target.approve
                    )
                }
                residencyConfirm = nil
            }
            .accessibilityIdentifier("homeClaimReview_residencyConfirm")
            Button("Cancel", role: .cancel) { residencyConfirm = nil }
        } message: { target in
            Text(target.body)
        }
    }

    // MARK: - Chrome

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("homeClaimReview_back")

            Text("Review claims")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)

            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var tabItems: [HomeClaimReviewTabItem] {
        var items: [HomeClaimReviewTabItem] = [
            HomeClaimReviewTabItem(
                tab: .ownership,
                title: viewModel.ownershipCount > 0
                    ? "Ownership (\(viewModel.ownershipCount))"
                    : "Ownership"
            ),
            HomeClaimReviewTabItem(
                tab: .residency,
                title: viewModel.residencyCount > 0
                    ? "Residency (\(viewModel.residencyCount))"
                    : "Residency"
            )
        ]
        if viewModel.hasComparison {
            items.append(HomeClaimReviewTabItem(tab: .compare, title: "Compare"))
        }
        return items
    }

    private var tabBinding: Binding<HomeClaimReviewTab> {
        Binding(
            get: { viewModel.selectedTab },
            set: { viewModel.selectedTab = $0 }
        )
    }

    // MARK: - States

    @ViewBuilder
    private func stateBody(for state: HomeClaimReviewState) -> some View {
        switch state {
        case .loading:
            ScrollView {
                HomeClaimReviewSkeleton()
                    .padding(Spacing.s4)
            }
        case .empty:
            EmptyState(
                icon: .checkCheck,
                headline: "No claims to review",
                subcopy:
                "You're all caught up. New ownership and residency claims on "
                    + "this home will appear here for you to approve, reject, or flag.",
                tint: Theme.Color.successBg,
                accent: Theme.Color.success
            )
            .accessibilityIdentifier("homeClaimReview_empty")
        case let .error(message):
            ErrorState(
                headline: "Couldn't load claims",
                message: message
            ) {
                await viewModel.refresh()
            }
            .accessibilityIdentifier("homeClaimReview_error")
        case let .loaded(data):
            switch viewModel.selectedTab {
            case .ownership: ownershipTab(data.ownership)
            case .residency: residencyTab(data.residency)
            case .compare: compareTab(data.comparison)
            }
        }
    }

    @ViewBuilder
    private func ownershipTab(_ items: [HomeClaimReviewOwnershipItem]) -> some View {
        if items.isEmpty {
            EmptyState(
                icon: .checkCheck,
                headline: "No pending ownership claims",
                subcopy:
                "Nobody is currently claiming legal title to this home. "
                    + "New claims land here for your approval.",
                tint: Theme.Color.successBg,
                accent: Theme.Color.success
            )
            .accessibilityIdentifier("homeClaimReview_ownershipEmpty")
        } else {
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    ForEach(items) { item in
                        HomeClaimOwnershipCard(
                            item: item,
                            isBusy: viewModel.actionLoading?.hasPrefix("\(item.id):") ?? false,
                            onVerdict: { verdict in
                                verdictConfirm = VerdictConfirm(claimId: item.id, verdict: verdict)
                            },
                            onRelationship: { action in
                                relationshipConfirm = RelationshipConfirm(
                                    claimId: item.id,
                                    action: action,
                                    isOwnerClaim: item.claimType == "owner"
                                )
                            }
                        )
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
        }
    }

    @ViewBuilder
    private func residencyTab(_ items: [HomeClaimReviewResidencyItem]) -> some View {
        if items.isEmpty {
            EmptyState(
                icon: .checkCheck,
                headline: "No pending residency claims",
                subcopy:
                "Neighbors asking to join this household will show up here "
                    + "with the role they requested.",
                tint: Theme.Color.successBg,
                accent: Theme.Color.success
            )
            .accessibilityIdentifier("homeClaimReview_residencyEmpty")
        } else {
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    ForEach(items) { item in
                        HomeClaimResidencyCard(
                            item: item,
                            isBusy: viewModel.actionLoading == item.id,
                            onApprove: {
                                residencyConfirm = ResidencyConfirm(
                                    claimId: item.id,
                                    displayName: item.displayName,
                                    approve: true
                                )
                            },
                            onReject: {
                                residencyConfirm = ResidencyConfirm(
                                    claimId: item.id,
                                    displayName: item.displayName,
                                    approve: false
                                )
                            }
                        )
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
        }
    }

    @ViewBuilder
    private func compareTab(_ comparison: HomeClaimReviewComparison?) -> some View {
        if let comparison {
            ScrollView {
                HomeClaimComparePanel(comparison: comparison)
                    .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
        } else {
            EmptyState(
                icon: .arrowRightLeft,
                headline: "Comparison unavailable",
                subcopy:
                "The side-by-side comparison isn't enabled for this home yet. "
                    + "Use the Ownership tab to act on individual claims."
            )
            .accessibilityIdentifier("homeClaimReview_compareEmpty")
        }
    }

    // MARK: - Confirm payloads

    private struct VerdictConfirm: Identifiable, Equatable {
        let claimId: String
        let verdict: HomeClaimReviewVerdict
        var id: String {
            "\(claimId):\(verdict.rawValue)"
        }
    }

    private struct RelationshipConfirm: Identifiable, Equatable {
        let claimId: String
        let action: HomeClaimRelationshipAction
        let isOwnerClaim: Bool
        var id: String {
            "\(claimId):\(action.rawValue)"
        }

        var title: String {
            action.title(isOwnerClaim: isOwnerClaim)
        }

        var body: String {
            action.body(isOwnerClaim: isOwnerClaim)
        }
    }

    private struct ResidencyConfirm: Identifiable, Equatable {
        let claimId: String
        let displayName: String
        let approve: Bool
        var id: String {
            "\(claimId):\(approve)"
        }

        var title: String {
            approve ? "Approve" : "Reject"
        }

        var body: String {
            approve
                ? "Are you sure you want to approve \(displayName)'s residency claim?"
                : "Are you sure you want to reject \(displayName)'s residency claim?"
        }
    }

    private var verdictDialogBinding: Binding<Bool> {
        Binding(
            get: { verdictConfirm != nil },
            set: { if !$0 { verdictConfirm = nil } }
        )
    }

    private var relationshipDialogBinding: Binding<Bool> {
        Binding(
            get: { relationshipConfirm != nil },
            set: { if !$0 { relationshipConfirm = nil } }
        )
    }

    private var residencyDialogBinding: Binding<Bool> {
        Binding(
            get: { residencyConfirm != nil },
            set: { if !$0 { residencyConfirm = nil } }
        )
    }
}

#Preview {
    NavigationStack {
        HomeClaimReviewView(homeId: "preview-home-id") {}
    }
}
