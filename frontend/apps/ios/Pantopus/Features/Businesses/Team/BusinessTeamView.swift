//
//  BusinessTeamView.swift
//  Pantopus
//
//  B2C — owner-side business team & roles management. A faithful clone of
//  the per-home Members screen (`Features/Homes/Members`): a roster grouped
//  into role sections + a pending-invites section, each row carrying an
//  avatar, name/email, and a role pill, with an overflow menu (Change role
//  / Manage permissions / Remove) and an invite wizard.
//
//  The shared `ListOfRowsView` archetype can't carry the granular
//  `businessTeam.*` test-tag contract (per-section / per-row / overflow
//  identifiers) without modifying shared files, so this screen renders the
//  same visual vocabulary directly while reusing `WizardShell` for the
//  invite flow and the role-palette tokens for the chips.
//
// swiftlint:disable file_length

import SwiftUI

/// Pushed onto the Business owner stack from the dashboard's "Team" row.
/// Reaches `GET /api/businesses/:id/members` (grouped by role) +
/// `GET /api/businesses/:id/seats` (pending invites) and the role / remove
/// / invite mutations.
public struct BusinessTeamView: View {
    @State private var viewModel: BusinessTeamViewModel
    @State private var activeSheet: TeamSheet?
    @State private var overflowTarget: BusinessTeamMemberRow?
    @State private var removeTarget: BusinessTeamMemberRow?
    @State private var cancelTarget: BusinessTeamPendingRow?

    private let businessId: String

    public init(businessId: String) {
        self.businessId = businessId
        _viewModel = State(initialValue: BusinessTeamViewModel(businessId: businessId))
    }

    /// Test seam — lets previews/tests inject a pre-seeded VM.
    init(businessId: String, viewModel: BusinessTeamViewModel) {
        self.businessId = businessId
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content
            if inviteEnabled {
                InviteFAB { activeSheet = .invite }
                    .padding(Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("businessTeam.screen")
        .navigationTitle("Team")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .sheet(item: $activeSheet) { sheet in
            sheetBody(sheet)
        }
        .confirmationDialog(
            overflowTarget?.name ?? "",
            isPresented: overflowBinding,
            titleVisibility: .visible,
            presenting: overflowTarget
        ) { row in
            Button("Change role") { activeSheet = .changeRole(row) }
                .accessibilityIdentifier("businessTeam.changeRole")
            Button("Manage permissions") { activeSheet = .permissions(row) }
                .accessibilityIdentifier("businessTeam.managePermissions")
            Button("Remove from team", role: .destructive) { removeTarget = row }
                .accessibilityIdentifier("businessTeam.remove")
            Button("Cancel", role: .cancel) {}
        }
        .alert(
            "Remove member?",
            isPresented: removeBinding,
            presenting: removeTarget
        ) { row in
            Button("Remove \(row.name)", role: .destructive) {
                Task { await viewModel.remove(userId: row.userId) }
                removeTarget = nil
            }
            .accessibilityIdentifier("businessTeam_removeConfirm")
            Button("Cancel", role: .cancel) { removeTarget = nil }
        } message: { row in
            Text("\(row.name) will lose access to this business. They can be re-invited later.")
        }
        .alert(
            "Cancel invite?",
            isPresented: cancelBinding,
            presenting: cancelTarget
        ) { row in
            Button("Cancel invite", role: .destructive) {
                Task { await viewModel.cancelInvite(seatId: row.seatId) }
                cancelTarget = nil
            }
            .accessibilityIdentifier("businessTeam_cancelConfirm")
            Button("Keep invite", role: .cancel) { cancelTarget = nil }
        } message: { row in
            Text("The pending invite for \(row.name) will be withdrawn.")
        }
    }

    // MARK: - State body

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            BusinessTeamLoadingView()
        case let .loaded(payload):
            loadedScroll(payload)
        case .empty:
            EmptyState(
                icon: .users,
                headline: "No teammates yet",
                subcopy: "Invite someone to help run your business. You control what each role can see and do.",
                cta: inviteEnabled
                    ? EmptyState.CTA(title: "Invite a teammate") { await MainActor.run { activeSheet = .invite } }
                    : nil,
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("businessTeam.empty")
        case let .error(message):
            BusinessTeamErrorView(message: message) {
                Task { await viewModel.refresh() }
            }
        }
    }

    private func loadedScroll(_ payload: BusinessTeamContent) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s4, pinnedViews: []) {
                ForEach(payload.sections) { section in
                    SectionBlock(
                        id: "businessTeam.section.\(section.role.rawValue)",
                        title: section.headerTitle,
                        count: section.rows.count
                    ) {
                        ForEach(section.rows) { row in
                            MemberRowCard(row: row) {
                                overflowTarget = row
                            }
                        }
                    }
                }
                if !payload.pending.isEmpty {
                    SectionBlock(
                        id: "businessTeam.pendingSection",
                        title: "Pending invites",
                        count: payload.pending.count
                    ) {
                        ForEach(payload.pending) { row in
                            PendingRowCard(row: row) {
                                cancelTarget = row
                            }
                        }
                    }
                }
            }
            .padding(Spacing.s4)
            .padding(.bottom, Spacing.s16)
        }
    }

    // MARK: - Sheets

    @ViewBuilder private func sheetBody(_ sheet: TeamSheet) -> some View {
        switch sheet {
        case .invite:
            InviteTeammateWizardView(businessId: businessId) { seat in
                activeSheet = nil
                if let seat { viewModel.handleInvited(seat) }
            }
        case let .changeRole(row):
            ChangeRoleSheet(
                memberName: row.name,
                currentRole: row.role,
                presets: viewModel.rolePresets
            ) { preset in
                Task { await viewModel.changeRole(userId: row.userId, preset: preset) }
            }
        case let .permissions(row):
            ManagePermissionsSheet(
                memberName: row.name,
                loadPermissions: { await viewModel.memberPermissions(userId: row.userId) },
                toggle: { permission, allowed in
                    await viewModel.togglePermission(
                        userId: row.userId,
                        permission: permission,
                        allowed: allowed
                    )
                }
            )
        }
    }

    // MARK: - Bindings

    private var inviteEnabled: Bool {
        switch viewModel.state {
        case let .loaded(payload): payload.canInvite
        case .empty: true
        default: false
        }
    }

    private var overflowBinding: Binding<Bool> {
        Binding(get: { overflowTarget != nil }, set: { if !$0 { overflowTarget = nil } })
    }

    private var removeBinding: Binding<Bool> {
        Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } })
    }

    private var cancelBinding: Binding<Bool> {
        Binding(get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } })
    }

    /// Which modal sheet is presented. A single enum avoids stacked
    /// `.sheet` modifiers fighting over presentation.
    enum TeamSheet: Identifiable {
        case invite
        case changeRole(BusinessTeamMemberRow)
        case permissions(BusinessTeamMemberRow)

        var id: String {
            switch self {
            case .invite: "invite"
            case let .changeRole(row): "changeRole-\(row.id)"
            case let .permissions(row): "permissions-\(row.id)"
            }
        }
    }
}

// MARK: - Section block

private struct SectionBlock<Content: View>: View {
    let id: String
    let title: String
    let count: Int
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(title.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
                Text("(\(count))")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
            }
            VStack(spacing: Spacing.s2) {
                content
            }
        }
        .accessibilityIdentifier(id)
    }
}

// MARK: - Member row

private struct MemberRowCard: View {
    let row: BusinessTeamMemberRow
    let onOverflow: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            TeamAvatar(name: row.name, gradient: row.avatarGradient)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(row.name)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    RolePill(role: row.role)
                }
                if let email = row.email, !email.isEmpty {
                    metaLine(text: email, icon: .mail)
                }
                if let joined = row.joinedText {
                    metaLine(text: joined, icon: .clock)
                }
            }
            Spacer(minLength: Spacing.s2)
            if row.canManage {
                OverflowButton(label: row.name, action: onOverflow)
            }
        }
        .padding(Spacing.s3)
        .frame(minHeight: 60, alignment: .top)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("businessTeam.row.\(row.userId)")
    }
}

// MARK: - Pending row

private struct PendingRowCard: View {
    let row: BusinessTeamPendingRow
    let onCancel: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            TeamAvatar(name: row.name, gradient: gradient, icon: .mail)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(row.name)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    RolePill(role: row.role)
                }
                if let email = row.email, !email.isEmpty {
                    metaLine(text: email, icon: .mail)
                }
                if let invited = row.invitedText {
                    metaLine(text: invited, icon: .mailbox)
                }
            }
            Spacer(minLength: Spacing.s2)
            if row.canManage {
                CompactButton(
                    title: "Cancel",
                    variant: .ghost,
                    size: .inlineAction,
                    action: onCancel
                )
                .frame(width: 84)
                .accessibilityIdentifier("businessTeam.pendingCancel.\(row.seatId)")
            }
        }
        .padding(Spacing.s3)
        .frame(minHeight: 60, alignment: .top)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningBg, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("businessTeam.row.\(row.seatId)")
    }

    private var gradient: GradientPair {
        BusinessTeamAvatarTone.tone(for: row.seatId).gradient
    }
}

// MARK: - Shared row bits

@MainActor
private func metaLine(text: String, icon: PantopusIcon) -> some View {
    HStack(alignment: .center, spacing: Spacing.s1) {
        Icon(icon, size: 11, color: Theme.Color.appTextSecondary)
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .lineLimit(1)
    }
}

private struct RolePill: View {
    let role: BusinessRole

    var body: some View {
        let palette = role.palette
        HStack(spacing: 3) {
            Icon(role.icon, size: 11, color: palette.foreground)
            Text(role.label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(palette.foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(palette.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

private struct TeamAvatar: View {
    let name: String
    let gradient: GradientPair
    var icon: PantopusIcon?

    var body: some View {
        ZStack {
            Circle().fill(
                LinearGradient(
                    colors: [gradient.start, gradient.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            if let icon {
                Icon(icon, size: 16, color: Theme.Color.appTextInverse)
            } else {
                Text(initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
        }
        .frame(width: 40, height: 40)
    }

    private var initials: String {
        name.split(separator: " ").prefix(2).map { $0.prefix(1) }.joined().uppercased()
    }
}

private struct OverflowButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(.moreHorizontal, size: 20, color: Theme.Color.appTextSecondary)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More actions for \(label)")
        .accessibilityIdentifier("businessTeam.overflow")
    }
}

private struct InviteFAB: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(.userPlus, size: 22, color: Theme.Color.appTextInverse)
                .frame(width: 52, height: 52)
                .background(Theme.Color.business)
                .clipShape(Circle())
                .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Invite teammate")
        .accessibilityIdentifier("businessTeam.inviteBtn")
    }
}

// MARK: - Loading + error

private struct BusinessTeamLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(0..<2, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 90, height: 12, cornerRadius: Radii.sm)
                        ForEach(0..<2, id: \.self) { _ in
                            HStack(spacing: Spacing.s3) {
                                Shimmer(width: 40, height: 40, cornerRadius: Radii.pill)
                                VStack(alignment: .leading, spacing: Spacing.s1) {
                                    Shimmer(width: 160, height: 14)
                                    Shimmer(width: 120, height: 12)
                                }
                                Spacer()
                            }
                            .padding(Spacing.s3)
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                        }
                    }
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("businessTeam.loading")
    }
}

private struct BusinessTeamErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your team")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("businessTeam.error")
    }
}

#Preview("Loaded") {
    NavigationStack {
        BusinessTeamView(
            businessId: "preview-business",
            viewModel: BusinessTeamViewModel(
                businessId: "preview-business",
                seed: .sample
            )
        )
    }
}
