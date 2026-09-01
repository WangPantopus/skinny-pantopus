//
//  EdgeSupport.swift
//  Pantopus
//
//  Stream I7 (Invitee edge & customer) — shared helpers for the edge surfaces
//  (D5–D12): tz-aware date/time formatting (render the backend instant in the
//  invitee's zone, store/compare UTC), the host-pillar accent from a page
//  `owner_type` wire string, money formatting, and the system share hand-off
//  used to save a downloaded `.ics` (D8). Owner context, DTOs, endpoints and the
//  Foundation SharedUI are consumed read-only. Tokens only — no hardcoded
//  colors/spacing.
//

import SwiftUI
import UIKit

// MARK: - tz-aware formatting

/// Calendarly's wiring contract: ALWAYS pass `tz`, render the localized instant,
/// store/compare UTC. These helpers turn a UTC ISO string + IANA zone into the
/// friendly strings the edge designs show ("Wed, Jun 17 · 9:30–10:00 AM").
enum EdgeFormat {
    /// A `DateFormatter` configured for `tz` with the US-style template the
    /// designs use. Created per call (cheap, and avoids shared mutable state
    /// under strict concurrency).
    private static func formatter(tz: String, template: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(identifier: tz) ?? .current
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }

    /// `9:30 AM` — time of day in `tz`.
    static func time(_ utcISO: String?, tz: String) -> String? {
        guard let utcISO, let date = SchedulingTime.parseUTC(utcISO) else { return nil }
        return formatter(tz: tz, template: "jmm").string(from: date)
    }

    /// `Wed, Jun 17` — weekday + month + day in `tz`.
    static func weekdayDate(_ utcISO: String?, tz: String) -> String? {
        guard let utcISO, let date = SchedulingTime.parseUTC(utcISO) else { return nil }
        return formatter(tz: tz, template: "EEEMMMd").string(from: date)
    }

    /// `Jun 16 at 9:30 AM` — a policy deadline ("free cancellation ended …").
    static func deadline(_ utcISO: String?, tz: String) -> String? {
        guard let utcISO, let date = SchedulingTime.parseUTC(utcISO) else { return nil }
        let day = formatter(tz: tz, template: "MMMd").string(from: date)
        let clock = formatter(tz: tz, template: "jmm").string(from: date)
        return "\(day) at \(clock)"
    }

    /// `9:30–10:00 AM` — a start–end range in `tz`, merging the meridiem when the
    /// two ends share it (the design's tabular range styling).
    static func timeRange(startUTC: String?, endUTC: String?, tz: String) -> String? {
        guard let startUTC, let start = SchedulingTime.parseUTC(startUTC) else { return nil }
        let startClock = formatter(tz: tz, template: "jmm").string(from: start)
        guard let endUTC, let end = SchedulingTime.parseUTC(endUTC) else { return startClock }
        let endClock = formatter(tz: tz, template: "jmm").string(from: end)
        // Merge the meridiem ("9:30 AM" + "10:00 AM" → "9:30–10:00 AM") when both
        // ends are in the same half of the day.
        let startMeridiem = meridiem(of: startClock)
        let endMeridiem = meridiem(of: endClock)
        if let startMeridiem, startMeridiem == endMeridiem {
            let startBare = startClock.replacingOccurrences(of: " \(startMeridiem)", with: "")
            return "\(startBare)–\(endClock)"
        }
        return "\(startClock)–\(endClock)"
    }

    /// `Wed, Jun 17 · 9:30–10:00 AM` — the booking summary line.
    static func dayTimeRange(startUTC: String?, endUTC: String?, tz: String) -> String? {
        guard let day = weekdayDate(startUTC, tz: tz) else { return nil }
        guard let range = timeRange(startUTC: startUTC, endUTC: endUTC, tz: tz) else { return day }
        return "\(day) · \(range)"
    }

    /// `Thu, Jun 18 · 2:00 PM` — a single start instant (My Bookings rows).
    static func dayTime(_ utcISO: String?, tz: String) -> String? {
        guard let day = weekdayDate(utcISO, tz: tz), let clock = time(utcISO, tz: tz) else { return nil }
        return "\(day) · \(clock)"
    }

    private static func meridiem(of clock: String) -> String? {
        if clock.hasSuffix("AM") { return "AM" }
        if clock.hasSuffix("PM") { return "PM" }
        return nil
    }

    /// `30 min` / `1 hr 30 min` — a duration in minutes.
    static func duration(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let remainder = minutes % 60
        if remainder == 0 { return hours == 1 ? "1 hr" : "\(hours) hr" }
        return "\(hours) hr \(remainder) min"
    }

    /// `$48.00` — a Stripe minor-unit amount in its currency.
    static func money(cents: Int?, currency: String?) -> String? {
        guard let cents else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = (currency ?? "USD").uppercased()
        formatter.locale = Locale(identifier: "en_US")
        return formatter.string(from: NSNumber(value: Double(cents) / 100.0))
    }
}

// MARK: - Host-pillar accent (public surfaces have no SchedulingOwner)

/// Public edge screens are unauthenticated and carry no `SchedulingOwner`, so the
/// host accent is derived from the page/booking `owner_type` wire string by
/// mapping it onto the Foundation `SchedulingIdentityTheme` — never a raw hue.
enum EdgeOwnerTheme {
    static func owner(forOwnerType ownerType: String?) -> SchedulingOwner {
        switch (ownerType ?? "").lowercased() {
        case "home": .home(homeId: "")
        case "business": .business(id: "")
        default: .personal
        }
    }

    /// Host-pillar accent (sky / green / violet).
    static func accent(forOwnerType ownerType: String?) -> Color {
        owner(forOwnerType: ownerType).theme.accent
    }

    /// Lightest host-pillar tint.
    static func accentBg(forOwnerType ownerType: String?) -> Color {
        owner(forOwnerType: ownerType).theme.accentBg
    }

    /// Pillar glyph for the avatar dot.
    static func icon(forOwnerType ownerType: String?) -> PantopusIcon {
        owner(forOwnerType: ownerType).theme.icon
    }

    /// Initials for a host/booking avatar disc.
    static func initials(_ name: String?) -> String {
        let parts = (name ?? "").split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "·" : String(parts).uppercased()
    }
}

// MARK: - System share for a downloaded `.ics` (D8)

/// Writes the downloaded `.ics` to a temp file and presents the system share
/// sheet from the topmost view controller, so it works from inside a SwiftUI
/// sheet. Mirrors the I4 share idiom but owned locally by this stream.
@MainActor
enum EdgeShare {
    static func presentICS(_ data: Data, filename: String = "invite.ics") {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            // Fall back to sharing the raw data if the temp write fails.
            present(items: [data])
            return
        }
        present(items: [url])
    }

    private static func present(items: [Any]) {
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
            let root = scene.keyWindow?.rootViewController
        else { return }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = top.view
        top.present(activity, animated: true)
    }
}
