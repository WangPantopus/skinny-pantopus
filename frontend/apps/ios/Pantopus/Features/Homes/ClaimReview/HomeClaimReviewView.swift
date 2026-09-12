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
    @State private var residencyTarget: HomeResidencyReviewViewModel?
    @State private var evidenceTarget: PrivateClaimEvidenceViewModel?
    @State private var relationshipTarget: HomeRelationshipViewModel?

    private let onBack: @MainActor () -> Void

    public init(homeId: String, initialTab: HomeClaimReviewTab = .ownership, onBack: @escaping @MainActor () -> Void) {
        let model = HomeClaimReviewViewModel(homeId: homeId)
        model.selectedTab = initialTab
        _viewModel = State(initialValue: model)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            Button("Relationship decisions and recovery") {
                relationshipTarget = HomeRelationshipViewModel(homeId: viewModel.homeId)
            }
            .frame(minHeight: 44)
            .padding(Spacing.s3)
            .accessibilityIdentifier("homeClaimReview.relationshipRecovery")
            Button("Residency decisions and recovery") {
                residencyTarget = .live(homeId: viewModel.homeId)
            }
            .frame(minHeight: 44)
            .padding(Spacing.s3)
            .accessibilityIdentifier("homeClaimReview.residencyRecovery")
            if case .loaded = viewModel.state {
                HomeClaimReviewTabStrip(tabs: tabItems, selection: tabBinding)
            }
            stateBody(for: viewModel.state)
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeClaimReview")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .sheet(item: $evidenceTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            PrivateClaimEvidenceView(model: target)
        })
        .sheet(item: $relationshipTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            HomeRelationshipView(model: target)
        })
        .sheet(item: $residencyTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            HomeResidencyReviewView(model: target)
        })
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
                Task { await viewModel.review(target.snapshot, action: target.verdict) }
                verdictConfirm = nil
            }
            .accessibilityIdentifier("homeClaimReview_verdictConfirm")
            Button("Cancel", role: .cancel) { verdictConfirm = nil }
        } message: { target in
            Text(target.verdict.confirmBody + "\n\n" + target.snapshot.summary)
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
    }

    // MARK: - Chrome

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("homeClaimReview_back")

            Text("Review claims")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)

            Color.clear.frame(width: 44, height: 44)
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
            case .ownership:
                if data.ownershipUnavailable { unavailableCollection("ownership") } else { ownershipTab(data.ownership) }
            case .residency:
                if data.residencyUnavailable { unavailableCollection("residency") } else { residencyTab(data.residency) }
            case .compare: compareTab(data.comparison)
            }
        }
    }

    private func unavailableCollection(_ collection: String) -> some View {
        ErrorState(
            headline: "Couldn't load \(collection) claims",
            message: "Current access or claim data could not be verified. Reload to try again."
        ) { await viewModel.refresh() }
            .accessibilityIdentifier("homeClaimReview_\(collection)Unavailable")
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
                                Task {
                                    if let snapshot = await viewModel.prepareReview(claimId: item.id, action: verdict) {
                                        verdictConfirm = VerdictConfirm(snapshot: snapshot, verdict: verdict)
                                    }
                                }
                            },
                            onRelationship: { action in
                                if action == .inviteToHousehold {
                                    relationshipConfirm = RelationshipConfirm(
                                        claimId: item.id, action: action, isOwnerClaim: item.claimType == "owner"
                                    )
                                } else {
                                    relationshipTarget = HomeRelationshipViewModel(
                                        homeId: viewModel.homeId,
                                        claimId: item.id,
                                        action: action == .flagUnknownPerson ? .flag : .decline
                                    )
                                }
                            }
                        )
                        Button("Review private documents") {
                            Task { evidenceTarget = await viewModel.makeEvidenceViewModel(claimId: item.id) }
                        }.disabled(viewModel.actionLoading != nil)
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
                                residencyTarget = .live(homeId: viewModel.homeId, claimId: item.id, action: .approve)
                            },
                            onReject: {
                                residencyTarget = .live(homeId: viewModel.homeId, claimId: item.id, action: .reject)
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
        let snapshot: HomeClaimReviewSnapshot
        var claimId: String {
            snapshot.claimId
        }

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
}

#Preview {
    NavigationStack {
        HomeClaimReviewView(homeId: "preview-home-id") {}
    }
}
