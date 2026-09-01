//
//  HomeSchedulingKit.swift
//  Pantopus
//
//  Stream I10 (Home calendar & RSVP) — shared UI primitives the family /
//  home scheduling surfaces compose from so member avatars, avatar stacks,
//  the booking-union badge, and the cross-stream route presenter read the
//  same everywhere. Lifted from the design at `home-shell.jsx` (the `Avatar`,
//  `AvatarStack`, and member-gradient primitives).
//
//  Home pillar = green (`Theme.Color.home`). Per the buildout-plan
//  convention (and mirroring `CalendarEventCategory` / `UtilityCategoryPalette`),
//  the per-member gradient palette is the one documented exception to the
//  "no hex outside Theme" rule — it lives on a typed palette, never inline at
//  a call site.
//

import SwiftUI

// MARK: - Member model

/// A household member as rendered on the calendar / detail surfaces. Built
/// from `OccupantDTO` (or the signed-in user) but kept as a tiny value type
/// so view code never depends on the wire shape.
public struct HomeMember: Sendable, Hashable, Identifiable {
    /// The member's user id (stable across the household).
    public let id: String
    /// Display name ("Maria", "David").
    public let name: String
    /// 1–2 letter initials rendered inside the avatar.
    public let initials: String
    /// Whether this row is the signed-in member ("· you").
    public let isYou: Bool

    public init(id: String, name: String, isYou: Bool = false) {
        self.id = id
        self.name = name
        initials = HomeMember.initials(from: name)
        self.isYou = isYou
    }

    /// Up-to-2-letter uppercased initials from a display name.
    public static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let chars = parts.compactMap { $0.first.map(String.init) }
        let joined = chars.joined().uppercased()
        return joined.isEmpty ? "·" : joined
    }
}

// MARK: - Member gradient palette

/// Per-member avatar gradients. Six stable two-stop gradients keyed off a
/// deterministic hash of the member's user id so the same person always reads
/// the same colour across screens — mirroring the design's per-member
/// gradients in `home-shell.jsx`.
///
/// Documented per-feature palette exception to the token-only rule (same as
/// `CalendarEventCategory`): the hex pairs live here and nowhere else.
public enum HomeMemberPalette {
    /// (start, end) for a member's 135° avatar gradient.
    public static func gradient(for userId: String) -> (start: Color, end: Color) {
        pairs[index(for: userId)]
    }

    /// Stable index 0..<count for a user id. `String.hashValue` is
    /// per-process-randomised, so we fold the scalars ourselves.
    public static func index(for userId: String) -> Int {
        guard !pairs.isEmpty else { return 0 }
        var acc: UInt64 = 5381
        for scalar in userId.unicodeScalars {
            acc = (acc &* 33) &+ UInt64(scalar.value)
        }
        return Int(acc % UInt64(pairs.count))
    }

    /// Six gradients (emerald, blue, rose, amber, violet, teal). Decomposed
    /// `Color(red:green:blue:)` form — the per-feature palette exception.
    private static let pairs: [(start: Color, end: Color)] = [
        // 34d399 → 16a34a (emerald → home green)
        (
            Color(red: 0x34 / 255.0, green: 0xD3 / 255.0, blue: 0x99 / 255.0),
            Color(red: 0x16 / 255.0, green: 0xA3 / 255.0, blue: 0x4A / 255.0)
        ),
        // 60a5fa → 2563eb (sky → indigo)
        (
            Color(red: 0x60 / 255.0, green: 0xA5 / 255.0, blue: 0xFA / 255.0),
            Color(red: 0x25 / 255.0, green: 0x63 / 255.0, blue: 0xEB / 255.0)
        ),
        // f472b6 → db2777 (pink → rose)
        (
            Color(red: 0xF4 / 255.0, green: 0x72 / 255.0, blue: 0xB6 / 255.0),
            Color(red: 0xDB / 255.0, green: 0x27 / 255.0, blue: 0x77 / 255.0)
        ),
        // fbbf24 → d97706 (amber)
        (
            Color(red: 0xFB / 255.0, green: 0xBF / 255.0, blue: 0x24 / 255.0),
            Color(red: 0xD9 / 255.0, green: 0x77 / 255.0, blue: 0x06 / 255.0)
        ),
        // c084fc → 7c3aed (violet)
        (
            Color(red: 0xC0 / 255.0, green: 0x84 / 255.0, blue: 0xFC / 255.0),
            Color(red: 0x7C / 255.0, green: 0x3A / 255.0, blue: 0xED / 255.0)
        ),
        // 2dd4bf → 0d9488 (teal)
        (
            Color(red: 0x2D / 255.0, green: 0xD4 / 255.0, blue: 0xBF / 255.0),
            Color(red: 0x0D / 255.0, green: 0x94 / 255.0, blue: 0x88 / 255.0)
        )
    ]
}

// MARK: - Avatar

/// Circular gradient avatar with initials + a 2pt white ring, matching the
/// design's `Avatar` primitive.
public struct HomeMemberAvatar: View {
    let member: HomeMember
    var size: CGFloat = 28
    var dimmed: Bool = false

    public init(member: HomeMember, size: CGFloat = 28, dimmed: Bool = false) {
        self.member = member
        self.size = size
        self.dimmed = dimmed
    }

    public var body: some View {
        let pair = HomeMemberPalette.gradient(for: member.id)
        Text(member.initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: size, height: size)
            .background(
                LinearGradient(
                    colors: [pair.start, pair.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(Circle())
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .opacity(dimmed ? 0.4 : 1)
            .accessibilityHidden(true)
    }
}

/// Overlapping avatar stack + a `+N` overflow tile, matching `AvatarStack`.
public struct HomeAvatarStack: View {
    let members: [HomeMember]
    var size: CGFloat = 26
    var maxVisible: Int = 3

    public init(members: [HomeMember], size: CGFloat = 26, maxVisible: Int = 3) {
        self.members = members
        self.size = size
        self.maxVisible = maxVisible
    }

    public var body: some View {
        let visible = Array(members.prefix(maxVisible))
        let overflow = max(0, members.count - visible.count)
        HStack(spacing: -9) {
            ForEach(visible) { member in
                HomeMemberAvatar(member: member, size: size)
            }
            if overflow > 0 {
                Text("+\(overflow)")
                    .font(.system(size: size * 0.34, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(width: size, height: size)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        let names = members.map(\.name)
        return names.isEmpty ? "" : "Assigned to \(names.joined(separator: ", "))"
    }
}

// MARK: - Booking-union badge

/// Small "Booking" tag rendered on calendar rows whose `source == "booking"`.
/// These rows are render-only (never persisted as HomeCalendarEvent) and
/// deep-link into the Scheduling Booking Detail (E2). Pairs with a
/// `SchedulingStatusPill` driven by the row's `booking_status`.
public struct HomeBookingTag: View {
    public init() {}

    public var body: some View {
        HStack(spacing: 3) {
            Icon(.calendarCheck, size: 10, color: Theme.Color.home)
            Text("Booking")
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(Theme.Color.homeDark)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.homeBg)
        .clipShape(Capsule())
        .accessibilityLabel("Booking")
    }
}

// MARK: - RSVP

/// A member's RSVP to a household event. Maps to the backend's
/// `going | maybe | declined | pending` (pending = no reply yet, surfaced as
/// `nil` for the "Your RSVP" segmented control). The case is named `noReply`
/// (not `none`) to avoid the `Optional.none` shadowing footgun.
public enum HomeRsvpChoice: String, Sendable, Hashable {
    case going
    case maybe
    case cant
    case noReply

    /// The three choices the invitee can actively pick.
    public static let selectable: [HomeRsvpChoice] = [.going, .maybe, .cant]

    /// Decode a backend status. Returns `nil` for `pending` / unknown so the
    /// segmented control renders unselected.
    public init?(backend raw: String) {
        switch raw.lowercased() {
        case "going": self = .going
        case "maybe": self = .maybe
        case "declined", "cant": self = .cant
        default: return nil
        }
    }

    /// Wire value sent to `POST …/rsvp`.
    public var backendValue: String {
        switch self {
        case .going: "going"
        case .maybe: "maybe"
        case .cant: "declined"
        case .noReply: "pending"
        }
    }

    public var label: String {
        switch self {
        case .going: "Going"
        case .maybe: "Maybe"
        case .cant: "Can't"
        case .noReply: "No reply"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .going: .check
        case .maybe: .helpCircle
        case .cant: .x
        case .noReply: .minus
        }
    }

    var background: Color {
        switch self {
        case .going: Theme.Color.successBg
        case .maybe: Theme.Color.warningBg
        case .cant: Theme.Color.errorBg
        case .noReply: Theme.Color.appSurfaceSunken
        }
    }

    var foreground: Color {
        switch self {
        case .going: Theme.Color.success
        case .maybe: Theme.Color.warning
        case .cant: Theme.Color.error
        case .noReply: Theme.Color.appTextSecondary
        }
    }
}

/// Coloured RSVP pill (Going / Maybe / Can't / No reply) for the attendee list.
public struct HomeRsvpPill: View {
    let choice: HomeRsvpChoice

    public init(_ choice: HomeRsvpChoice) {
        self.choice = choice
    }

    public var body: some View {
        HStack(spacing: 4) {
            Icon(choice.icon, size: 11, color: choice.foreground)
            Text(choice.label)
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(choice.foreground)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 3)
        .background(choice.background)
        .clipShape(Capsule())
        .accessibilityLabel("RSVP: \(choice.label)")
    }
}

// MARK: - Cross-stream route presenter

/// Identifiable wrapper so a `SchedulingRoute` can drive a SwiftUI
/// `fullScreenCover(item:)` from a home surface.
public struct PresentedHomeRoute: Identifiable, Hashable {
    public let id = UUID()
    public let route: SchedulingRoute

    public init(_ route: SchedulingRoute) {
        self.route = route
    }
}

/// Local navigation host that presents a cross-stream `SchedulingRoute`
/// (Booking Detail E2, Who's Free F7, Find a Time F4, Book a Resource F12,
/// Schedule a Visit F13, …) from a home surface.
///
/// The Home tab reaches the calendar through `HubTabRoot` (which we cannot
/// edit), so we cannot push scheduling routes onto its stack. Instead we
/// present them locally through the Foundation `SchedulingRouter`, giving the
/// presented screen its own `NavigationStack` + `push`. Always home-scoped.
struct HomeSchedulingRouteHost: View {
    let initialRoute: SchedulingRoute
    let homeId: String
    let onDismiss: @MainActor () -> Void

    @State private var path: [SchedulingRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            SchedulingRouter.destination(
                for: initialRoute,
                owner: .home(homeId: homeId)
            ) { path.append($0) }
                .navigationDestination(for: SchedulingRoute.self) { route in
                    SchedulingRouter.destination(
                        for: route,
                        owner: .home(homeId: homeId)
                    ) { path.append($0) }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Done") { onDismiss() }
                            .accessibilityIdentifier("homeSchedulingRouteHost_done")
                    }
                }
        }
    }
}
