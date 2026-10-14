//
//  PlanRow.swift
//  Pantopus
//
//  Board P2 "Plan row": the 44 pt kind tile, a one-line title (16/21
//  semibold), a second line with when, where and the distance band, and
//  one thing at the end: a status, spots, going, or a chevron. When the
//  words wouldn't fit beside a status, the status goes under them instead
//  of cutting the title or the distance off.
//

import SwiftUI

/// What sits at the end of a plan row.
enum PlanRowTrailing: Equatable {
    case chevron
    case text(String)
    case status(String, PantopusIcon?)
}

struct PlanRowModel: Identifiable, Equatable {
    let id: String
    let kind: PlanKind
    let title: String
    let subtitle: String
    let trailing: PlanRowTrailing
    let accessibilityLabel: String

    /// A row in a public list (the map's sheet, Today and Tomorrow, J8).
    static func listed(_ card: PlanCardDTO, trailing: PlanRowTrailing? = nil, now: Date = Date()) -> PlanRowModel {
        let calendar = PlanFormat.calendar(for: card.timezone)
        let distance = PlanFormat.distance(card.distanceBand)
        var parts: [String] = []
        if let when = PlanFormat.rowWhen(state: card.state, start: card.startsAtDate, end: card.endsAtDate, now: now, calendar: calendar) {
            parts.append(when)
            // A later day names the area too ("Sun 1:25 PM · Downtown · about 2 mi").
            if card.state != .live, let start = card.startsAtDate, !calendar.isDate(start, inSameDayAs: now) {
                parts.append(card.area.label)
            }
        } else {
            // A playdate before you're in: the part of the day and the neighborhood.
            parts.append(PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, now: now, calendar: calendar))
            parts.append(card.area.label)
        }
        if card.kind == .playdate, let ages = PlanRowModel.ages(card.details?.kidsAgeBands) {
            parts.append(ages)
        } else if let distance {
            parts.append(distance)
        }
        return PlanRowModel(
            id: card.id,
            kind: card.kind,
            title: card.title,
            subtitle: parts.joined(separator: " · "),
            trailing: trailing ?? spotsTrailing(card),
            accessibilityLabel: spoken(card, now: now)
        )
    }

    /// A row in "Your plans": hosting, asked, waitlisted or in.
    static func mine(_ card: PlanCardDTO, requestsCount: Int?, now: Date = Date()) -> PlanRowModel {
        let viewer = card.viewer
        if viewer?.isHost == true {
            let calendar = PlanFormat.calendar(for: card.timezone)
            let when = PlanFormat.rowWhen(state: card.state, start: card.startsAtDate, end: card.endsAtDate, now: now, calendar: calendar)
            let trailing: PlanRowTrailing = (requestsCount ?? 0) > 0
                ? .status("\(requestsCount ?? 0) request\(requestsCount == 1 ? "" : "s")", .bell)
                : .text("\(card.goingCount) going")
            let row = listed(card, trailing: trailing, now: now)
            return PlanRowModel(
                id: row.id,
                kind: row.kind,
                title: row.title,
                subtitle: ["You're hosting", when].compactMap { $0 }.joined(separator: " · "),
                trailing: trailing,
                accessibilityLabel: "You're hosting. " + row.accessibilityLabel
            )
        }
        let status: PlanRowTrailing = switch viewer?.requestStatus {
        case .accepted: .status("You're in", .check)
        case .waitlisted: .status(waitlistLabel(viewer?.waitlistPosition), nil)
        default: .status("Requested", .clock)
        }
        return listed(card, trailing: status, now: now)
    }

    /// "On the waitlist · 1st".
    static func waitlistLabel(_ position: Int?) -> String {
        guard let position else { return "On the waitlist" }
        return "On the waitlist · \(ordinal(position))"
    }

    static func ordinal(_ number: Int) -> String {
        let suffix: String = switch (number % 10, number % 100) {
        case let (1, teens) where teens != 11: "st"
        case let (2, teens) where teens != 12: "nd"
        case let (3, teens) where teens != 13: "rd"
        default: "th"
        }
        return "\(number)\(suffix)"
    }

    /// "ages 2–5", "under 2" for a playdate's age bands.
    static func ages(_ bands: [PlanKidsAgeBand]?) -> String? {
        guard let bands, !bands.isEmpty else { return nil }
        let ranges: [PlanKidsAgeBand: (Int, Int)] = [
            .under2: (0, 1),
            .age2to3: (2, 3),
            .age4to5: (4, 5),
            .age6to8: (6, 8),
            .age9to12: (9, 12)
        ]
        let lows = bands.compactMap { ranges[$0]?.0 }
        let highs = bands.compactMap { ranges[$0]?.1 }
        guard let low = lows.min(), let high = highs.max() else { return nil }
        // Non-breaking spaces: "ages 2–5" never splits across lines.
        if low == 0 { return "under\u{00A0}\(high + 1)" }
        return "ages\u{00A0}\(low)–\(high)"
    }

    private static func spotsTrailing(_ card: PlanCardDTO) -> PlanRowTrailing {
        if card.state == .live { return .text("\(card.goingCount) going") }
        if card.isFull { return .text("Full") }
        return .text("\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s")")
    }

    /// "Watch party, Seahawks game, Sunday 1:25 PM, about 1 mile, 3 spots left".
    static func spoken(_ card: PlanCardDTO, now: Date = Date()) -> String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        var parts = [card.kind.spokenTitle, card.title]
        if card.state == .live {
            parts.append("happening now")
        } else if let start = card.startsAtDate {
            parts.append(PlanFormat.spokenWhen(start, now: now, calendar: calendar))
        } else {
            // A playdate before you're in: "Saturday morning".
            parts.append(PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, now: now, calendar: calendar))
        }
        parts.append(card.area.label)
        if let distance = PlanFormat.spokenDistance(card.distanceBand) { parts.append(distance) }
        parts.append(card.isFull ? "full" : "\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s") left")
        return parts.joined(separator: ", ")
    }
}

struct PlanRow: View {
    let model: PlanRowModel
    var showsDivider = true
    let onTap: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                if showsDivider { Divider().overlay(Theme.Color.appBorder) }
                HStack(spacing: Spacing.s3) {
                    PlanTile(kind: model.kind)
                    if typeSize.isAccessibilitySize {
                        // At the largest text sizes the status goes under the words, which keep the width.
                        stacked(lines: 4)
                    } else {
                        // One line each with the status at the end when they fit (board P2);
                        // otherwise a status goes under the words and they may take two lines.
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: Spacing.s3) {
                                words(lines: 1).fixedSize(horizontal: true, vertical: false)
                                Spacer(minLength: 0)
                                trailing
                            }
                            if case .status = model.trailing {
                                stacked(lines: 2)
                            } else {
                                HStack(spacing: Spacing.s3) {
                                    words(lines: 2).frame(maxWidth: .infinity, alignment: .leading)
                                    trailing
                                }
                            }
                        }
                    }
                }
                .padding(.vertical, 11)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // The button is the one element VoiceOver stops on, with the spoken line.
        .accessibilityLabel(model.accessibilityLabel + trailingSpoken)
        .accessibilityIdentifier("planRow.\(model.id)")
    }

    private func words(lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(model.title)
                .planFont(.rowTitle)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(lines)
            Text(model.subtitle)
                .planFont(.footnote)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(lines)
        }
    }

    /// The words, with the status under them.
    private func stacked(lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            words(lines: lines)
            trailing.padding(.top, Spacing.s1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var trailing: some View {
        switch model.trailing {
        case .chevron:
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        case let .text(text):
            Text(text)
                .planFont(.footnote)
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
        case let .status(text, icon):
            StatusChip(text, variant: .neutral, icon: icon).accessibilityLabel(text)
        }
    }

    private var trailingSpoken: String {
        switch model.trailing {
        case let .status(text, _): ". \(text)"
        case .chevron, .text: ""
        }
    }
}
