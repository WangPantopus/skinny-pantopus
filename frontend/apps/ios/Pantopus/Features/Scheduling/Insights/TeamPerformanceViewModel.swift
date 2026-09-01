//
//  TeamPerformanceViewModel.swift
//  Pantopus
//
//  H12 Team Performance (Stream I17, Business violet, business-only). Compares
//  round-robin members on booking load + reliability. States: loaded /
//  single-member (collapse) / empty (solo, hidden) / business-only /
//  permission-gated (403) / loading / error.
//
//  Wiring: `GET /insights/team?days` (deployed shape: window_days /
//  hosts:[{host_user_id, total, confirmed, completed, no_show, cancelled}];
//  `400 BUSINESS_ONLY` for non-business owners). Member names are resolved via
//  the core `BusinessTeamEndpoints.members`. The deployed endpoint does NOT
//  return revenue, ratings, or avg duration, so those design fields are omitted
//  rather than fabricated.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class TeamPerformanceViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case empty
        case businessOnly
        case permissionGated
        case error(String)
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var filter = InsightsFilter.default
    var showFilterSheet = false
    private(set) var sort: HostSort = .bookings

    private(set) var report: InsightsTeamReport?
    private var memberNames: [String: String] = [:]
    private var memberOptionList: [InsightsFilterOption] = []

    // MARK: Chrome

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    private var businessId: String? {
        if case let .business(id) = owner { return id }
        return nil
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        guard let businessId else {
            phase = .businessOnly
            return
        }
        let days = filter.days()
        do {
            let reportResult: InsightsTeamReport = try await client.request(
                SchedulingEndpoints.teamInsights(owner: owner, days: days)
            )
            report = reportResult

            async let membersR: BusinessTeamMembersResponse? = try? client.request(
                BusinessTeamEndpoints.members(businessId: businessId)
            )
            await applyMembers(membersR?.members ?? [])

            phase = hostRows.isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            phase = mapError(error)
        } catch {
            phase = .error("Couldn't load team performance.")
        }
    }

    func refresh() async {
        await load()
    }

    func apply(_ newFilter: InsightsFilter) async {
        filter = newFilter
        await load()
    }

    func openFilter() {
        showFilterSheet = true
    }

    func toggleSort() {
        sort = sort == .bookings ? .noShow : .bookings
    }

    // MARK: Members

    private func applyMembers(_ members: [BusinessTeamMemberDTO]) {
        var names: [String: String] = [:]
        var options: [InsightsFilterOption] = []
        for member in members {
            guard let user = member.user else { continue }
            let name = user.name ?? user.username ?? "Team member"
            names[user.id] = name
            options.append(InsightsFilterOption(id: user.id, name: name))
        }
        memberNames = names
        memberOptionList = options
    }

    private func mapError(_ error: SchedulingError) -> Phase {
        if case .forbidden = error { return .permissionGated }
        let message = (error.userMessage ?? "").uppercased()
        if message.contains("BUSINESS_ONLY") { return .businessOnly }
        if error.code == "BUSINESS_ONLY" { return .businessOnly }
        if case let .unknown(_, msg) = error, (msg ?? "").uppercased().contains("BUSINESS_ONLY") { return .businessOnly }
        return .error(error.userMessage ?? "Couldn't load team performance.")
    }

    // MARK: Derived

    var hostRows: [HostRow] {
        var rows = InsightsMath.hostRows(hosts: report?.hosts, names: memberNames, sort: sort)
        if !filter.memberIds.isEmpty {
            rows = rows.filter { filter.memberIds.contains($0.id) }
        }
        return rows
    }

    var balanceLabel: String {
        InsightsMath.balanceLabel(hostRows)
    }

    var totalBookings: Int {
        hostRows.reduce(0) { $0 + $1.bookings }
    }

    var isSingleMember: Bool {
        hostRows.count == 1
    }

    var sortLabel: String {
        sort.title
    }

    var memberOptions: [InsightsFilterOption] {
        memberOptionList
    }

    var windowDays: Int {
        report?.windowDays ?? filter.days()
    }
}
