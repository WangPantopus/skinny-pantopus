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
        guard case .loaded = state, !entries.isEmpty else { return nil }
        let count = entries.count
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
    private var requests: [PersonalHomeResidencyRequest] = []
    private var nextCursor: String?
    private var homesError: String?
    private var historyError: String?
    private var loadingHistory = false

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
        requests = []
        nextCursor = nil
        homesError = nil
        historyError = nil
        loadingHistory = false
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
        guard isCurrent else { retireSession()
            return
        }
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
        } catch {
            guard current(revision) else { return }
            homesError = "Your saved Homes could not be checked. Retry."
        }
        guard current(revision) else { return }
        await loadHistory(revision: revision, cursor: nil)
    }

    func loadMoreIfNeeded() async {
        guard current(generation), !loadingHistory, let cursor = nextCursor else { return }
        await loadHistory(revision: generation, cursor: cursor)
    }

    private func loadHistory(revision: Int, cursor: String?) async {
        guard current(revision), !loadingHistory else { return }
        loadingHistory = true
        historyError = nil
        render(revision: revision)
        do {
            let page: PersonalHomeResidencyPage = try await api.request(Endpoint(
                method: .get,
                path: "/api/homes/my-residency",
                query: cursor.map { ["after": $0] } ?? [:],
                cachePolicy: .reloadIgnoringLocalCacheData
            ))
            guard current(revision), !Task.isCancelled else { return }
            guard page.follows(cursor), Set(requests.map(\.id)).isDisjoint(with: page.requests.map(\.id)) else {
                throw APIError.invalidResponse
            }
            requests.append(contentsOf: page.requests)
            nextCursor = page.nextCursor
        } catch {
            guard current(revision) else { return }
            historyError = cursor == nil ? "Your residency requests could not be checked. Retry."
                : "More residency requests could not be checked. Retry."
        }
        guard current(revision) else { return }
        loadingHistory = false
        render(revision: revision)
    }

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
        let personal = Self.pendingVerification(for: entry) == .residency ? requests.first { $0.homeId == entry.id } : nil
        let fallback = Self.pendingVerification(for: entry) == .residency ? "Residency request · \(entry.id.suffix(8))" : "Home"
        let title = personal?.label ?? home.name?.nilIfEmpty ?? home.address?.nilIfEmpty ?? fallback
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
        if pending != nil { chips.append(.init(
            text: personal?.reviewLabel ?? "Verification in progress",
            icon: .clock,
            tint: .status(.warning)
        )) }
        let canDelete = entry.canDeleteHome == true
        let footerTitle = entry
            .accessKind == "private_setup" ? "My tasks" : pending == .owner ? "Continue ownership verification" : pending == .residency ?
            "Check residency status" : nil
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

private extension MyHomesListViewModel {
    func render(revision: Int) {
        guard current(revision) else { return }
        if homesError != nil, historyError != nil, entries.isEmpty, requests.isEmpty {
            state = .error(message: "Your Homes and residency requests could not be checked. Retry.")
            return
        }
        var sections: [RowSection] = []
        if !entries.isEmpty {
            sections.append(RowSection(id: "homes", rows: entries.map { row(for: $0, revision: revision) }))
        }
        if let homesError {
            sections.append(RowSection(id: "homes-error", rows: [
                recoveryRow(
                    id: "homes-retry",
                    message: homesError,
                    title: "Retry saved Homes",
                    revision: revision,
                    refreshAll: true
                )
            ]))
        }
        let represented = Set(entries.filter { Self.pendingVerification(for: $0) == .residency }.map(\.id))
        var history = requests.filter { !represented.contains($0.homeId ?? "") }.map { request in
            let open: @Sendable () -> Void = { [weak self] in
                Task { @MainActor in
                    guard let self, self.current(revision), let homeId = request.homeId else { return }
                    self.onVerifyResidency?(homeId)
                }
            }
            return RowModel(
                id: "residency-request_" + request.id,
                title: request.label,
                subtitle: request.reviewLabel,
                template: .avatarKebab,
                leading: .typeIcon(.home, background: Theme.Color.homeBg, foreground: Theme.Color.home),
                trailing: request.homeId == nil ? .none : .chevron,
                onTap: open,
                body: request.homeId == nil ? "This saved request is no longer linked to a Home."
                    : "Your submitted request. Check current status before continuing.",
                footer: request.homeId.map { _ in
                    RowFooter(actions: [
                        RowFooterAction(
                            title: "Check residency status",
                            icon: .arrowRight,
                            variant: .primary,
                            identifier: "myResidency.request_" + request.id + ".continue",
                            handler: open
                        )
                    ])
                }
            )
        }
        if loadingHistory {
            history.append(RowModel(id: "residency-loading", title: "Checking residency requests…", template: .avatarKebab))
        } else if let historyError {
            history.append(recoveryRow(id: "residency-retry", message: historyError, title: "Retry residency requests", revision: revision))
        } else if nextCursor != nil {
            history.append(recoveryRow(
                id: "residency-more",
                message: "More personal requests are available.",
                title: "Load more requests",
                revision: revision
            ))
        }
        if !history.isEmpty {
            sections.append(RowSection(
                id: "residency-history",
                header: "Your residency requests",
                footer: "Saved requests do not grant current household access.",
                rows: history
            ))
        }
        state = sections.isEmpty ? .empty(.init(
            icon: .home,
            headline: "No saved Homes yet",
            subcopy: "Add a Home to organize your private tasks, or continue a household invitation.",
            ctaTitle: "Add a home",
            onCTA: onAddHome
        )) : .loaded(sections: sections, hasMore: false)
    }

    func recoveryRow(id: String, message: String, title: String, revision: Int, refreshAll: Bool = false) -> RowModel {
        let action: @Sendable () -> Void = { [weak self] in
            Task { @MainActor in
                guard let self, self.current(revision) else { return }
                if refreshAll { await self.refresh() } else { await self.loadHistory(revision: revision, cursor: self.nextCursor) }
            }
        }
        return RowModel(
            id: id,
            title: message,
            template: .avatarKebab,
            onTap: action,
            footer: RowFooter(actions: [
                RowFooterAction(
                    title: title,
                    icon: .arrowRight,
                    variant: .primary,
                    identifier: "myHomes." + id,
                    handler: action
                )
            ])
        )
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
