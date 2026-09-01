//
//  GigMailDetailLayout.swift
//  Pantopus
//
//  A17.6 — Gig mail variant of the mail item detail. Sits on the
//  shared `MailItemDetailShell` (P19); the body slot composes the
//  bidder profile, post summary, focal `BidCard`, and (while the bid
//  is open) the other-bids strip. The actions shelf is the three-way
//  Accept / Counter / Decline row in the open state, swapping to the
//  next-steps timeline + Open thread CTA once the recipient accepts.
//  Mirrors the Android `GigBody.kt` body composition so the two
//  platforms render the same gig surface.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

@MainActor
struct GigMailDetailLayout: View {
    let content: MailDetailContent
    let gig: GigDetailDTO
    let bidInFlight: Bool
    let onBack: @MainActor () -> Void
    let onAccept: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { GigHeroCard(content: content, gig: gig) },
            keyFacts: { GigKeyFactsCard(rows: makeKeyFacts()) },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    BidCard(bid: gig.bid, isAccepted: gig.isAccepted)
                    PostSummaryCard(post: gig.post)
                    BidderProfileCard(bidder: gig.bidder)
                    if gig.isAccepted {
                        GigMailNextStepsCard(steps: gig.nextSteps)
                    } else if !gig.otherBids.isEmpty {
                        OtherBidsStrip(bids: gig.otherBids)
                    }
                }
            },
            sender: { GigSenderCard(content: content, onOpenProfile: onOpenSenderProfile) },
            actions: {
                GigSplitDock(
                    isAccepted: gig.isAccepted,
                    amount: gig.bid.amount,
                    inFlight: bidInFlight,
                    onAccept: onAccept
                )
            }
        )
        .accessibilityIdentifier("mailDetail_gig")
    }

    // MARK: - Top bar

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Gig mail",
            trust: content.detailTrust,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save to vault"
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "openGig", icon: .briefcase, label: "Open gig thread") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "report", icon: .info, label: "Report bidder") {},
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {}
            ]
        )
    }

    // MARK: - AI elf

    private func makeAIElf() -> AIElfStripContent? {
        let headline: String
        let summary: String
        let bullets: [AIElfBullet]
        if gig.isAccepted {
            headline = "Bid accepted · funds held in escrow"
            summary = "Pantopus opened the thread, saved the date, and queued next-step nudges."
            bullets = [
                AIElfBullet(icon: .lock, label: "$\(gig.bid.amount) held in escrow", text: "released after the job"),
                AIElfBullet(icon: .messageCircle, label: "Chat thread opened", text: "you can chat now"),
                AIElfBullet(icon: .calendarClock, label: "Calendar saved", text: gig.bid.eta)
            ]
        } else {
            let otherBidCount = gig.otherBids.count
            headline = "Pantopus sized this bid up"
            summary = "Compare against \(otherBidCount) other bid\(otherBidCount == 1 ? "" : "s") on the same gig before you accept."
            bullets = [
                AIElfBullet(icon: .dollarSign, label: "$\(gig.bid.amount) \(gig.bid.unit)", text: nil),
                AIElfBullet(icon: .calendarClock, label: gig.bid.eta, text: nil),
                AIElfBullet(icon: .clock, label: gig.bid.expires, text: nil)
            ]
        }
        return AIElfStripContent(headline: headline, summary: summary, bullets: bullets)
    }

    // MARK: - Attachments

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .other, name: name)
        }
        return AttachmentsRowContent(items: items)
    }

    // MARK: - Key facts

    private func makeKeyFacts() -> [MailDetailKeyFact] {
        var rows: [MailDetailKeyFact] = []
        rows.append(
            MailDetailKeyFact(
                icon: .mapPin,
                label: "Where",
                value: gig.post.location.isEmpty ? "Pantopus mailbox" : gig.post.location
            )
        )
        rows.append(
            MailDetailKeyFact(
                icon: .calendarDays,
                label: "When",
                value: gig.post.schedule.isEmpty ? gig.bid.eta : gig.post.schedule
            )
        )
        rows.append(MailDetailKeyFact(icon: .briefcase, label: "Category", value: gig.post.categoryLabel))
        return rows
    }
}

// MARK: - Hero

private struct GigHeroCard: View {
    let content: MailDetailContent
    let gig: GigDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                CategoryBadge(category: content.category)
                Spacer()
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Text(content.senderDisplayName.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(content.title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            payoutBlock
            if gig.isAccepted {
                acceptedPill
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(content.category.accent).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var payoutBlock: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
            Text("ESTIMATED PAYOUT")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            Text("$\(gig.bid.amount)")
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Theme.Color.appTextStrong)
            Text("· \(gig.bid.unit)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_gig_estimatedPayout")
    }

    private var acceptedPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 13, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Theme.Color.success)
                .clipShape(Circle())
            Text("Bid accepted · $\(gig.bid.amount)")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_gig_acceptedPill")
    }
}

private struct CategoryBadge: View {
    let category: MailItemCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 11, color: category.accent)
            Text(category.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(category.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(category.rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

// MARK: - Key facts

private struct GigKeyFactsCard: View {
    let rows: [MailDetailKeyFact]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("KEY FACTS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                HStack(alignment: .top, spacing: Spacing.s3) {
                    Icon(row.icon, size: 13, color: Theme.Color.appTextStrong)
                        .frame(width: 24, height: 24)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(row.label.uppercased())
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.4)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(row.value)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    Spacer(minLength: Spacing.s0)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                if index < rows.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_gig_keyFacts")
    }
}

// MARK: - Next-steps timeline (accepted state)

private struct GigMailNextStepsCard: View {
    let steps: [GigDetailDTO.NextStep]

    var body: some View {
        GigCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                GigSectionLabel(text: "WHAT HAPPENS NEXT")
                TimelineStepper(steps: steps.map(Self.timelineStep))
            }
        }
        .accessibilityIdentifier("mailDetail_gig_nextSteps")
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

// MARK: - Sender

private struct GigSenderCard: View {
    let content: MailDetailContent
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(content.senderInitials)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: 44, height: 44)
                .background(content.category.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            VStack(alignment: .leading, spacing: 2) {
                Text(content.senderDisplayName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let meta = content.senderMeta {
                    Text(meta)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            if onOpenProfile != nil, content.senderUserId != nil {
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(Spacing.s3)
        .contentShape(Rectangle())
        .onTapGesture {
            if let onOpenProfile, let userId = content.senderUserId {
                onOpenProfile(userId)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

// MARK: - Accept / Decline split dock

private struct GigSplitDock: View {
    let isAccepted: Bool
    let amount: Int
    let inFlight: Bool
    let onAccept: @MainActor () -> Void

    var body: some View {
        if isAccepted {
            acceptedShelf
        } else {
            actionRow
        }
    }

    private var acceptedShelf: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 16, color: Theme.Color.success)
            Text("Bid accepted · funds in escrow")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.Color.success)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.successLight, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_gig_acceptedShelf")
    }

    private var actionRow: some View {
        HStack(spacing: Spacing.s2) {
            primaryButton(
                icon: .check,
                label: "Accept · $\(amount)",
                identifier: "mailDetail_gig_accept",
                action: onAccept
            )
            secondaryButton(
                icon: .arrowsRepeat,
                label: "Counter",
                kind: .ghost,
                identifier: "mailDetail_gig_counter"
            )
            secondaryButton(
                icon: .x,
                label: "Decline",
                kind: .destructive,
                identifier: "mailDetail_gig_decline"
            )
        }
    }

    private func primaryButton(
        icon: PantopusIcon,
        label: String,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: { action() }) {
            HStack(spacing: 5) {
                Icon(icon, size: 14, color: Theme.Color.appTextInverse)
                Text(label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.Color.appTextInverse)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.success)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .opacity(inFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(inFlight)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
    }

    private enum SecondaryKind { case ghost, destructive }

    private func secondaryButton(
        icon: PantopusIcon,
        label: String,
        kind: SecondaryKind,
        identifier: String
    ) -> some View {
        let foreground = kind == .ghost ? Theme.Color.appText : Theme.Color.appTextInverse
        let background = kind == .ghost ? Theme.Color.appSurface : Theme.Color.error
        return Button(action: {}) {
            HStack(spacing: 5) {
                Icon(icon, size: 14, color: foreground)
                Text(label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.vertical, Spacing.s2)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(kind == .ghost ? Theme.Color.appBorder : Color.clear, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
    }
}
