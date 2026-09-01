//
//  GigBody.swift
//  Pantopus
//
//  Concrete body for the Gig mailbox category (A17.6 "bid on your gig").
//  Renders inside `MailboxItemDetailShell`'s body slot. Two states:
//    • received  → bidder + post + bid cards, the other-bids strip, and a
//                  three-way Accept / Counter / Decline action row.
//    • accepted  → the action row is replaced by a next-steps timeline and
//                  a primary "Open thread" CTA.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct GigBody: View {
    private let gig: GigDetailDTO
    private let onAccept: @MainActor () -> Void
    private let onCounter: @MainActor () -> Void
    private let onDecline: @MainActor () -> Void
    private let onOpenThread: @MainActor () -> Void
    private let onOpenGig: @MainActor () -> Void
    private let onViewProfile: @MainActor () -> Void
    private let onCompareBids: @MainActor () -> Void

    public init(
        gig: GigDetailDTO,
        onAccept: @escaping @MainActor () -> Void = {},
        onCounter: @escaping @MainActor () -> Void = {},
        onDecline: @escaping @MainActor () -> Void = {},
        onOpenThread: @escaping @MainActor () -> Void = {},
        onOpenGig: @escaping @MainActor () -> Void = {},
        onViewProfile: @escaping @MainActor () -> Void = {},
        onCompareBids: @escaping @MainActor () -> Void = {}
    ) {
        self.gig = gig
        self.onAccept = onAccept
        self.onCounter = onCounter
        self.onDecline = onDecline
        self.onOpenThread = onOpenThread
        self.onOpenGig = onOpenGig
        self.onViewProfile = onViewProfile
        self.onCompareBids = onCompareBids
    }

    public init(
        gig: GigDetailDTO,
        onAccept: @escaping @MainActor () -> Void
    ) {
        self.init(
            gig: gig,
            onAccept: onAccept,
            onCounter: {},
            onDecline: {},
            onOpenThread: {},
            onOpenGig: {},
            onViewProfile: {},
            onCompareBids: {}
        )
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if gig.isAccepted {
                acceptedBanner
            }
            BidderProfileCard(bidder: gig.bidder, onViewProfile: onViewProfile)
            PostSummaryCard(post: gig.post, onOpenGig: onOpenGig)
            BidCard(bid: gig.bid, isAccepted: gig.isAccepted)

            if gig.isAccepted {
                GigNextStepsCard(steps: gig.nextSteps)
                PrimaryButton(title: "Open thread") { onOpenThread() }
                    .accessibilityIdentifier("gigOpenThreadButton")
            } else {
                if !gig.otherBids.isEmpty {
                    OtherBidsStrip(bids: gig.otherBids, onCompareAll: onCompareBids)
                }
                GigActionRow(
                    amount: gig.bid.amount,
                    onAccept: onAccept,
                    onCounter: onCounter,
                    onDecline: onDecline
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("gigBody")
    }

    private var acceptedBanner: some View {
        HStack(spacing: Spacing.s2) {
            Circle()
                .fill(Theme.Color.success)
                .frame(width: 20, height: 20)
                .overlay(Icon(.check, size: 12, color: Theme.Color.appTextInverse))
            Text("Bid accepted · funds held in escrow")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("gigAcceptedBanner")
    }
}

// MARK: - Three-way action row

/// Accept (success) · Counter (ghost) · Decline (destructive). Equal width.
@MainActor
struct GigActionRow: View {
    let amount: Int
    let onAccept: @MainActor () -> Void
    let onCounter: @MainActor () -> Void
    let onDecline: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            GigActionButton(
                icon: .check,
                label: "Accept · $\(amount)",
                kind: .success,
                identifier: "gigAcceptButton",
                action: onAccept
            )
            GigActionButton(
                icon: .arrowsRepeat,
                label: "Counter",
                kind: .ghost,
                identifier: "gigCounterButton",
                action: onCounter
            )
            GigActionButton(
                icon: .x,
                label: "Decline",
                kind: .destructive,
                identifier: "gigDeclineButton",
                action: onDecline
            )
        }
        .accessibilityIdentifier("gigActionRow")
    }
}

@MainActor
private struct GigActionButton: View {
    enum Kind { case success, ghost, destructive }

    let icon: PantopusIcon
    let label: String
    let kind: Kind
    let identifier: String
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: { action() }) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 14, color: foreground)
                Text(label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.vertical, Spacing.s2)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(borderOverlay)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }

    private var foreground: Color {
        switch kind {
        case .success, .destructive: Theme.Color.appTextInverse
        case .ghost: Theme.Color.appText
        }
    }

    private var background: Color {
        switch kind {
        case .success: Theme.Color.success
        case .ghost: Theme.Color.appSurface
        case .destructive: Theme.Color.error
        }
    }

    @ViewBuilder private var borderOverlay: some View {
        if kind == .ghost {
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }
}

// MARK: - Next-steps timeline (accepted state)

@MainActor
struct GigNextStepsCard: View {
    let steps: [GigDetailDTO.NextStep]

    var body: some View {
        GigCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                GigSectionLabel(text: "WHAT HAPPENS NEXT")
                TimelineStepper(steps: steps.map(Self.timelineStep))
            }
        }
        .accessibilityIdentifier("gigNextStepsCard")
    }

    private static func timelineStep(_ step: GigDetailDTO.NextStep) -> TimelineStep {
        let state: TimelineStepState = switch step.state {
        case .active: .done
        case .pending: .current
        case .upcoming: .upcoming
        }
        return TimelineStep(id: step.id, title: step.label, subtitle: step.whenText, state: state)
    }
}

#Preview("Received") {
    ScrollView { GigBody(gig: MailItemSampleData.gigReceived) }
        .background(Theme.Color.appBg)
}

#Preview("Accepted") {
    ScrollView { GigBody(gig: MailItemSampleData.gigAccepted) }
        .background(Theme.Color.appBg)
}
