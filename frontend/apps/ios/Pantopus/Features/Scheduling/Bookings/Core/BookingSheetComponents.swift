//
//  BookingSheetComponents.swift
//  Pantopus
//
//  Stream I8 — small building blocks shared by the approve/decline (E3),
//  reschedule (E4), and cancel (E5) sheets plus the booking detail (E2): the
//  requester card, the slot summary card, the expandable intake-answers
//  disclosure, the reason-chip row, and the note field. Tokens only.
//

import SwiftUI

/// Sheet title row, e.g. "Review request".
struct SheetTitle: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(Theme.Color.appText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Requester / attendee summary card with a verified pillar avatar.
struct BookingRequesterCard: View {
    let booking: BookingDTO
    var subtitle: String?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            BookingAvatar(ownerType: booking.ownerType, name: booking.inviteeName, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(booking.inviteeName ?? "Guest")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let sub = subtitle ?? booking.inviteeEmail {
                    Text(sub)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceRaised)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
    }
}

/// Calendar-clock slot card: "Mon, Jun 16 · 11:00–11:45 AM" + "Pacific Time · 45 min".
struct BookingSlotCard: View {
    let booking: BookingDTO
    let accent: Color
    var tz: String = BookingsTime.displayTimeZone

    private var line1: String {
        let day = BookingsTime.shortWhen(startUTC: booking.startAt, tz: tz)
        // shortWhen is "EEE, MMM d · h:mm a"; append the end of the range.
        guard booking.endAt != nil else { return day }
        let range = BookingsTime.timeRange(startUTC: booking.startAt, endUTC: booking.endAt, tz: tz)
        let datePart = BookingsTime.shortWhen(startUTC: booking.startAt, tz: tz)
            .components(separatedBy: " · ").first ?? day
        return "\(datePart) · \(range)"
    }

    private var line2: String {
        let zoneName = TimeZone(identifier: tz)?.localizedName(for: .generic, locale: .current)
            ?? BookingsTime.zoneAbbreviation(tz)
        if let duration = BookingsTime.durationLabel(startUTC: booking.startAt, endUTC: booking.endAt) {
            return "\(zoneName) · \(duration)"
        }
        return zoneName
    }

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.calendarClock, size: 19, color: accent)
                .frame(width: 38, height: 38)
                .background(BookingsPillar.accentBg(forType: booking.ownerType))
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(line1)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(line2)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(BookingsPillar.accentBg(forType: booking.ownerType), lineWidth: 1.5)
        )
    }
}

/// Expandable "Intake answers · N answers" disclosure rendering the booking's
/// `intake_answers` JSON object as question → answer rows.
struct IntakeAnswersDisclosure: View {
    let answers: JSONValue?
    @State private var expanded = false

    private var pairs: [(String, String)] {
        guard let dict = answers?.dictValue else { return [] }
        return dict
            .map { ($0.key, Self.display($0.value)) }
            .sorted { $0.0 < $1.0 }
    }

    private static func display(_ value: JSONValue) -> String {
        if let s = value.stringValue { return s }
        if let n = value.numberValue { return n == n.rounded() ? String(Int(n)) : String(n) }
        if let b = value.boolValue { return b ? "Yes" : "No" }
        if let arr = value.arrayValue { return arr.compactMap(\.stringValue).joined(separator: ", ") }
        return "—"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Button {
                withAnimation(.snappy) { expanded.toggle() }
            } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(.clipboardList, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 34, height: 34)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Intake answers")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("\(pairs.count) answer\(pairs.count == 1 ? "" : "s")")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    Spacer()
                    Icon(expanded ? .chevronUp : .chevronDown, size: 18, color: Theme.Color.appTextMuted)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(pairs.isEmpty)

            if expanded {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    ForEach(pairs, id: \.0) { question, answer in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(question)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextMuted)
                            Text(answer)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.leading, 46)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("scheduling.intakeAnswers")
    }
}

/// A multiline note field with a sunken background (the sheets' optional notes).
struct BookingNoteField: View {
    let placeholder: String
    @Binding var text: String
    var accessibilityID: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 10)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 6)
                .frame(minHeight: 58)
        }
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier(accessibilityID)
    }
}

/// A wrap-flow row of selectable reason chips (decline / cancel). Selected chip
/// reads in the error tone, matching the destructive intent.
struct ReasonChipRow<Reason: Hashable>: View {
    let reasons: [Reason]
    let label: (Reason) -> String
    @Binding var selected: Reason?

    var body: some View {
        BookingChipFlow(reasons) { reason in
            let isOn = selected == reason
            Button {
                selected = reason
            } label: {
                Text(label(reason))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(isOn ? Theme.Color.error : Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 34)
                    .background(isOn ? Theme.Color.errorBg : Theme.Color.appSurface)
                    .overlay(
                        Capsule().strokeBorder(isOn ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
    }
}

/// A minimal wrapping HStack for chips (avoids a Layout dependency).
struct BookingChipFlow<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    let content: (Data.Element) -> Content

    init(_ data: Data, @ViewBuilder content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.content = content
    }

    var body: some View {
        // Two-column wrap is enough for the 4-chip reason rows.
        let items = Array(data)
        let rows = stride(from: 0, to: items.count, by: 2).map { Array(items[$0..<min($0 + 2, items.count)]) }
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: Spacing.s2) {
                    ForEach(row, id: \.self) { content($0) }
                    Spacer(minLength: Spacing.s0)
                }
            }
        }
    }
}

/// A full-width sheet CTA with a leading icon + spinner-on-submit, in one of the
/// three tones (the sheet primaries all carry an icon in the design).
struct SheetCTAButton: View {
    enum Tone { case primary, destructive, accent(Color) }

    let title: String
    let icon: PantopusIcon
    var tone: Tone = .primary
    var isLoading = false
    var isEnabled = true
    let action: () async -> Void

    private var background: Color {
        switch tone {
        case .primary: Theme.Color.primary600
        case .destructive: Theme.Color.error
        case let .accent(color): color
        }
    }

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            ZStack {
                if isLoading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    HStack(spacing: Spacing.s2) {
                        Icon(icon, size: 17, color: Theme.Color.appTextInverse)
                        Text(title).font(.system(size: 14.5, weight: .bold))
                    }
                }
            }
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }
}

/// Section overline used inside the detail/sheets (icon + uppercase label).
struct BookingOverline: View {
    let icon: PantopusIcon
    let text: String
    var accent: Color = Theme.Color.appTextMuted
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 13, color: accent)
            Text(text)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }
}
