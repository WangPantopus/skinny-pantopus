//
//  FindATimeModels.swift
//  Pantopus
//
//  Stream I11 — Find-a-time & who's-free (home). Shared value types, the
//  F4 → F5 navigation draft hand-off, home-member resolution from occupants,
//  and slot/label formatting used across F4/F5/F6/F7. Home-only (green
//  pillar); every host call is owner-scoped via `SchedulingOwner.home`.
//  See `reference/calendarly-backend-api.md`.
//

import Foundation

// MARK: - Mode

/// Find-a-time engine mode. `collective` = everyone required free at once;
/// `roundRobin` = whoever's free can cover. Maps to the `mode` body field on
/// `POST /find-a-time`.
enum FindATimeMode: String, Hashable, CaseIterable {
    case collective
    case roundRobin = "round_robin"

    var title: String {
        switch self {
        case .collective: "Collective"
        case .roundRobin: "Round-robin"
        }
    }

    var caption: String {
        switch self {
        case .collective: "Everyone free"
        case .roundRobin: "One covers"
        }
    }

    var explainer: String {
        switch self {
        case .collective: "Finds times when everyone required is free at once."
        case .roundRobin: "Whoever's free gets it. Pick a rule for who covers."
        }
    }

    /// The wire value sent to `POST /find-a-time` (`mode`).
    var wireValue: String {
        rawValue
    }
}

/// Round-robin coverage rule — a setup affordance (F4). The backend
/// `find-a-time` engine takes only `mode`, so this is recorded for the proposal
/// copy but not sent on the slot read.
enum RoundRobinRule: String, Hashable, CaseIterable {
    case fairRotation
    case byRole

    var title: String {
        switch self {
        case .fairRotation: "Fair rotation"
        case .byRole: "By role"
        }
    }
}

// MARK: - Member

/// A home member resolved from `GET /occupants` for the who's-needed picker,
/// the availability grid, and the suggested-slot dots. Avatar colour is
/// derived deterministically from the user id (token-based gradient), since the
/// scheduling reads return only bare member UUIDs.
struct FindATimeMember: Identifiable, Hashable {
    let id: String
    let displayName: String
    let initials: String

    var tone: MemberAvatarTone {
        MemberAvatarTone.tone(for: id)
    }

    /// Build from a home occupant row; falls back display name → `@username`
    /// → "Member".
    init(occupant: OccupantDTO) {
        id = occupant.userId
        let name = FindATimeMember.resolveName(occupant)
        displayName = name
        initials = FindATimeMember.initials(from: name)
    }

    init(id: String, displayName: String, initials: String) {
        self.id = id
        self.displayName = displayName
        self.initials = initials
    }

    private static func resolveName(_ occ: OccupantDTO) -> String {
        if let raw = occ.displayName?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty {
            return raw
        }
        if let user = occ.username?.trimmingCharacters(in: .whitespacesAndNewlines), !user.isEmpty {
            return "@\(user)"
        }
        return "Member"
    }

    static func initials(from name: String) -> String {
        let cleaned = name.hasPrefix("@") ? String(name.dropFirst()) : name
        let parts = cleaned.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init)
        let joined = letters.joined().uppercased()
        return joined.isEmpty ? "?" : joined
    }
}

/// Whether a member must be free (counts in the overlap) or is excluded from
/// the requirement. "Optional" members are dropped from `member_ids` so making
/// someone optional relaxes the constraint (the F4 no-overlap recovery).
enum FindATimeRequirement: String, Hashable {
    case required
    case optional
}

/// A who's-needed picker row: a member + its current requirement.
struct FindATimePickRow: Identifiable, Hashable {
    let member: FindATimeMember
    var requirement: FindATimeRequirement

    var id: String {
        member.id
    }
}

// MARK: - Draft (F4 → F5 hand-off)

/// The find-a-time request the setup screen (F4) composes and hands to the
/// suggested-times screen (F5). The frozen `findATimeSuggested(homeId, tz)`
/// route can't carry rich params, so F4 stashes this in `FindATimeDraftStore`
/// before navigating; F5 reads it (and falls back to defaults if absent, e.g.
/// when entered directly).
struct FindATimeDraft: Hashable {
    let homeId: String
    let title: String
    /// Members shown as dots in F5 — the required set considered.
    let members: [FindATimeMember]
    /// `member_ids` sent to `POST /find-a-time` (the required members).
    let requiredMemberIds: [String]
    let mode: FindATimeMode
    let durationMin: Int
    /// ISO day (`yyyy-MM-dd`, UTC) window.
    let from: String
    let to: String
    let tz: String
    /// Slots F4 already computed — F5 displays these without re-fetching.
    var precomputedSlots: [SlotDTO]?

    /// Build the typed request body for `POST /find-a-time`.
    var request: FindATimeRequest {
        FindATimeRequest(
            memberIds: requiredMemberIds,
            from: from,
            to: to,
            mode: mode.wireValue,
            durationMin: durationMin,
            timezone: tz
        )
    }
}

/// Main-actor hand-off slot for the F4 → F5 draft. Used only at the routing
/// seam; view-models receive the draft by value so they stay testable.
enum FindATimeDraftStore {
    @MainActor static var draft: FindATimeDraft?
}

// MARK: - Suggested slot (F5)

/// A find-a-time result row decorated for display: the raw slot plus the
/// free/busy split across the considered members.
struct SuggestedSlot: Identifiable, Hashable {
    let slot: SlotDTO
    /// Members considered (the required set), in display order.
    let members: [FindATimeMember]
    /// Member ids free for this slot (`eligibleHosts`).
    let freeMemberIds: Set<String>

    var id: String {
        slot.start
    }

    var freeCount: Int {
        members.filter { freeMemberIds.contains($0.id) }.count
    }

    var totalCount: Int {
        members.count
    }

    var allFree: Bool {
        totalCount > 0 && freeCount == totalCount
    }

    /// "All 3 free" / "2 of 3 free".
    var coverageLabel: String {
        allFree ? "All \(totalCount) free" : "\(freeCount) of \(totalCount) free"
    }

    /// The lone covering member when exactly one is free (round-robin assignee).
    var soleCovererName: String? {
        guard freeCount == 1, let covered = members.first(where: { freeMemberIds.contains($0.id) }) else {
            return nil
        }
        return covered.displayName
    }
}

// MARK: - Formatting

/// Slot label formatting. Always renders from the UTC instant in the requested
/// IANA tz (we store/compare UTC, render local), so labels match the wiring
/// contract regardless of the device zone.
enum FindATimeFormat {
    /// "Sun Jun 22"
    static func dayLabel(utcISO: String, tz: String) -> String {
        format(utcISO: utcISO, tz: tz, pattern: "EEE MMM d")
    }

    /// "2:00 PM"
    static func timeLabel(utcISO: String, tz: String) -> String {
        format(utcISO: utcISO, tz: tz, pattern: "h:mm a")
    }

    /// "Sun Jun 22 · 2:00 PM"
    static func dayTimeLabel(utcISO: String, tz: String) -> String {
        "\(dayLabel(utcISO: utcISO, tz: tz)) · \(timeLabel(utcISO: utcISO, tz: tz))"
    }

    /// "2:00 PM" → "6:00 PM" range across a slot.
    static func timeRangeLabel(startUTC: String, endUTC: String, tz: String) -> String {
        "\(timeLabel(utcISO: startUTC, tz: tz)) – \(timeLabel(utcISO: endUTC, tz: tz))"
    }

    private static func format(utcISO: String, tz: String, pattern: String) -> String {
        guard let date = SchedulingTime.parseUTC(utcISO) else { return utcISO }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: tz) ?? .current
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}
