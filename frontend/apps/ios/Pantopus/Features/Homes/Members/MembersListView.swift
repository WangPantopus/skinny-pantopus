//
//  MembersListView.swift
//  Pantopus
//
//  T6.3a / P9 — Thin wrapper around `ListOfRowsView` for the per-home
//  Members screen. The data source carries rows + chrome; the view
//  dispatches the model's `pendingEvent` to the Invite wizard sheet, a
//  per-row action sheet (Change role / Remove), and the Requests tab's
//  Invite / Decline confirms.
//

import SwiftUI

/// Pushed onto the Hub / You stack from `HomeDashboardView`. Reaches
/// `GET /api/homes/:id/occupants` (members + pending invites in one
/// call), `GET /api/homes/:id/me`,
/// `GET /api/homes/:id/household-access-requests`,
/// `POST /api/homes/:id/invite`, `POST …/members/:userId/role`,
/// `POST …/household-access-requests/:requestId/(approve|reject)`, and
/// `DELETE …/members/:userId`.
public struct MembersListView: View {
    @State private var viewModel: MembersListViewModel
    @State private var showingInvite = false
    @State private var removeConfirm: RemoveTarget?
    @State private var actionsTarget: MemberActionTarget?
    @State private var roleTarget: MemberActionTarget?
    @State private var approveTarget: RequestTarget?
    @State private var declineTarget: RequestTarget?

    private let homeId: String
    private let onAddGuest: () -> Void

    public init(homeId: String, onAddGuest: @escaping () -> Void = {}) {
        self.homeId = homeId
        self.onAddGuest = onAddGuest
        _viewModel = State(initialValue: MembersListViewModel(homeId: homeId))
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("membersList")
            .onAppear { Analytics.track(.screenMembersListViewed) }
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .sheet(isPresented: $showingInvite) {
                InviteMemberWizardView(homeId: homeId) { invitation in
                    showingInvite = false
                    if let invitation { viewModel.handleInvited(invitation) }
                }
            }
            .modifier(MemberActionsDialogs(
                viewModel: viewModel,
                actionsTarget: $actionsTarget,
                roleTarget: $roleTarget,
                removeConfirm: $removeConfirm
            ))
            .modifier(AccessRequestDialogs(
                viewModel: viewModel,
                approveTarget: $approveTarget,
                declineTarget: $declineTarget
            ))
            .alert(
                "Something went wrong",
                isPresented: Binding(
                    get: { viewModel.actionError != nil },
                    set: { if !$0 { viewModel.actionError = nil } }
                )
            ) {
                Button("OK", role: .cancel) { viewModel.actionError = nil }
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    private func handle(_ event: MembersListEvent?) {
        guard let event else { return }
        switch event {
        case .openInvite:
            showingInvite = true
        case .openAddGuest:
            onAddGuest()
        case let .openMemberActions(target):
            actionsTarget = target
        case let .confirmRemove(userId, name):
            removeConfirm = RemoveTarget(userId: userId, name: name)
        case let .confirmApproveRequest(requestId, name):
            approveTarget = RequestTarget(requestId: requestId, name: name, identity: nil)
        case let .confirmDeclineRequest(requestId, name, identity):
            declineTarget = RequestTarget(requestId: requestId, name: name, identity: identity)
        }
        viewModel.pendingEvent = nil
    }

    struct RemoveTarget: Identifiable, Equatable {
        let userId: String
        let name: String
        var id: String {
            userId
        }
    }

    struct RequestTarget: Identifiable, Equatable {
        let requestId: String
        let name: String
        let identity: String?
        var id: String {
            requestId
        }
    }
}

// MARK: - Member row dialogs

/// Row kebab → action sheet → role picker / remove confirm. Split into a
/// `ViewModifier` so the screen body stays under SwiftLint's body limit.
private struct MemberActionsDialogs: ViewModifier {
    let viewModel: MembersListViewModel
    @Binding var actionsTarget: MemberActionTarget?
    @Binding var roleTarget: MemberActionTarget?
    @Binding var removeConfirm: MembersListView.RemoveTarget?

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                actionsTarget?.name ?? "Member",
                isPresented: Binding(
                    get: { actionsTarget != nil },
                    set: { if !$0 { actionsTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: actionsTarget
            ) { target in
                if !target.assignableRoles.isEmpty {
                    Button("Change role") {
                        actionsTarget = nil
                        roleTarget = target
                    }
                    .accessibilityIdentifier("membersList_changeRole")
                }
                if target.canRemove {
                    Button("Remove from home", role: .destructive) {
                        actionsTarget = nil
                        removeConfirm = MembersListView.RemoveTarget(
                            userId: target.userId,
                            name: target.name
                        )
                    }
                    .accessibilityIdentifier("membersList_removeAction")
                }
                Button("Cancel", role: .cancel) { actionsTarget = nil }
            }
            .confirmationDialog(
                roleTarget.map { "Change role: \($0.name)" } ?? "Change role",
                isPresented: Binding(
                    get: { roleTarget != nil },
                    set: { if !$0 { roleTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: roleTarget
            ) { target in
                ForEach(target.assignableRoles, id: \.self) { role in
                    Button(role.label) {
                        roleTarget = nil
                        Task { await viewModel.changeRole(userId: target.userId, to: role) }
                    }
                    .accessibilityIdentifier("membersList_role_\(role.rawValue)")
                }
                Button("Cancel", role: .cancel) { roleTarget = nil }
            } message: { target in
                Text("Current role: \(MemberRole.parse(target.currentRole).label)")
            }
            .alert(
                "Remove member?",
                isPresented: Binding(
                    get: { removeConfirm != nil },
                    set: { if !$0 { removeConfirm = nil } }
                ),
                presenting: removeConfirm
            ) { target in
                Button("Remove \(target.name)", role: .destructive) {
                    Task { await viewModel.remove(userId: target.userId) }
                    removeConfirm = nil
                }
                .accessibilityIdentifier("membersList_removeConfirm")
                Button("Cancel", role: .cancel) { removeConfirm = nil }
            } message: { target in
                Text("\(target.name) will lose access to this home. They can be re-invited later.")
            }
    }
}

// MARK: - Requests tab dialogs

/// Invite / Decline confirms for the household-access review queue.
/// Copy mirrors RN `src/app/homes/[id]/members/index.tsx:145-195`.
private struct AccessRequestDialogs: ViewModifier {
    let viewModel: MembersListViewModel
    @Binding var approveTarget: MembersListView.RequestTarget?
    @Binding var declineTarget: MembersListView.RequestTarget?

    func body(content: Content) -> some View {
        content
            .alert(
                "Send invitation",
                isPresented: Binding(
                    get: { approveTarget != nil },
                    set: { if !$0 { approveTarget = nil } }
                ),
                presenting: approveTarget
            ) { target in
                Button("Approve") {
                    Task { await viewModel.approveAccessRequest(requestId: target.requestId) }
                    approveTarget = nil
                }
                .accessibilityIdentifier("membersList_approveRequestConfirm")
                Button("Cancel", role: .cancel) { approveTarget = nil }
            } message: { _ in
                Text("This will create a personal invitation for them to accept in the app.")
            }
            .alert(
                "Decline request",
                isPresented: Binding(
                    get: { declineTarget != nil },
                    set: { if !$0 { declineTarget = nil } }
                ),
                presenting: declineTarget
            ) { target in
                Button("Decline", role: .destructive) {
                    Task { await viewModel.rejectAccessRequest(requestId: target.requestId) }
                    declineTarget = nil
                }
                .accessibilityIdentifier("membersList_declineRequestConfirm")
                Button("Cancel", role: .cancel) { declineTarget = nil }
            } message: { target in
                Text(
                    "Decline \(target.name)’s request to join as "
                        + "\(target.identity ?? "a household member")?"
                )
            }
    }
}

#Preview {
    NavigationStack {
        MembersListView(homeId: "preview-home-id")
    }
}
