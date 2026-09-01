//
//  GoingStrip.swift
//  Pantopus
//
//  A17.9 — "+N going" friend pile. Section header carries the headcount
//  + maybe count + a "See all" affordance; body wraps the friend avatars
//  with a +N plus-one badge stacked on each. In the going state a
//  primary-tinted "You" avatar is prepended so the user reads as part
//  of the pile alongside their friends.
//

import SwiftUI

@MainActor
struct GoingStrip: View {
    let party: PartyDetailDTO

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            avatarFlow
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyGoingStrip")
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(party.headcount) GOING · \(party.maybeCount) MAYBE")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(party.rsvp == .going
                    ? "Including you + \(party.plusOneCount)"
                    : "5 friends · 2 plus-ones"
                )
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            HStack(spacing: 2) {
                Text("See all")
                    .font(.system(size: 11, weight: .bold))
                Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
            }
            .foregroundStyle(Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    // MARK: - Avatar pile

    private var avatarFlow: some View {
        FlowLayout(spacing: Spacing.s2) {
            if party.rsvp == .going {
                YouAvatar(plusCount: party.plusOneCount)
            }
            ForEach(party.goingAttendees) { attendee in
                AttendeeAvatar(attendee: attendee)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }
}

// MARK: - Avatars

private struct AttendeeAvatar: View {
    let attendee: PartyAttendee

    var body: some View {
        VStack(spacing: Spacing.s1) {
            ZStack(alignment: .bottomTrailing) {
                Text(attendee.initials)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 40, height: 40)
                    .background(attendee.accent.swiftUIColor)
                    .clipShape(Circle())
                if attendee.plusCount > 0 {
                    PlusBadge(text: "+\(attendee.plusCount)")
                }
            }
            Text(attendee.name)
                .font(.system(size: 9.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .frame(width: 44)
        .accessibilityIdentifier("partyGoingStrip_attendee_\(attendee.id)")
    }
}

private struct YouAvatar: View {
    let plusCount: Int

    var body: some View {
        VStack(spacing: Spacing.s1) {
            ZStack(alignment: .bottomTrailing) {
                Text("You")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 40, height: 40)
                    .background(
                        LinearGradient(
                            colors: [Theme.Color.primary500, Theme.Color.primary700],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(Circle())
                    .overlay(
                        Circle().stroke(Theme.Color.primary300, lineWidth: 2.5)
                    )
                PlusBadge(text: plusCount > 0 ? "+\(plusCount)" : "+1")
            }
            Text("You")
                .font(.system(size: 9.5, weight: .heavy))
                .foregroundStyle(Theme.Color.primary700)
                .lineLimit(1)
        }
        .frame(width: 44)
        .accessibilityIdentifier("partyGoingStrip_you")
    }
}

private struct PlusBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s1)
            .frame(minWidth: 16, minHeight: 16)
            .background(Theme.Color.categoryParty)
            .overlay(Capsule().stroke(Theme.Color.appSurface, lineWidth: 2))
            .clipShape(Capsule())
            .offset(x: 4, y: 4)
    }
}

extension PartyAttendee.AccentTint {
    /// Maps the data-side accent enum onto the design system. Keeps the
    /// view free of any raw hex while staying faithful to the design's
    /// gradient palette.
    var swiftUIColor: Color {
        switch self {
        case .home: Theme.Color.home
        case .personal: Theme.Color.personal
        case .business: Theme.Color.business
        case .warning: Theme.Color.handyman
        case .error: Theme.Color.error
        case .primary: Theme.Color.primary600
        case .party: Theme.Color.categoryParty
        }
    }
}

// MARK: - Flow layout for the wrapping avatar pile

/// Minimal flow layout — wraps children left-to-right and starts a new
/// line when the next item would overflow the available width.
private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: y + rowHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

#Preview("Open") {
    GoingStrip(party: MailItemSampleData.partyInvite)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}

#Preview("Going") {
    GoingStrip(party: MailItemSampleData.partyInviteGoing)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
