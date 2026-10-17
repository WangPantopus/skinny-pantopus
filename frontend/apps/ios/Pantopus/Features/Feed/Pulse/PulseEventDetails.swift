//
//  PulseEventDetails.swift
//  Pantopus
//
//  When and where an Event post happens, as its Pulse card and its post
//  page show them (as the web card does): "Sun, Oct 18 · 7:00–9:00 PM"
//  and the place the poster named.
//

import SwiftUI

/// When and where an Event post happens.
public struct PulseEventDetails: Sendable, Hashable {
    /// "Sun, Oct 18 · 7:00–9:00 PM", "Tomorrow · 7:00 PM"; nil without a start time.
    public let when: String?
    /// The place the poster named ("Esther Short Park"); nil without one.
    public let place: String?

    public init(when: String?, place: String?) {
        self.when = when
        self.place = place
    }

    /// Nil unless an Event post names a start time or a place. `long` spells
    /// the weekday out ("Sunday, Oct 18 · …"), as the post page does.
    public init?(
        postType: String?,
        startsAt: String?,
        endsAt: String?,
        venue: String?,
        long: Bool = false,
        now: Date = Date()
    ) {
        guard postType == "event" else { return nil }
        let when = Self.when(startsAt: startsAt, endsAt: endsAt, long: long, now: now)
        let place = venue?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard when != nil || place?.isEmpty == false else { return nil }
        self.init(when: when, place: place?.isEmpty == false ? place : nil)
    }

    /// Every composer stores the time the poster picked as wall-clock time
    /// labelled UTC (the web card reads it in UTC too), so it's read in UTC,
    /// and "Today" or "Tomorrow" compares it with the phone's own wall clock
    /// read the same way. An end at or before the start is left out.
    private static func when(startsAt: String?, endsAt: String?, long: Bool, now: Date) -> String? {
        guard let start = PlanTime.parse(startsAt) else { return nil }
        let end = PlanTime.parse(endsAt).flatMap { $0 > start ? $0 : nil }
        let wallClockNow = now.addingTimeInterval(TimeInterval(TimeZone.current.secondsFromGMT(for: now)))
        return PlanFormat.when(start: start, end: end, long: long, now: wallClockNow, calendar: PlanFormat.calendar(for: "UTC"))
    }
}

/// The Event's time and place as two icon rows: small on the Pulse card,
/// larger on the post page.
struct PulseEventDetailRows: View {
    enum Style {
        case card
        case page
    }

    let details: PulseEventDetails
    let style: Style
    /// `pulsePostEventWhen_<id>` on a card, `pulsePostDetail-eventWhen` on the post page (same on Android).
    let whenIdentifier: String
    let placeIdentifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: style == .card ? Spacing.s1 : Spacing.s2) {
            if let when = details.when {
                row(.calendar, when, weight: .semibold)
                    .accessibilityIdentifier(whenIdentifier)
            }
            if let place = details.place {
                if style == .page {
                    // Selectable, so the place can be copied into Maps.
                    row(.mapPin, place, weight: .regular)
                        .textSelection(.enabled)
                        .accessibilityIdentifier(placeIdentifier)
                } else {
                    row(.mapPin, place, weight: .regular)
                        .accessibilityIdentifier(placeIdentifier)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ icon: PantopusIcon, _ text: String, weight: Font.Weight) -> some View {
        HStack(alignment: style == .card ? .center : .top, spacing: style == .card ? 6 : Spacing.s2) {
            Icon(icon, size: style == .card ? 12 : 15, color: Theme.Color.magic)
                .padding(.top, style == .card ? 0 : 1)
            Text(text)
                .font(.system(size: style == .card ? 12 : 14, weight: weight))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(style == .card ? 1 : nil)
                .fixedSize(horizontal: false, vertical: style == .page)
        }
        .accessibilityElement(children: .combine)
    }
}
