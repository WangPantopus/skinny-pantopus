//
//  PulsePostStatus.swift
//  Pantopus
//
//  How a Pulse post ended, or when a Heads-up ends, in words (Pulse S7;
//  build spec §3–4, contract §1 and §5): "✓ Answered", "Gone", "Reunited",
//  "Happened · 14 went", "Ends Wed 4pm". Read from the post's `resolution`,
//  `state` and `expires_at`, which older servers leave out. A post that was
//  closed, closed unanswered or expired has left the views and gets no word;
//  so does a resolution this build doesn't know (Pulse S2). Same words on
//  Android (agreed with PA, `docs/product/pulse-build/status/PI.md`).
//

import SwiftUI

/// The status word a post shows, if any.
public enum PulsePostStatus: Sendable, Hashable {
    /// An Ask the asker marked Helpful (or solved).
    case answered
    /// An Offer the giver gave away.
    case gone
    /// Lost and found, back with its owner.
    case reunited
    /// An Event that took place, with how many went.
    case happened(went: Int)
    /// An open Heads-up with the time it names, in the viewer's zone.
    case ends(at: Date)

    /// The words on the pill. "✓" is drawn as an icon, so `answered` reads
    /// "Answered" here (and to VoiceOver).
    public var text: String {
        switch self {
        case .answered: "Answered"
        case .gone: "Gone"
        case .reunited: "Reunited"
        case let .happened(went): "Happened · \(went) went"
        case let .ends(at): "Ends \(Self.endsFormat(at))"
        }
    }

    /// Answered carries the check mark the build spec writes as "✓"; a
    /// Heads-up's end, a clock. The words carry the meaning either way.
    public var icon: PantopusIcon? {
        switch self {
        case .answered: .checkCircle
        case .ends: .clock
        default: nil
        }
    }

    /// The status of a post, from what the server sent.
    /// - Parameters:
    ///   - resolution: `answered`, `closed`, `closed_unanswered`, `claimed`, `expired`, `happened`, `reunited`, or nil while open.
    ///   - state: the older `state` (`open`, `solved`, `archived`), for rows from before `resolution`.
    ///   - postType: the stored `post_type`.
    ///   - goingCount: an Event's going count (its like count today).
    ///   - expiresAt: ISO 8601 time the post ends, when it names one.
    public static func from(
        resolution: String?,
        state: String?,
        postType: String?,
        goingCount: Int,
        expiresAt: String?,
        now: Date = Date()
    ) -> PulsePostStatus? {
        switch resolution {
        case "answered": return .answered
        case "claimed": return .gone
        case "reunited": return .reunited
        case "happened": return .happened(went: max(0, goingCount))
        case nil: break
        default: return nil
        }
        // Rows from before `resolution`: a solved Ask was an answered one.
        if state == "solved" { return .answered }
        guard state == nil || state == "open", postType == "alert",
              let expiresAt, let end = parseDate(expiresAt), end > now else { return nil }
        return .ends(at: end)
    }

    /// An Ask its asker can still keep open or close (contract §2.12): open,
    /// not answered or closed, and inside its window (`expires_at`, or 7 days
    /// from posting on rows without one). The server has the last word.
    public static func askIsOpen(
        postType: String?,
        state: String?,
        resolution: String?,
        expiresAt: String?,
        createdAt: String,
        now: Date = Date()
    ) -> Bool {
        guard postType == "ask_local", resolution == nil, state == nil || state == "open" else { return false }
        if let expiresAt, let end = parseDate(expiresAt) { return end > now }
        guard let posted = parseDate(createdAt) else { return false }
        return posted.addingTimeInterval(askWindowDays * 24 * 3600) > now
    }

    /// An Ask's window without an `expires_at` (build spec §4, the default).
    private static let askWindowDays: Double = 7

    /// "Wed 4pm", "Wed 4:30pm" in the viewer's time zone.
    static func endsFormat(_ date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.weekday, .hour, .minute], from: date)
        let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let weekday = weekdays[((parts.weekday ?? 1) - 1 + 7) % 7]
        let hour24 = parts.hour ?? 0
        let minute = parts.minute ?? 0
        let hour12 = hour24 % 12 == 0 ? 12 : hour24 % 12
        let suffix = hour24 < 12 ? "am" : "pm"
        let time = minute == 0 ? "\(hour12)\(suffix)" : String(format: "%d:%02d%@", hour12, minute, suffix)
        return "\(weekday) \(time)"
    }

    private static func parseDate(_ text: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }
}

/// The status word as a pill, on the feed card and the post page. The words
/// always carry the meaning; the check mark and the color only repeat it.
struct PulsePostStatusPill: View {
    let status: PulsePostStatus
    let postId: String
    /// The icon grows with the words (`footnoteStrong`).
    @ScaledMetric(relativeTo: .footnote) private var iconSize: CGFloat = 12

    private var foreground: Color {
        status == .answered ? Theme.Color.success : Theme.Color.appTextSecondary
    }

    private var background: Color {
        status == .answered ? Theme.Color.successLight : Theme.Color.appSurfaceSunken
    }

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon = status.icon {
                Icon(icon, size: iconSize, strokeWidth: 2.4, color: foreground)
                    .accessibilityHidden(true)
            }
            Text(status.text)
                .pulseFont(.footnoteStrong)
                .foregroundStyle(foreground)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(background)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(status.text)
        .accessibilityIdentifier("pulsePostStatus_\(postId)")
    }
}
