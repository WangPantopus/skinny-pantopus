//
//  OwnersListView.swift
//  Pantopus
//
//  P15 / T6.3g — Thin wrapper around `ListOfRowsView`. The data source
//  carries rows + chrome; the view dispatches model `pendingEvent`s to
//  the Invite Owner sheet and the remove-owner confirm alert.
//

import SwiftUI

/// Pushed onto the You or Hub stack from the `me.owners` action.
public struct OwnersListView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: OwnersListViewModel
    @State private var invitingOwner = false
    @State private var removeConfirm: RemoveTarget?

    private let homeId: String
    /// H6 — host-supplied push to the per-home claim-review surface.
    private let onOpenClaimReview: (@MainActor () -> Void)?
    /// H5 — host-supplied push to the Transfer Ownership form. RN keeps
    /// this as a sticky bottom action on the Owners list
    /// (`src/app/homes/[id]/owners/index.tsx:116-123`).
    private let onOpenTransfer: (@MainActor () -> Void)?

    public init(
        homeId: String,
        currentUserId: String? = nil,
        onOpenClaimReview: (@MainActor () -> Void)? = nil,
        onOpenTransfer: (@MainActor () -> Void)? = nil
    ) {
        self.homeId = homeId
        self.onOpenClaimReview = onOpenClaimReview
        self.onOpenTransfer = onOpenTransfer
        _viewModel = State(
            initialValue: OwnersListViewModel(
                homeId: homeId,
                currentUserId: currentUserId,
                showsClaimReview: onOpenClaimReview != nil
            )
        )
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .safeAreaInset(edge: .bottom) { transferBar }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("ownersList")
            .onAppear { Analytics.track(.screenOwnersListViewed) }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .sheet(isPresented: $invitingOwner) {
                NavigationStack {
                    InviteOwnerFormView(
                        homeId: homeId,
                        currentUserEmail: currentUserEmail
                    ) {
                        invitingOwner = false
                        viewModel.handleInviteCompleted()
                    }
                }
            }
            .alert(
                "Remove owner?",
                isPresented: Binding(
                    get: { removeConfirm != nil },
                    set: { if !$0 { removeConfirm = nil } }
                ),
                presenting: removeConfirm
            ) { target in
                Button("Remove \(target.displayName)", role: .destructive) {
                    Task { await viewModel.removeOwner(ownerId: target.ownerId) }
                    removeConfirm = nil
                }
                .accessibilityIdentifier("ownersList_removeConfirm")
                Button("Cancel", role: .cancel) { removeConfirm = nil }
            } message: { target in
                Text(
                    "\(target.displayName) will lose owner privileges. " +
                        "If other owners exist, removal may need quorum approval."
                )
            }
    }

    /// Sticky bottom action bar — mirrors RN's warning-tinted
    /// "Transfer Ownership" button under the roster.
    @ViewBuilder
    private var transferBar: some View {
        if let onOpenTransfer {
            VStack(spacing: Spacing.s0) {
                Button(action: onOpenTransfer) {
                    HStack(spacing: Spacing.s2) {
                        Icon(.arrowRightLeft, size: 18, color: Theme.Color.warning)
                        Text("Transfer Ownership")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.warning)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .background(Theme.Color.warningBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.warningLight, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("ownersList_transferCTA")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s4)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
            }
        }
    }

    private func handle(_ event: OwnersListEvent?) {
        guard let event else { return }
        switch event {
        case .openInvite:
            invitingOwner = true
        case let .confirmRemove(ownerId, displayName):
            removeConfirm = RemoveTarget(ownerId: ownerId, displayName: displayName)
        case .openClaimReview:
            onOpenClaimReview?()
        }
        viewModel.pendingEvent = nil
    }

    private struct RemoveTarget: Identifiable, Equatable {
        let ownerId: String
        let displayName: String
        var id: String {
            ownerId
        }
    }

    private var currentUserEmail: String {
        if case let .signedIn(user) = auth.state { return user.email }
        return ""
    }
}

#Preview {
    NavigationStack {
        OwnersListView(homeId: "preview-home-id")
    }
    .environment(AuthManager.previewSignedIn)
}
