//
//  ConfirmSupport.swift
//  Pantopus
//
//  Stream I6 (Invitee Confirm & Manage) — shared helpers and presentational
//  pieces for D1 Intake, D2 Review & Confirm, D3 Confirmed and D4 Manage.
//
//  Public invitee screens have NO `SchedulingOwner` (unauthenticated); the host
//  pillar accent is derived from the page `owner_type` string via the I5
//  `DiscoveryTheme` helper. All times render in the booker's tz from UTC ISO.
//  Tokens-only styling (Theme.Color / Spacing / Radii / Icon).
//

// swiftlint:disable file_length
import SwiftUI

// MARK: - Formatting

/// Date / time / money formatting for the confirm & manage surfaces. All inputs
/// are UTC ISO strings; everything renders in the booker's IANA `tz`.
enum ConfirmFormat {
    private static func calendar(_ tz: String) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        return cal
    }

    private static func formatter(_ tz: String, format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = .current
        formatter.timeZone = TimeZone(identifier: tz) ?? .current
        formatter.dateFormat = format
        return formatter
    }

    /// e.g. "Wed, Jun 17".
    static func dayLine(startUTC: String, tz: String) -> String? {
        guard let date = SchedulingTime.parseUTC(startUTC) else { return nil }
        return formatter(tz, format: "EEE, MMM d").string(from: date)
    }

    /// e.g. "9:30 – 10:00 AM" (drops the leading meridiem when both ends share it).
    static func timeRange(startUTC: String, endUTC: String?, tz: String) -> String? {
        guard let start = SchedulingTime.parseUTC(startUTC) else { return nil }
        guard let endISO = endUTC, let end = SchedulingTime.parseUTC(endISO) else {
            return formatter(tz, format: "h:mm a").string(from: start)
        }
        let cal = calendar(tz)
        let sameMeridiem = (cal.component(.hour, from: start) < 12) == (cal.component(.hour, from: end) < 12)
        let startStr = formatter(tz, format: sameMeridiem ? "h:mm" : "h:mm a").string(from: start)
        let endStr = formatter(tz, format: "h:mm a").string(from: end)
        return "\(startStr) – \(endStr)"
    }

    /// e.g. "Wed, Jun 17 · 9:30 – 10:00 AM".
    static func dayAndTime(startUTC: String, endUTC: String?, tz: String) -> String {
        [dayLine(startUTC: startUTC, tz: tz), timeRange(startUTC: startUTC, endUTC: endUTC, tz: tz)]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    /// The tz chip text, e.g. "Pacific Time (PDT)".
    static func tzChipLabel(tz: String, at date: Date = Date()) -> String {
        let name = DiscoveryTimeZone.label(for: tz)
        let abbr = DiscoveryTimeZone.abbreviation(for: tz, at: date)
        return abbr.isEmpty ? name : "\(name) (\(abbr))"
    }

    /// e.g. "$48.00" from minor units. Whole-dollar amounts keep the cents.
    static func money(cents: Int, currency: String?) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = (currency ?? "USD").uppercased()
        formatter.locale = .current
        let amount = Double(cents) / 100.0
        return formatter.string(from: NSNumber(value: amount)) ?? String(format: "$%.2f", amount)
    }

    /// Two-letter initials for the host avatar, derived from the page title.
    static func initials(from name: String?) -> String {
        let trimmed = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "·" }
        let parts = trimmed.split(separator: " ")
        if parts.count >= 2, let first = parts.first?.first, let last = parts.last?.first {
            return "\(first)\(last)".uppercased()
        }
        return String(trimmed.prefix(2)).uppercased()
    }
}

/// Maps the page `owner_type` wire string to the pillar display name.
enum ConfirmPillar {
    static func title(forOwnerType ownerType: String?) -> String {
        switch (ownerType ?? "").lowercased() {
        case "home": "Home"
        case "business": "Business"
        default: "Personal"
        }
    }
}

// MARK: - Draft model + in-session handoff store

/// A single intake answer value (mirrors the host question field types).
enum InviteeAnswer: Hashable {
    case text(String)
    case choices([String])
    case flag(Bool)

    var jsonValue: JSONValue {
        switch self {
        case let .text(value): .string(value)
        case let .choices(values): .array(values.map { .string($0) })
        case let .flag(value): .bool(value)
        }
    }

    /// Whether this answer counts as "filled" for required validation.
    var isAnswered: Bool {
        switch self {
        case let .text(value): !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case let .choices(values): !values.isEmpty
        case let .flag(value): value
        }
    }
}

/// The invitee-entered details collected on D1 and confirmed on D2.
struct InviteeBookingDraft: Hashable {
    var firstName: String = ""
    var lastName: String = ""
    var email: String = ""
    /// Answers keyed by question id (falls back to the question label).
    var answers: [String: InviteeAnswer] = [:]
    var guests: [String] = []

    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }

    /// The `phone` top-level value for the create request, taken from a
    /// phone-type question's answer if present.
    func phone(forPhoneQuestionId id: String?) -> String? {
        guard let id, case let .text(value)? = answers[id] else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// The `answers` payload object for the create request.
    func answersJSON() -> JSONValue {
        var object: [String: JSONValue] = [:]
        for (key, value) in answers where value.isAnswered {
            object[key] = value.jsonValue
        }
        let cleanedGuests = guests
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if !cleanedGuests.isEmpty {
            object["guests"] = .array(cleanedGuests.map { .string($0) })
        }
        return .object(object)
    }
}

/// The full context handed from D1 to D2. The frozen `.inviteeReviewConfirm`
/// route cannot carry the draft / loaded event type, so D1 stashes it here and
/// D2 reads it back by key (same NavigationStack, same session).
struct InviteeReviewContext {
    let slug: String
    let eventTypeSlug: String
    let start: String
    let tz: String
    let eventType: PublicEventTypeView
    let page: PublicPageView
    var draft: InviteeBookingDraft
}

/// In-memory bridge for the D1 → D2 hand-off (not persisted — this is a
/// within-session draft).
@MainActor
final class InviteeBookingDraftStore {
    static let shared = InviteeBookingDraftStore()

    private var contexts: [String: InviteeReviewContext] = [:]

    private init() {}

    static func key(slug: String, eventTypeSlug: String, start: String) -> String {
        "\(slug)|\(eventTypeSlug)|\(start)"
    }

    func set(_ context: InviteeReviewContext) {
        contexts[Self.key(slug: context.slug, eventTypeSlug: context.eventTypeSlug, start: context.start)] = context
    }

    func context(slug: String, eventTypeSlug: String, start: String) -> InviteeReviewContext? {
        contexts[Self.key(slug: slug, eventTypeSlug: eventTypeSlug, start: start)]
    }

    func clear(slug: String, eventTypeSlug: String, start: String) {
        contexts[Self.key(slug: slug, eventTypeSlug: eventTypeSlug, start: start)] = nil
    }
}

/// One-shot in-session relay for the D2 → C6 "Pick another time" hand-off.
///
/// The frozen router hands screens only `push`, so D2 cannot rewind the
/// navigation path itself. Instead D2 signals here and dismisses; D1 sees the
/// pending entry on re-appear and continues the unwind; the C6 slot picker
/// consumes the entry and marks the conflicted slot as just-taken (Frame 6
/// WARN toast + taken-row treatment) so the booker lands on the picker, not a
/// dead-ended D1 whose route still carries the lost start time.
@MainActor
final class SlotTakenRelay {
    static let shared = SlotTakenRelay()

    struct Entry {
        let slug: String
        let eventTypeSlug: String
        let start: String
    }

    private var pending: Entry?

    private init() {}

    /// Record the conflicted slot for this booking flow (D2, on 409).
    func signal(slug: String, eventTypeSlug: String, start: String) {
        pending = Entry(slug: slug, eventTypeSlug: eventTypeSlug, start: start)
    }

    /// Whether an unwind is pending for this flow (D1, without consuming —
    /// the picker below still needs the entry).
    func hasPending(slug: String, eventTypeSlug: String) -> Bool {
        matches(slug: slug, eventTypeSlug: eventTypeSlug)
    }

    /// Consume the pending entry for this flow (C6), returning the taken start.
    func consume(slug: String, eventTypeSlug: String) -> String? {
        guard matches(slug: slug, eventTypeSlug: eventTypeSlug), let entry = pending else { return nil }
        pending = nil
        return entry.start
    }

    private func matches(slug: String, eventTypeSlug: String) -> Bool {
        guard let pending else { return false }
        return pending.slug == slug && pending.eventTypeSlug == eventTypeSlug
    }
}

// MARK: - Shared presentational pieces

/// 11pt uppercase section overline (mirrors Form.html overlines).
struct ConfirmOverline: View {
    let text: String
    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.8)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The booker's timezone chip (globe + label) used inside the summary card.
struct ConfirmTzChip: View {
    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.globe, size: 11, strokeWidth: 2.2, color: Theme.Color.primary700)
            Text(label)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.primary100)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

/// The circular host avatar with pillar gradient + initials.
struct HostAvatarBadge: View {
    let initials: String
    let colors: [Color]
    var size: CGFloat = 36

    var body: some View {
        LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(
                Text(initials)
                    .font(.system(size: size * 0.36, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            )
    }
}

/// A white rounded card surface (1px border, soft shadow) used across the stream.
struct ConfirmCard<Content: View>: View {
    var padding: CGFloat = Spacing.s3
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    )
            )
    }
}

/// Inline banner (info / warning / error tones) with optional title + link.
struct ConfirmBanner: View {
    enum Tone { case info, warning, error }

    let tone: Tone
    let icon: PantopusIcon
    let title: String
    var message: String?
    var linkLabel: String?
    var onTapLink: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 16, strokeWidth: 2.2, color: foreground)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(darkForeground)
                if let message {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundStyle(foreground)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let linkLabel, let onTapLink {
                    Button(action: onTapLink) {
                        HStack(spacing: Spacing.s1) {
                            Text(linkLabel)
                                .font(.system(size: 11.5, weight: .bold))
                            Icon(.arrowRight, size: 12, strokeWidth: 2.4, color: darkForeground)
                        }
                        .foregroundStyle(darkForeground)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, Spacing.s1)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(background)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var foreground: Color {
        switch tone {
        case .info: Theme.Color.primary700
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        }
    }

    private var darkForeground: Color {
        foreground
    }

    private var background: Color {
        switch tone {
        case .info: Theme.Color.primary50
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        }
    }

    private var border: Color {
        switch tone {
        case .info: Theme.Color.primary100
        case .warning: Theme.Color.warningLight
        case .error: Theme.Color.errorLight
        }
    }
}

/// The sticky bottom action dock (blurred surface + top hairline).
struct ConfirmFooter<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: Spacing.s2) {
            content()
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s5)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

/// Full-width primary CTA used in the footers.
struct ConfirmPrimaryButton: View {
    let label: String
    var icon: PantopusIcon?
    var accent: Color = Theme.Color.primary600
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon {
                    Icon(icon, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                }
                Text(label)
                    .font(.system(size: 14.5, weight: .bold))
            }
            .foregroundStyle(isDisabled ? Theme.Color.appTextMuted : Theme.Color.appTextInverse)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(isDisabled ? Theme.Color.appSurfaceSunken : accent)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: isDisabled ? .clear : accent.opacity(0.28), radius: 8, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
    }
}

/// In-flight shimmer CTA (never a "Loading…" spinner).
struct ConfirmShimmerButton: View {
    let label: String

    var body: some View {
        Shimmer(height: 48, cornerRadius: Radii.lg)
            .overlay(
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
            )
            .accessibilityLabel(label)
    }
}

/// Add-to-calendar cluster (Google / Apple / Outlook chips + Download .ics).
/// All taps surface the Foundation `AddToCalendarSheet` (the real wiring).
struct CalendarClusterView: View {
    let accent: Color
    let onAdd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ConfirmOverline("Add to your calendar")
            HStack(spacing: Spacing.s2) {
                ForEach(["Google", "Apple", "Outlook"], id: \.self) { name in
                    Button(action: onAdd) {
                        HStack(spacing: Spacing.s1) {
                            Icon(.calendar, size: 13, strokeWidth: 2.1, color: accent)
                            Text(name)
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 38)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add to \(name) Calendar")
                }
            }
            Button(action: onAdd) {
                HStack(spacing: Spacing.s1) {
                    Icon(.download, size: 13, strokeWidth: 2.1, color: Theme.Color.appTextSecondary)
                    Text("Download .ics")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s1)
        }
    }
}

// MARK: - Booking summary card (who / what / when / where)

/// The data the read-only summary card renders. Optional rows are omitted when nil.
struct BookingSummary {
    var initials: String
    var avatarColors: [Color]
    var accent: Color
    var eventName: String
    var hostName: String?
    var pillarTitle: String?
    var dateLine: String?
    var tzLabel: String?
    var locationTitle: String?
    var locationSub: String?
    var attendeePrimary: String?
    var attendeeSecondary: String?
    var answers: [(question: String, answer: String)] = []
}

/// The shared who/what/when/where card used by D2 / D3 / D4. `hostPrefix`
/// renders "with <host>" (D2/D3) vs. plain "<host>" + pillar dot (D4).
struct BookingSummaryCard: View {
    let summary: BookingSummary
    let dimmed: Bool
    let struck: Bool
    let hostPrefix: Bool
    let showPillar: Bool
    let showAnswers: Bool
    @State private var answersOpen = true

    init(
        summary: BookingSummary,
        dimmed: Bool = false,
        struck: Bool = false,
        hostPrefix: Bool = true,
        showPillar: Bool = true,
        showAnswers: Bool = false
    ) {
        self.summary = summary
        self.dimmed = dimmed
        self.struck = struck
        self.hostPrefix = hostPrefix
        self.showPillar = showPillar
        self.showAnswers = showAnswers
    }

    var body: some View {
        ConfirmCard {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                identityRow
                if let dateLine = summary.dateLine {
                    divider
                    dateRow(dateLine)
                }
                if let title = summary.locationTitle {
                    divider
                    locationRow(title)
                }
                if let attendee = summary.attendeePrimary {
                    divider
                    attendeeRow(attendee)
                }
                if showAnswers, !summary.answers.isEmpty {
                    divider
                    answersDisclosure
                }
            }
        }
        .opacity(dimmed ? 0.6 : 1)
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder)
            .frame(height: 1)
            .padding(.vertical, Spacing.s1)
    }

    private var identityRow: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            HostAvatarBadge(initials: summary.initials, colors: summary.avatarColors, size: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(summary.eventName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .strikethrough(struck, color: Theme.Color.appTextMuted)
                if summary.hostName != nil || (showPillar && summary.pillarTitle != nil) {
                    HStack(spacing: Spacing.s1) {
                        if let host = summary.hostName {
                            Text(hostPrefix ? "with \(host)" : host)
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        if showPillar, let pillar = summary.pillarTitle {
                            Circle().fill(summary.accent).frame(width: 6, height: 6)
                            Text(pillar)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(summary.accent)
                        }
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private func dateRow(_ dateLine: String) -> some View {
        summaryRow(icon: .calendar) {
            Text(dateLine)
                .font(.system(size: 12.5, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
                .strikethrough(struck, color: Theme.Color.appTextMuted)
            if let tz = summary.tzLabel {
                ConfirmTzChip(label: tz).padding(.top, Spacing.s1)
            }
        }
    }

    private func locationRow(_ title: String) -> some View {
        summaryRow(icon: .video) {
            Text(title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            if let sub = summary.locationSub {
                Text(sub)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private func attendeeRow(_ primary: String) -> some View {
        summaryRow(icon: .users) {
            Text(primary)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            if let secondary = summary.attendeeSecondary {
                Text(secondary)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var answersDisclosure: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Button { withAnimation { answersOpen.toggle() } } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.messageSquare, size: 15, color: Theme.Color.appTextSecondary)
                    Text("Your answers")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                    Text("\(summary.answers.count)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Icon(answersOpen ? .chevronUp : .chevronDown, size: 15, color: Theme.Color.appTextMuted)
                }
            }
            .buttonStyle(.plain)
            if answersOpen {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    ForEach(Array(summary.answers.enumerated()), id: \.offset) { _, pair in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pair.question)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            Text(pair.answer)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.leading, 25)
            }
        }
        .padding(.top, Spacing.s1)
    }

    private func summaryRow(icon: PantopusIcon, @ViewBuilder content: () -> some View) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 15, color: Theme.Color.appTextSecondary)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: Spacing.s0) { content() }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.vertical, Spacing.s1)
    }
}

// MARK: - Event-type helpers

extension PublicEventTypeView {
    /// The booking duration in minutes (default → first listed → 30).
    var bookingDuration: Int {
        defaultDuration ?? durations?.first ?? 30
    }

    /// "30 min · with Maria Kessler" style sub-line for the D1 header.
    func durationLine(host: String?) -> String {
        var parts = ["\(bookingDuration) min"]
        if let host, !host.isEmpty { parts.append("with \(host)") }
        return parts.joined(separator: " · ")
    }

    /// Whether this event type is priced (gates the paid surfaces with the flag).
    var isPriced: Bool {
        (priceCents ?? 0) > 0
    }
}
