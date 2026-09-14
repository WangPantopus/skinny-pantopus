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
    @Environment(\.scenePhase) private var scenePhase
    @State private var visible = false
    @State private var queue: HomeResidencyQueueViewModel
    @State private var viewModel: HomeClaimReviewViewModel
    @State private var verdictConfirm: VerdictConfirm?
    @State private var relationshipConfirm: RelationshipConfirm?
    @State private var residencyTarget: HomeResidencyReviewViewModel?
    @State private var showingResidencyHistory = false
    @State private var evidenceTarget: PrivateClaimEvidenceViewModel?
    @State private var relationshipTarget: HomeRelationshipViewModel?

    private let onBack: @MainActor () -> Void

    public init(homeId: String, initialTab: HomeClaimReviewTab = .ownership, onBack: @escaping @MainActor () -> Void) {
        let model = HomeClaimReviewViewModel(homeId: homeId)
        model.selectedTab = initialTab
        _viewModel = State(initialValue: model)
        _queue = State(initialValue: .live(homeId: homeId))
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            Button("Relationship decisions and recovery") {
                queue.suspend()
                relationshipTarget = HomeRelationshipViewModel(homeId: viewModel.homeId)
            }
            .frame(minHeight: 44)
            .padding(Spacing.s3)
            .accessibilityIdentifier("homeClaimReview.relationshipRecovery")
            Button("Residency decisions and recovery") {
                queue.suspend()
                residencyTarget = .live(homeId: viewModel.homeId)
            }
            .frame(minHeight: 44)
            .padding(Spacing.s3)
            .accessibilityIdentifier("homeClaimReview.residencyRecovery")
            Button("Your past residency decisions") { queue.suspend()
                showingResidencyHistory = true
            }
            .frame(minHeight: 44)
            .padding(Spacing.s3)
            .accessibilityIdentifier("homeClaimReview.residencyHistory")
            HomeClaimReviewTabStrip(tabs: tabItems, selection: tabBinding)
            if viewModel.selectedTab == .residency {
                HomeResidencyQueueView(model: queue) { claimId, action in
                    residencyTarget = .live(homeId: viewModel.homeId, claimId: claimId, action: action)
                }
            } else { stateBody(for: viewModel.state) }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeClaimReview")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onAppear { visible = true }
        .onDisappear { visible = false
            queue.suspend()
        }
        .onChange(of: queueActive) { _, _ in updateQueueVisibility() }
        .onChange(of: queue.isCurrent) { _, current in if !current { queue.suspend() } }
        .sheet(item: $evidenceTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            PrivateClaimEvidenceView(model: target)
        })
        .sheet(item: $relationshipTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            HomeRelationshipView(model: target)
        })
        .sheet(item: $residencyTarget, onDismiss: { Task { await viewModel.refresh() } }, content: { target in
            HomeResidencyReviewView(model: target)
        })
        .sheet(isPresented: $showingResidencyHistory, onDismiss: { Task { await viewModel.refresh() } }, content: {
            HomeResidencyHistoryView(homeId: viewModel.homeId) { showingResidencyHistory = false }
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

    private var queueActive: Bool {
        visible && scenePhase == .active && viewModel.selectedTab == .residency
            && residencyTarget == nil && !showingResidencyHistory && evidenceTarget == nil
            && relationshipTarget == nil && verdictConfirm == nil && relationshipConfirm == nil
    }

    private func updateQueueVisibility() {
        if queueActive {
            queue.resume()
            Task { await queue.refresh() }
        } else { queue.suspend() }
    }

    // MARK: - Chrome

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button {
                queue.suspend()
                onBack()
            } label: {
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
                title: "Residency"
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
            set: { tab in
                guard tab != viewModel.selectedTab else { return }
                queue.suspend()
                viewModel.selectedTab = tab
            }
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
                headline: "No pending ownership claims",
                subcopy: "New ownership claims for this Home will appear here.",
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
            case .residency: EmptyView() // Rendered by the independent queue above.
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
