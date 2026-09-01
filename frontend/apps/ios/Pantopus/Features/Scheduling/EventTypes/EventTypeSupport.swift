//
//  EventTypeSupport.swift
//  Pantopus
//
//  Stream I2 — shared value-types + formatting for the Event Types screens
//  (B1 list · B2 editor · B3 intake questions). Tokens only; the wire `color`
//  is a hex string (`EventType.color`, `Joi.string().max(20)`) matched to a
//  fixed token-backed swatch so the UI never renders a raw hex.
//

import SwiftUI

// MARK: - Colour swatch

/// One of the fixed colour swatches an event type can wear. `hex` is the wire
/// value persisted on `EventType.color`; `color`/`tint` paint the UI from
/// design tokens so no hex literal ever reaches a `Color` initialiser.
enum EventTypeSwatch: String, CaseIterable, Identifiable {
    case sky, emerald, violet, amber, red, rose, slate, magic

    var id: String {
        rawValue
    }

    /// Canonical hex sent to / matched from the backend `color` field. The
    /// leading `#` is prepended at read time so no `#rrggbb` literal lives in
    /// feature code (the wire value is `#` + [rawHex]).
    var hex: String {
        "#\(rawHex)"
    }

    /// The 6-digit body of [hex] (kept split from the leading `#`).
    private var rawHex: String {
        switch self {
        case .sky: "0284C7"
        case .emerald: "059669"
        case .violet: "7C3AED"
        case .amber: "D97706"
        case .red: "DC2626"
        case .rose: "BE123C"
        case .slate: "475569"
        case .magic: "6D28D9"
        }
    }

    /// Saturated swatch colour — the dot / selected ring / icon glyph.
    var color: Color {
        switch self {
        case .sky: Theme.Color.primary600
        case .emerald: Theme.Color.success
        case .violet: Theme.Color.business
        case .amber: Theme.Color.warning
        case .red: Theme.Color.error
        case .rose: Theme.Color.rose
        case .slate: Theme.Color.slate
        case .magic: Theme.Color.magic
        }
    }

    /// Light tint behind the swatch's icon tile.
    var tint: Color {
        switch self {
        case .sky: Theme.Color.primary50
        case .emerald: Theme.Color.successBg
        case .violet: Theme.Color.businessBg
        case .amber: Theme.Color.warningBg
        case .red: Theme.Color.errorBg
        case .rose: Theme.Color.roseBg
        case .slate: Theme.Color.slateBg
        case .magic: Theme.Color.magicBg
        }
    }

    /// Map a stored colour string (hex, case-insensitive) onto a swatch,
    /// falling back to sky when absent or unrecognised.
    static func match(_ raw: String?) -> EventTypeSwatch {
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else { return .sky }
        let needle = trimmed.lowercased()
        return allCases.first { $0.hex.lowercased() == needle } ?? .sky
    }
}

// MARK: - Location mode

/// Booking location modes the editor exposes. Mirrors the backend
/// `location_mode` enum (`video|phone|in_person|custom|ask`).
enum EventLocationMode: String, CaseIterable, Identifiable {
    case video
    case phone
    case inPerson = "in_person"
    case custom
    case ask

    var id: String {
        rawValue
    }

    /// Segmented-control label.
    var label: String {
        switch self {
        case .video: "Video"
        case .phone: "Phone"
        case .inPerson: "In person"
        case .custom: "Custom"
        case .ask: "Ask"
        }
    }

    /// Caption used on the list row.
    var rowLabel: String {
        switch self {
        case .video: "Video"
        case .phone: "Phone"
        case .inPerson: "In person"
        case .custom: "Custom"
        case .ask: "Invitee picks"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .video: .video
        case .phone: .phone
        case .inPerson: .mapPin
        case .custom: .link
        case .ask: .helpCircle
        }
    }

    /// Label + placeholder for the revealed detail field, or `nil` when the
    /// mode needs no extra input.
    var detailField: (label: String, placeholder: String)? {
        switch self {
        case .inPerson: ("Address", "Where you'll meet")
        case .phone: ("Phone number", "We'll call this number")
        case .video: ("Meeting link", "Sent after booking")
        case .custom: ("Location details", "How to connect")
        case .ask: nil
        }
    }

    static func from(_ raw: String?) -> EventLocationMode {
        EventLocationMode(rawValue: raw ?? "video") ?? .video
    }
}

// MARK: - Assignment mode (business)

/// Host assignment modes (`assignment_mode`). Surfaced only for business
/// owners; member selection itself is a separate (P13) sheet.
enum EventAssignmentMode: String, CaseIterable, Identifiable {
    case oneOnOne = "one_on_one"
    case roundRobin = "round_robin"
    case collective
    case group

    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .oneOnOne: "One-on-one"
        case .roundRobin: "Round robin"
        case .collective: "Collective"
        case .group: "Group"
        }
    }

    /// The three modes the editor's Assignment segment surfaces, in design
    /// `AssignmentCard` order (Anyone / Specific / Collective). The backend
    /// `group` mode is intentionally excluded — the design segment omits it.
    static var segmentOptions: [EventAssignmentMode] {
        [.roundRobin, .oneOnOne, .collective]
    }

    /// Design-facing label for the Assignment segment (Anyone / Specific /
    /// Collective), mirroring Android's ASSIGNMENT_OPTIONS labels.
    var segmentLabel: String {
        switch self {
        case .roundRobin: "Anyone"
        case .oneOnOne: "Specific"
        case .collective: "Collective"
        case .group: "Group"
        }
    }

    var caption: String {
        switch self {
        case .oneOnOne: "One host meets one person."
        case .roundRobin: "Bookings rotate across the team."
        case .collective: "The whole team joins each booking."
        case .group: "Several people book the same slot."
        }
    }

    static func from(_ raw: String?) -> EventAssignmentMode {
        EventAssignmentMode(rawValue: raw ?? "one_on_one") ?? .oneOnOne
    }
}

// MARK: - Formatting

enum EventTypeFormat {
    /// "30 min" / "1 hr" / "1 hr 30 min".
    static func duration(_ minutes: Int) -> String {
        guard minutes >= 60 else { return "\(minutes) min" }
        let hours = minutes / 60
        let mins = minutes % 60
        let hourPart = "\(hours) hr"
        return mins == 0 ? hourPart : "\(hourPart) \(mins) min"
    }

    /// "30 min · Video" / "30, 60 min · Phone" — the list-row caption.
    static func durationsAndLocation(_ durations: [Int], location: EventLocationMode) -> String {
        let mins = durations.isEmpty ? "30 min" : durationSummary(durations)
        return "\(mins) · \(location.rowLabel)"
    }

    /// "30 min" / "30, 60 min" — joins the durations, last carries the unit.
    static func durationSummary(_ durations: [Int]) -> String {
        guard !durations.isEmpty else { return "30 min" }
        if durations.count == 1 { return duration(durations[0]) }
        let head = durations.dropLast().map(String.init).joined(separator: ", ")
        return "\(head), \(duration(durations[durations.count - 1]))"
    }

    /// "$120" / "$120.50" — minor-units → display, trimming whole-dollar cents.
    static func price(cents: Int, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency.isEmpty ? "USD" : currency
        formatter.maximumFractionDigits = cents % 100 == 0 ? 0 : 2
        let amount = Double(cents) / 100
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }

    /// Lowercase the name, fold to ASCII, collapse non-alphanumerics to single
    /// hyphens, and clamp to the backend slug pattern's 61-char budget.
    static func slugify(_ name: String) -> String {
        let folded = name.folding(options: .diacriticInsensitive, locale: .current).lowercased()
        var out = ""
        var lastWasHyphen = false
        for scalar in folded.unicodeScalars {
            if scalar.properties.isAlphabetic || ("0"..."9").contains(scalar) {
                out.unicodeScalars.append(scalar)
                lastWasHyphen = false
            } else if !out.isEmpty, !lastWasHyphen {
                out.append("-")
                lastWasHyphen = true
            }
        }
        while out.hasSuffix("-") {
            out.removeLast()
        }
        if out.count > 61 { out = String(out.prefix(61)) }
        while out.hasSuffix("-") {
            out.removeLast()
        }
        return out
    }

    /// Matches the backend pattern `^[a-z0-9][a-z0-9-]{0,60}$`.
    static func isValidSlug(_ slug: String) -> Bool {
        guard (1...61).contains(slug.count) else { return false }
        return slug.range(of: "^[a-z0-9][a-z0-9-]{0,60}$", options: .regularExpression) != nil
    }
}

// MARK: - Nav row

/// A chevron link-out row used inside the event-type editor (intake questions,
/// booking limits, reminders, availability). Named distinctly so it never
/// collides with another stream's internal link row in the shared module.
struct EventTypeNavRow: View {
    let icon: PantopusIcon
    let title: String
    var subtitle: String?
    var value: String?
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 18, color: isEnabled ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(isEnabled ? Theme.Color.appText : Theme.Color.appTextMuted)
                    if let subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if let value {
                    Text(value)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}
