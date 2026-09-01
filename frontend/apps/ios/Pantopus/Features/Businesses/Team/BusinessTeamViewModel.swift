// Owner-side business team and roles roster. Members are sourced from
// businessIam, pending invites from businessSeats, and action gating from /me.

import Foundation
import Observation
import SwiftUI

// MARK: - Projected view models

/// One member row in a role section.
public struct BusinessTeamMemberRow: Identifiable, Sendable, Equatable {
    public let id: String
    public let userId: String
    public let name: String
    public let email: String?
    public let role: BusinessRole
    public let avatarGradient: GradientPair
    public let joinedText: String?
    /// True when the viewer can change/remove this member (gated on
    /// `team.manage` and never true for the owner row).
    public let canManage: Bool
}

/// One role group section (owner → viewer order).
public struct BusinessTeamSection: Identifiable, Sendable, Equatable {
    public let id: String
    public let role: BusinessRole
    public let rows: [BusinessTeamMemberRow]

    public var headerTitle: String {
        role.pluralLabel
    }
}

/// One pending seat-invite row.
public struct BusinessTeamPendingRow: Identifiable, Sendable, Equatable {
    public let id: String
    public let seatId: String
    public let name: String
    public let email: String?
    public let role: BusinessRole
    public let invitedText: String?
    public let canManage: Bool
}

/// Loaded payload for the Team screen.
public struct BusinessTeamContent: Sendable, Equatable {
    public let sections: [BusinessTeamSection]
    public let pending: [BusinessTeamPendingRow]
    public let canManage: Bool
    public let canInvite: Bool
}

/// Render state for the Team screen.
public enum BusinessTeamState: Sendable, Equatable {
    case loading
    case loaded(BusinessTeamContent)
    case empty(canInvite: Bool)
    case error(message: String)
}

// MARK: - View model

@Observable
@MainActor
public final class BusinessTeamViewModel {
    // MARK: Public state

    public private(set) var state: BusinessTeamState = .loading

    /// Assignable role presets for the change-role picker. Populated by
    /// `load()`; empty until then.
    public private(set) var rolePresets: [BusinessRolePresetDTO] = []

    // MARK: Dependencies

    private let businessId: String
    private let api: APIClient
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone

    // MARK: Raw state

    private var access: BusinessTeamAccessDTO?
    private var members: [BusinessTeamMemberDTO] = []
    private var pendingSeats: [BusinessSeatDTO] = []
    private var loadedOnce = false

    init(
        businessId: String,
        api: APIClient = .shared,
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = .current,
        timeZone: TimeZone = .current,
        seed: Seed? = nil
    ) {
        self.businessId = businessId
        self.api = api
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
        if let seed {
            access = seed.access
            members = seed.members
            pendingSeats = seed.pendingSeats
            rolePresets = seed.presets
            loadedOnce = true
            applyState()
        }
    }

    /// Preview/test seed bundle so SwiftUI previews and unit tests can
    /// render the loaded state without a network round-trip.
    public struct Seed: Sendable {
        public let access: BusinessTeamAccessDTO
        public let members: [BusinessTeamMemberDTO]
        public let pendingSeats: [BusinessSeatDTO]
        public let presets: [BusinessRolePresetDTO]

        public init(
            access: BusinessTeamAccessDTO,
            members: [BusinessTeamMemberDTO],
            pendingSeats: [BusinessSeatDTO],
            presets: [BusinessRolePresetDTO]
        ) {
            self.access = access
            self.members = members
            self.pendingSeats = pendingSeats
            self.presets = presets
        }

        /// Owner-as-viewer fixture mirroring `BusinessTeamSampleData`.
        public static let sample = Seed(
            access: BusinessTeamSampleData.access,
            members: BusinessTeamSampleData.members,
            pendingSeats: BusinessTeamSampleData.pendingSeats,
            presets: BusinessTeamSampleData.presets
        )
    }

    // MARK: - Load

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            // Access gate first — a 403 here means the viewer can't see
            // the team at all.
            let access: BusinessTeamAccessDTO = try await api.request(
                BusinessTeamEndpoints.access(businessId: businessId)
            )
            self.access = access
            guard access.hasAccess else {
                state = .error(message: "You don't have access to this team.")
                return
            }

            let memberResponse: BusinessTeamMembersResponse = try await api.request(
                BusinessTeamEndpoints.members(businessId: businessId)
            )
            members = memberResponse.members

            // Pending seats + role presets are best-effort — the screen
            // still renders the roster if either is unavailable.
            pendingSeats = await (try? fetchPendingSeats()) ?? pendingSeats
            if rolePresets.isEmpty {
                rolePresets = await (try? fetchPresets()) ?? []
            }

            loadedOnce = true
            applyState()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your team. Try again."
            )
        }
    }

    private func fetchPendingSeats() async throws -> [BusinessSeatDTO] {
        let response: BusinessSeatsResponse = try await api.request(
            BusinessTeamEndpoints.seats(businessId: businessId)
        )
        return response.seats.filter { ($0.inviteStatus ?? "").lowercased() == "pending" }
    }

    private func fetchPresets() async throws -> [BusinessRolePresetDTO] {
        let response: BusinessRolePresetsResponse = try await api.request(
            BusinessTeamEndpoints.rolePresets(businessId: businessId)
        )
        return response.presets.sorted { $0.sortOrder < $1.sortOrder }
    }

    // MARK: - Gating

    private var canManage: Bool {
        guard let access else { return false }
        return access.isOwner == true || access.permissions.contains("team.manage")
    }

    private var canInvite: Bool {
        guard let access else { return false }
        return access.isOwner == true || access.permissions.contains("team.invite")
    }

    // MARK: - Mutations

    /// Fold a freshly-created seat invite into the pending bucket so the
    /// user sees it without waiting for a refetch.
    public func handleInvited(_ seat: BusinessSeatDTO) {
        pendingSeats.insert(seat, at: 0)
        applyState()
    }

    /// Optimistic role change with rollback. The member's role tier is
    /// updated locally from the chosen preset and the list re-grouped.
    public func changeRole(userId: String, preset: BusinessRolePresetDTO) async {
        let previous = members
        members = members.map { member in
            guard member.user?.id == userId else { return member }
            return BusinessTeamMemberDTO(
                id: member.id,
                roleBase: preset.roleBase,
                title: member.title,
                joinedAt: member.joinedAt,
                invitedAt: member.invitedAt,
                notes: member.notes,
                user: member.user
            )
        }
        applyState()
        do {
            let _: EmptyResponse = try await api.request(
                BusinessTeamEndpoints.changeRole(
                    businessId: businessId,
                    userId: userId,
                    request: BusinessChangeRoleRequest(presetKey: preset.key)
                )
            )
        } catch {
            members = previous
            applyState()
        }
    }

    /// Optimistic member removal with rollback.
    public func remove(userId: String) async {
        let previous = members
        members.removeAll { $0.user?.id == userId }
        applyState()
        do {
            let _: EmptyResponse = try await api.request(
                BusinessTeamEndpoints.removeMember(businessId: businessId, userId: userId)
            )
        } catch {
            members = previous
            applyState()
        }
    }

    /// Optimistic cancel of a pending seat invite with rollback.
    public func cancelInvite(seatId: String) async {
        let previous = pendingSeats
        pendingSeats.removeAll { $0.id == seatId }
        applyState()
        do {
            let _: EmptyResponse = try await api.request(
                BusinessTeamEndpoints.cancelSeat(businessId: businessId, seatId: seatId)
            )
        } catch {
            pendingSeats = previous
            applyState()
        }
    }

    // MARK: - Permissions (Manage permissions sheet)

    /// Fetch the effective permission set for one member.
    public func memberPermissions(userId: String) async -> BusinessPermissionLoadResult {
        do {
            let response: BusinessMemberPermissionsResponse = try await api.request(
                BusinessTeamEndpoints.memberPermissions(businessId: businessId, userId: userId)
            )
            return .success(response.permissions)
        } catch {
            return .failure(
                BusinessPermissionsLoadError(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load permissions."
                )
            )
        }
    }

    /// Toggle one scoped permission for a member. Returns true on success.
    public func togglePermission(userId: String, permission: String, allowed: Bool) async -> Bool {
        do {
            let _: EmptyResponse = try await api.request(
                BusinessTeamEndpoints.togglePermission(
                    businessId: businessId,
                    userId: userId,
                    request: BusinessTogglePermissionRequest(permission: permission, allowed: allowed)
                )
            )
            return true
        } catch {
            return false
        }
    }

    // MARK: - State projection

    private func applyState() {
        let manage = canManage
        let invite = canInvite

        let sections = buildSections(canManage: manage)
        let pending = buildPending(canManage: manage)

        if sections.isEmpty, pending.isEmpty {
            state = .empty(canInvite: invite)
            return
        }
        state = .loaded(
            BusinessTeamContent(
                sections: sections,
                pending: pending,
                canManage: manage,
                canInvite: invite
            )
        )
    }

    private func buildSections(canManage: Bool) -> [BusinessTeamSection] {
        let grouped = Dictionary(grouping: members.filter { $0.user != nil }) {
            BusinessRole.parse($0.roleBase)
        }
        return grouped.keys
            .sorted { $0.rank > $1.rank }
            .compactMap { role -> BusinessTeamSection? in
                guard let bucket = grouped[role], !bucket.isEmpty else { return nil }
                let rows = bucket.map { row(forMember: $0, role: role, canManage: canManage) }
                return BusinessTeamSection(id: role.rawValue, role: role, rows: rows)
            }
    }

    private func buildPending(canManage: Bool) -> [BusinessTeamPendingRow] {
        pendingSeats.map { seat in
            let role = BusinessRole.parse(seat.roleBase)
            let name = seat.displayName?.nilIfBlank ?? seat.inviteEmail?.nilIfBlank ?? "Invited seat"
            return BusinessTeamPendingRow(
                id: seat.id,
                seatId: seat.id,
                name: name,
                email: seat.inviteEmail,
                role: role,
                invitedText: invitedText(for: seat),
                canManage: canManage
            )
        }
    }

    private func row(
        forMember member: BusinessTeamMemberDTO,
        role: BusinessRole,
        canManage: Bool
    ) -> BusinessTeamMemberRow {
        let user = member.user
        let userId = user?.id ?? member.id
        let name = Self.displayName(for: member)
        return BusinessTeamMemberRow(
            id: userId,
            userId: userId,
            name: name,
            email: user?.email,
            role: role,
            avatarGradient: BusinessTeamAvatarTone.tone(for: userId).gradient,
            joinedText: joinedText(for: member),
            canManage: canManage && role != .owner
        )
    }

    // MARK: - Helpers (pure)

    static func displayName(for member: BusinessTeamMemberDTO) -> String {
        BusinessTeamProjection.displayName(for: member)
    }

    private func joinedText(for member: BusinessTeamMemberDTO) -> String? {
        let raw = member.joinedAt ?? member.invitedAt
        guard let relative = Self.formatRelativeTime(
            raw,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) else {
            return nil
        }
        return "Joined \(relative)"
    }

    private func invitedText(for seat: BusinessSeatDTO) -> String? {
        guard let relative = Self.formatRelativeTime(
            seat.createdAt,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) else {
            return nil
        }
        return "Invited \(relative)"
    }

    public static func formatRelativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> String? {
        BusinessTeamDateFormatter.formatRelativeTime(
            raw,
            now: now,
            calendar: calendar,
            timeZone: timeZone
        )
    }
}

public struct BusinessPermissionsLoadError: Error, Sendable, Equatable {
    public let message: String
}

public typealias BusinessPermissionLoadResult = Result<[String], BusinessPermissionsLoadError>

private enum BusinessTeamProjection {
    static func displayName(for member: BusinessTeamMemberDTO) -> String {
        if let name = member.user?.name?.nilIfBlank { return name }
        if let username = member.user?.username?.nilIfBlank { return "@\(username)" }
        if let email = member.user?.email?.nilIfBlank { return email }
        return "Team member"
    }
}

private enum BusinessTeamDateFormatter {
    static func formatRelativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        var cal = calendar
        cal.timeZone = timeZone
        let startOfNow = cal.startOfDay(for: now)
        let startOfDate = cal.startOfDay(for: date)
        let dayDelta = cal.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        if dayDelta == 1 { return "yesterday" }
        if dayDelta < 7 { return "\(dayDelta)d ago" }
        if dayDelta < 30 { return "\(dayDelta / 7)w ago" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso8601 = ISO8601DateFormatter()
        iso8601.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso8601NoFraction = ISO8601DateFormatter()
        iso8601NoFraction.formatOptions = [.withInternetDateTime]
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : self
    }
}
