import Foundation
import Observation
import SwiftUI

enum MyHomesListEvent: Equatable {
    case confirmDelete(homeId: String, name: String)
}

/// The server distinguishes current household access, private setup and personal
/// verification. Neither an address nor an ownership role changes that boundary.
@Observable
@MainActor
final class MyHomesListViewModel: ListOfRowsDataSource {
    let title = "My homes"
    let tabs: [ListOfRowsTab] = []
    var selectedTab = ""
    var topBarAction: TopBarAction? {
        TopBarAction(icon: .search, accessibilityLabel: "Find or add a home", handler: onFindHome)
    }

    var fab: FABAction? {
        FABAction(icon: .plusCircle, accessibilityLabel: "Add a home", variant: .secondaryCreate, tint: .home, handler: onAddHome)
    }

    var banner: BannerConfig? {
        guard case let .loaded(sections, _) = state, let count = sections.first?.rows.count, count > 0 else { return nil }
        return BannerConfig(
            icon: .home,
            title: count == 1 ? "1 saved Home" : "\(count) saved Homes",
            subtitle: "Open your household, private tasks or verification progress",
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading
    var pendingEvent: MyHomesListEvent?
    var actionError: String?
    private(set) var deletingHomeId: String?
    private let api: APIClient
    private let scope: HomeClaimSessionScope
    private let onOpenHome: (String) -> Void
    private let onOpenTasks: (@Sendable (String) -> Void)?
    private let onAddHome: @Sendable () -> Void
    private let onFindHome: @Sendable () -> Void
    private let onUploadOwnershipEvidence: (@Sendable (String) -> Void)?
    private let onVerifyResidency: (@Sendable (String) -> Void)?
    private var generation = 0
    private var visible = false
    private var entries: [MyHome] = []

    init(
        api: APIClient = .shared,
        identity: (() -> String?)? = nil,
        onOpenHome: @escaping (String) -> Void = { _ in },
        onOpenTasks: (@Sendable (String) -> Void)? = nil,
        onAddHome: @escaping @Sendable () -> Void = {},
        onFindHome: @escaping @Sendable () -> Void = {},
        onUploadOwnershipEvidence: (@Sendable (String) -> Void)? = nil,
        onVerifyResidency: (@Sendable (String) -> Void)? = nil
    ) {
        self.api = api
        scope = HomeClaimSessionScope(api: api, identity: identity)
        self.onOpenHome = onOpenHome
        self.onOpenTasks = onOpenTasks
        self.onAddHome = onAddHome
        self.onFindHome = onFindHome
        self.onUploadOwnershipEvidence = onUploadOwnershipEvidence
        self.onVerifyResidency = onVerifyResidency
    }

    var isCurrent: Bool {
        scope.isCurrent
    }

    func suspend() {
        generation += 1
        visible = false
        entries = []
        pendingEvent = nil
        actionError = nil
        state = .loading
    }

    func retireSession() {
        suspend()
        state = .error(message: "Your session changed. Reopen your Homes list to continue.")
    }

    func load() async {
        if visible, case .loaded = state { return }
        await refresh()
    }

    func refresh() async {
        suspend()
        visible = true
        let revision = generation
        do {
            try scope.requireCurrent()
            let response: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            guard current(revision), !Task.isCancelled else { return }
            guard response.homes.allSatisfy(\.hasValidListContext),
                  Set(response.homes.map(\.id)).count == response.homes.count else { throw APIError.invalidResponse }
            entries = response.homes
            let rows = entries.map { row(for: $0, revision: revision) }
            state = rows.isEmpty ? .empty(.init(
                icon: .home,
                headline: "No saved Homes yet",
                subcopy: "Add a Home to organize your private tasks, or continue a household invitation.",
                ctaTitle: "Add a home",
                onCTA: onAddHome
            )) : .loaded(
                sections: [RowSection(rows: rows)],
                hasMore: false
            )
        } catch {
            guard visible, generation == revision else { return }
            entries = []
            state = .error(message: isCurrent ? ((error as? APIError)?.errorDescription ?? "Could not load your Homes. Retry.")
                : "Your session changed. Reopen your Homes list to continue.")
        }
    }

    func loadMoreIfNeeded() async {}
    private func current(_ revision: Int) -> Bool {
        visible && generation == revision && isCurrent
    }

    func deleteHome(homeId: String) async {
        let revision = generation
        guard current(revision), deletingHomeId == nil,
              entries.contains(where: { $0.id == homeId && $0.canDeleteHome == true }) else { return }
        deletingHomeId = homeId
        actionError = nil
        defer { deletingHomeId = nil }
        do {
            try scope.requireCurrent()
            let _: DeleteHomeResponse = try await api.request(HomeAdminEndpoints.deleteHome(homeId: homeId))
            guard current(revision) else { return }
            await refresh()
        } catch {
            guard current(revision) else { return }
            actionError = (error as? APIError)?.errorDescription ?? "Failed to delete. Reload your Homes to check."
        }
    }

    enum PendingVerification: Equatable { case owner, residency }
    static func pendingVerification(for entry: MyHome) -> PendingVerification? {
        guard entry.accessKind == "verification" else { return nil }
        return entry.ownershipStatus == "pending" || entry.pendingClaimId != nil ? .owner : .residency
    }

    private func open(_ entry: MyHome, revision: Int) {
        guard current(revision) else { return }
        switch entry.accessKind {
        case "shared": onOpenHome(entry.id)
        case "private_setup": onOpenTasks?(entry.id)
        case "verification":
            if Self.pendingVerification(for: entry) == .owner {
                onUploadOwnershipEvidence?(entry.id)
            } else {
                onVerifyResidency?(entry.id)
            }
        default: break
        }
    }

    private func row(for entry: MyHome, revision: Int) -> RowModel {
        let home = entry.home
        let title = home.name?.nilIfEmpty ?? home.address?.nilIfEmpty ?? "Home"
        let locality = [home.city, home.state].compactMap { $0?.nilIfEmpty }.joined(separator: ", ").nilIfEmpty
        let unit = entry.accessKind == "verification" ? nil : home.address2?.nilIfEmpty.map { "Unit \($0)" }
        let subtitle = [unit, roleLabel(for: entry), locality].compactMap { $0 }.joined(separator: " · ")
        var chips: [RowChip] = []
        if entry.accessKind == "private_setup" { chips.append(.init(text: "Private setup", icon: .home, tint: .status(.warning))) }
        if entry.hasSharedAccess, entry.ownershipStatus == "verified" { chips.append(.init(
            text: "Ownership verified",
            icon: .shieldCheck,
            tint: .status(.success)
        )) }
        if entry.hasSharedAccess, entry.occupancy?.verificationStatus == "verified" { chips.append(.init(
            text: "Residency verified",
            icon: .home,
            tint: .status(.success)
        )) }
        let pending = Self.pendingVerification(for: entry)
        if pending != nil { chips.append(.init(text: "Verification in progress", icon: .clock, tint: .status(.warning))) }
        let canDelete = entry.canDeleteHome == true
        let footerTitle = entry
            .accessKind == "private_setup" ? "My tasks" : pending == .owner ? "Continue ownership verification" : pending == .residency ?
            "Continue residency verification" : nil
        let footer = footerTitle.map { text in
            let action = RowFooterAction(
                title: text,
                icon: .arrowRight,
                variant: .primary,
                identifier: "myHomes.row_\(entry.id).continue"
            ) { [weak self] in
                Task<Void, Never> { @MainActor in self?.open(entry, revision: revision) }
            }
            return RowFooter(actions: [action])
        }
        let secondary: (@Sendable () -> Void)? = if canDelete {
            { [weak self] in
                Task<Void, Never> { @MainActor in
                    guard let self, self.current(revision) else { return }
                    self.pendingEvent = .confirmDelete(homeId: entry.id, name: title)
                }
            }
        } else {
            nil
        }
        return RowModel(
            id: entry.id,
            title: title,
            subtitle: subtitle,
            template: .avatarKebab,
            leading: .typeIcon(.home, background: Theme.Color.homeBg, foreground: Theme.Color.home),
            trailing: canDelete ? .kebab : .chevron,
            onTap: { [weak self] in Task<Void, Never> { @MainActor in self?.open(entry, revision: revision) } },
            onSecondary: secondary,
            chips: chips.isEmpty ? nil : chips,
            footer: footer
        )
    }

    private func roleLabel(for entry: MyHome) -> String? {
        if entry.accessKind == "private_setup" { return "Your private Home" }
        if entry
            .accessKind ==
            "verification" { return Self.pendingVerification(for: entry) == .owner ? "Ownership request" : "Residency request" }
        switch entry.roleBase {
        case "owner": return "Owner role"
        case "admin": return "Administrator"
        case "manager": return "Manager"
        case "lease_resident": return "Tenant"
        case "member": return "Member"
        case "restricted_member": return "Restricted member"
        case "guest": return "Guest"
        case "service_provider": return "Service provider"
        default: return nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
