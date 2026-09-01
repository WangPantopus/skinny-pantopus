//
//  SlotRow.swift
//  Pantopus
//
//  A10.9 — Per-slot row used by the "Open slots near you" / "Already
//  on the train" / "Your commitment" stacks. Same recipe carries every
//  state; the view flips the date column tint + trailing affordance
//  (`Sign up` pill / check disc / `Edit` ghost) off `state` + `mine`.
//

import SwiftUI

@MainActor
public struct SlotRow: View {
    private let content: SlotRowContent
    private let onSignUp: (@MainActor () -> Void)?
    private let onEdit: (@MainActor () -> Void)?

    public init(
        content: SlotRowContent,
        onSignUp: (@MainActor () -> Void)? = nil,
        onEdit: (@MainActor () -> Void)? = nil
    ) {
        self.content = content
        self.onSignUp = onSignUp
        self.onEdit = onEdit
    }

    public var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            dateColumn
            bodyContent
            trailing
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(borderColor, lineWidth: content.mine ? 1.5 : 1)
        )
        .pantopusShadow(content.mine ? .md : .sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("supportTrainSlotRow-\(content.id)")
    }

    private var dateColumn: some View {
        VStack(spacing: 1) {
            Text(content.dayLabel)
                .font(.system(size: 9, weight: .bold))
                .textCase(.uppercase)
                .foregroundStyle(dateColumnForeground.opacity(0.8))
            Text(content.dateLabel)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(dateColumnForeground)
                .monospacedDigit()
        }
        .frame(width: 42)
        .padding(.vertical, Spacing.s1)
        .background(dateColumnBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(
                    Theme.Color.appBorder,
                    style: StrokeStyle(lineWidth: 1.5, dash: content.state == .open ? [3, 2] : [])
                )
                .opacity(content.state == .open ? 1 : 0)
        )
    }

    @ViewBuilder
    private var bodyContent: some View {
        switch content.state {
        case .open:
            VStack(alignment: .leading, spacing: 2) {
                Text(content.title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                if let subtitle = content.subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .covered:
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    if let author = content.author {
                        authorDisc(author)
                        Text(content.mine ? "You" : author.displayName)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                    } else {
                        Text(content.mine ? "You" : "Helper")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    if content.mine {
                        Text("Your slot")
                            .font(.system(size: 9, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Color.primary700)
                            .padding(.horizontal, Spacing.s1)
                            .padding(.vertical, 1)
                            .background(Theme.Color.primary50)
                            .clipShape(Capsule())
                    }
                    Spacer(minLength: 0)
                }
                Text(coveredSubtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func authorDisc(_ author: SlotRowContent.SlotAuthor) -> some View {
        ZStack {
            Circle().fill(authorTone(author.tone))
            Text(author.initials)
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 18, height: 18)
    }

    @ViewBuilder
    private var trailing: some View {
        switch (content.state, content.mine) {
        case (.open, _):
            Button(
                action: { onSignUp?() },
                label: {
                    Text("Sign up")
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 30)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Sign up for \(content.dayLabel) \(content.dateLabel)")
            .accessibilityIdentifier("supportTrainSlotRowSignUp-\(content.id)")
        case (.covered, true):
            Button(
                action: { onEdit?() },
                label: {
                    Text("Edit")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, Spacing.s2)
                        .frame(height: 30)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Edit your slot")
            .accessibilityIdentifier("supportTrainSlotRowEdit-\(content.id)")
        case (.covered, false):
            Icon(.checkCircle, size: 18, color: Theme.Color.home)
                .accessibilityHidden(true)
        }
    }

    private var coveredSubtitle: String {
        if let subtitle = content.subtitle, !subtitle.isEmpty {
            return "\(content.title) · \(subtitle)"
        }
        return content.title
    }

    private var borderColor: Color {
        content.mine ? Theme.Color.primary300 : Theme.Color.appBorder
    }

    private var dateColumnBackground: Color {
        switch (content.state, content.mine) {
        case (.covered, true): Theme.Color.primary50
        case (.covered, false): Theme.Color.homeBg
        case (.open, _): Theme.Color.appSurfaceSunken
        }
    }

    private var dateColumnForeground: Color {
        switch (content.state, content.mine) {
        case (.covered, true): Theme.Color.primary700
        case (.covered, false): Theme.Color.homeDark
        case (.open, _): Theme.Color.appTextStrong
        }
    }

    private func authorTone(_ tone: ContributorBubble.ContributorTone) -> Color {
        switch tone {
        case .warning: Theme.Color.warning
        case .primary: Theme.Color.primary500
        case .business: Theme.Color.business
        case .success: Theme.Color.success
        case .error: Theme.Color.error
        case .personal: Theme.Color.personal
        }
    }

    private var accessibilityText: String {
        let datePart = "\(content.dayLabel) \(content.dateLabel)"
        switch content.state {
        case .open:
            return "Open slot · \(datePart) · \(content.title). \(content.subtitle ?? "")"
        case .covered:
            let who = content.mine ? "your slot" : (content.author?.displayName ?? "a neighbor")
            return "\(datePart) · \(who) bringing \(content.title)"
        }
    }
}

#Preview("Open") {
    SlotRow(
        content: SlotRowContent(
            id: "preview-open",
            dayLabel: "Thu",
            dateLabel: "4",
            state: .open,
            title: "Open · dinner for 4",
            subtitle: "Drop off by 5:30 pm · porch shelf"
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Covered") {
    SlotRow(
        content: SlotRowContent(
            id: "preview-covered",
            dayLabel: "Tue",
            dateLabel: "2",
            state: .covered,
            author: SlotRowContent.SlotAuthor(initials: "SK", displayName: "Sam Kowalski", tone: .warning),
            title: "Lentil soup + cornbread",
            subtitle: "drop 5pm"
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Mine") {
    SlotRow(
        content: SlotRowContent(
            id: "preview-mine",
            dayLabel: "Thu",
            dateLabel: "4",
            state: .covered,
            author: SlotRowContent.SlotAuthor(initials: "YO", displayName: "You", tone: .primary),
            title: "Pad thai (no peanuts) + spring rolls",
            subtitle: "6:00 pm",
            mine: true
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
