//
//  GigLifecycleSections.swift
//  Pantopus
//
//  Phase 5/5b — gig detail lifecycle chrome: the owner's interactive bids
//  panel (accept / counter / reject), the active-task phase strip with
//  role-gated actions + running-late badge, the change-orders card, the
//  owner's payment card, the post-completion review CTA, and the counter /
//  report / cancel / reschedule / no-show / running-late / change-order
//  sheets. All sections render inside `GigDetailView`'s scroll footer; the
//  view-model owns every mutation.
//

// swiftlint:disable file_length

import SwiftUI

// MARK: - Owner bids panel

/// Interactive bids list for the poster while the gig is open. Replaces
/// the read-only `.bids` module (suppressed in the projection).
struct GigOwnerBidsPanel: View {
    let bids: [GigBidDTO]
    let inFlightBidId: String?
    let onAccept: @MainActor (GigBidDTO) -> Void
    let onCounter: @MainActor (GigBidDTO) -> Void
    let onReject: @MainActor (GigBidDTO) -> Void
    /// Poster pulls back the counter they sent (`/counter/withdraw`).
    /// Mirrors RN's "Withdraw Counter" (`OffersPanel.tsx:475`).
    var onWithdrawCounter: @MainActor (GigBidDTO) -> Void = { _ in }
    /// Server ranking per bid id, present only when the list came from
    /// `GET /api/v2/gigs/:gigId/offers`. Empty on the `/bids` fallback,
    /// which renders exactly as before.
    var rankings: [String: GigOfferRanking] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Bids (\(bids.count))")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            if bids.isEmpty {
                emptyCard
            } else {
                ForEach(bids) { bid in
                    bidCard(bid)
                }
            }
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.bids")
    }

    private var emptyCard: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.handCoins, size: 24, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            Text("No bids yet")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Neighbors usually bid within the first few hours.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1.5, dash: [5]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("gigDetail.bids.empty")
    }

    private func bidCard(_ bid: GigBidDTO) -> some View {
        let status = (bid.status ?? "pending").lowercased()
        let rejected = status == "rejected"
        let inFlight = inFlightBidId == bid.id
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            headerRow(bid)
            if let message = bid.message, !message.isEmpty {
                Text(message)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(4)
            }
            statusOrActions(bid, status: status, inFlight: inFlight)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .opacity(rejected ? 0.55 : 1)
        .accessibilityIdentifier("gigDetail.bid_\(bid.id)")
    }

    private func headerRow(_ bid: GigBidDTO) -> some View {
        let name = bid.bidder?.resolvedDisplayName ?? "Bidder"
        return HStack(spacing: Spacing.s2) {
            BidderAvatar(
                initials: GigDetailViewModel.initialsFromName(name),
                verified: bid.bidder?.resolvedVerified ?? false,
                imageUrl: bid.bidder?.resolvedAvatarURL
            )
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Spacing.s1) {
                    Text(name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if bid.bidder?.resolvedVerified == true {
                        Icon(.shieldCheck, size: 12, strokeWidth: 2.4, color: Theme.Color.primary600)
                    }
                }
                if let age = Self.relativeAge(bid.createdAt) {
                    Text("bid \(age) ago")
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let trust = rankings[bid.id]?.trustLine {
                    Text(trust)
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("gigDetail.bid_\(bid.id).trust")
                }
            }
            Spacer(minLength: Spacing.s2)
            if rankings[bid.id]?.isRecommended == true {
                Text("BEST MATCH")
                    .font(.system(size: 9, weight: .bold))
                    .kerning(0.5)
                    .foregroundStyle(Theme.Color.primary700)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(Theme.Color.primary50)
                    .clipShape(Capsule())
                    .accessibilityIdentifier("gigDetail.bid_\(bid.id).bestMatch")
            }
            Text(Self.amountLabel(bid.bidAmount ?? bid.amount ?? 0))
                .font(.system(size: 15, weight: .heavy).monospacedDigit())
                .foregroundStyle(Theme.Color.primary600)
        }
    }

    @ViewBuilder
    private func statusOrActions(_ bid: GigBidDTO, status: String, inFlight: Bool) -> some View {
        if status == "countered" {
            statusPill(
                label: "Countered \(Self.amountLabel(bid.counterAmount ?? 0))",
                icon: .arrowsRepeat,
                fg: Theme.Color.primary700,
                bg: Theme.Color.primary50
            )
            // RN keeps the poster in control while the bidder mulls it
            // over: the counter can be pulled back and the bid reverts to
            // its original amount (`OffersPanel.tsx:443`).
            if (bid.counterStatus ?? "").lowercased() == "pending" {
                Text("Waiting for the bidder to respond to your counter.")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                panelButton(
                    "Withdraw counter",
                    icon: .undo2,
                    style: .outline,
                    identifier: "gigDetail.bid_\(bid.id).withdrawCounter"
                ) { onWithdrawCounter(bid) }
                    .disabled(inFlight)
                    .opacity(inFlight ? 0.6 : 1)
            }
        } else if status == "rejected" {
            statusPill(label: "Rejected", icon: .x, fg: Theme.Color.appTextSecondary, bg: Theme.Color.appSurfaceSunken)
        } else if status == "pending" {
            actionRow(bid, inFlight: inFlight)
        }
    }

    private func actionRow(_ bid: GigBidDTO, inFlight: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            panelButton(
                "Accept",
                icon: .check,
                style: .primary,
                identifier: "gigDetail.bid_\(bid.id).accept"
            ) { onAccept(bid) }
            panelButton(
                "Counter",
                icon: .arrowsRepeat,
                style: .outline,
                identifier: "gigDetail.bid_\(bid.id).counter"
            ) { onCounter(bid) }
            panelButton(
                "Reject",
                icon: .x,
                style: .destructive,
                identifier: "gigDetail.bid_\(bid.id).reject"
            ) { onReject(bid) }
        }
        .disabled(inFlight)
        .opacity(inFlight ? 0.6 : 1)
    }

    private func statusPill(label: String, icon: PantopusIcon, fg: Color, bg: Color) -> some View {
        HStack(spacing: 5) {
            Icon(icon, size: 11, strokeWidth: 2.4, color: fg)
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(fg)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(bg)
        .clipShape(Capsule())
    }

    private enum PanelButtonStyle { case primary, outline, destructive }

    private func panelButton(
        _ title: String,
        icon: PantopusIcon,
        style: PanelButtonStyle,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        let fg: Color = switch style {
        case .primary: Theme.Color.appTextInverse
        case .outline: Theme.Color.primary600
        case .destructive: Theme.Color.error
        }
        let bg: Color = switch style {
        case .primary: Theme.Color.primary600
        case .outline: Theme.Color.primary50
        case .destructive: Theme.Color.errorBg
        }
        return Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 12, strokeWidth: 2.4, color: fg)
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(fg)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    static func amountLabel(_ amount: Double) -> String {
        amount.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(amount))"
            : String(format: "$%.2f", amount)
    }

    static func relativeAge(_ timestamp: String?) -> String? {
        guard let timestamp else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp)
        guard let date else { return nil }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "moments" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        return "\(Int(interval / 86400))d"
    }
}

/// Initials disc + optional photo + verified badge for bid rows.
private struct BidderAvatar: View {
    let initials: String
    let verified: Bool
    var imageUrl: URL?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let imageUrl {
                    AsyncImage(url: imageUrl) { phase in
                        if case let .success(image) = phase {
                            image.resizable().scaledToFill()
                        } else {
                            initialsCircle
                        }
                    }
                } else {
                    initialsCircle
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())
            if verified {
                ZStack {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 13, height: 13)
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 1.5))
                    Icon(.check, size: 7, strokeWidth: 3, color: Theme.Color.appTextInverse)
                }
                .offset(x: 2, y: 2)
            }
        }
    }

    private var initialsCircle: some View {
        Circle()
            .fill(Theme.Color.primary500)
            .overlay(
                Text(initials.isEmpty ? "?" : initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            )
    }
}

// MARK: - Active-task panel

/// Phase strip (Assigned → In progress → Marked done → Confirmed) plus
/// the role-gated lifecycle actions.
struct GigActiveTaskPanel: View {
    let phase: GigActivePhase
    let showWorkerAck: Bool
    let canStartTask: Bool
    let canConfirmCompletion: Bool
    let noShowEligible: Bool
    /// "Running ~X min late" copy — non-nil renders the late badge for
    /// both roles (Phase 5b).
    var runningLateLabel: String?
    /// Worker-only "Running late" secondary action (Phase 5b).
    var canReportRunningLate: Bool = false
    /// Worker-only "Can't make it" self-release — assigned, pre-start
    /// (`POST /worker-release`).
    var canReleaseAssignment: Bool = false
    /// Poster-only "Remind worker" nudge — assigned, pre-start
    /// (`POST /remind-worker`).
    var canRemindWorker: Bool = false
    /// End of the server's 15-minute reminder cooldown. `nil` (or a past
    /// date) means a reminder can be sent right now; the button ticks its
    /// own countdown off this via `TimelineView`.
    var reminderCooldownEnds: Date?
    let onWorkerAck: @MainActor () -> Void
    let onStartTask: @MainActor () -> Void
    let onConfirmCompletion: @MainActor () -> Void
    let onReportNoShow: @MainActor () -> Void
    var onRunningLate: @MainActor () -> Void = {}
    var onCantMakeIt: @MainActor () -> Void = {}
    var onRemindWorker: @MainActor () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Task progress")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            phaseStrip
            if let runningLateLabel {
                lateBadge(runningLateLabel)
            }
            actions
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.activePanel")
    }

    private var phaseStrip: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(GigActivePhase.allCases, id: \.rawValue) { step in
                let reached = step <= phase
                VStack(spacing: Spacing.s1) {
                    ZStack {
                        Circle()
                            .fill(reached ? Theme.Color.success : Theme.Color.appSurfaceSunken)
                            .frame(width: 18, height: 18)
                        if reached {
                            Icon(.check, size: 9, strokeWidth: 3, color: Theme.Color.appTextInverse)
                        }
                    }
                    Text(step.label)
                        .font(.system(size: 9, weight: reached ? .bold : .medium))
                        .foregroundStyle(reached ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
                if step != GigActivePhase.allCases.last {
                    Rectangle()
                        .fill(step < phase ? Theme.Color.success : Theme.Color.appBorder)
                        .frame(height: 2)
                        .frame(maxWidth: 24)
                        .padding(.bottom, 14)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Task phase: \(phase.label)")
    }

    /// Warning pill under the phase strip while the worker's
    /// `running_late` ack stands — visible to both roles.
    private func lateBadge(_ label: String) -> some View {
        HStack(spacing: 6) {
            Icon(.clock, size: 13, strokeWidth: 2.4, color: Theme.Color.warning)
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.warning)
            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("gigDetail.lateBadge")
    }

    @ViewBuilder private var actions: some View {
        if showWorkerAck {
            actionButton(
                "I'm on it",
                icon: .megaphone,
                identifier: "gigDetail.workerAck",
                action: onWorkerAck
            )
        }
        if canReportRunningLate {
            Button(action: onRunningLate) {
                HStack(spacing: 6) {
                    Icon(.clock, size: 14, strokeWidth: 2.2, color: Theme.Color.warning)
                    Text("Running late")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(Theme.Color.warningBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigDetail.runningLate")
        }
        if canStartTask {
            actionButton(
                "Start task",
                icon: .play,
                identifier: "gigDetail.startTask",
                action: onStartTask
            )
        }
        if canRemindWorker {
            // The countdown ticks itself so the button re-enables the
            // moment the server's window lapses (RN ticks every 15s).
            TimelineView(.periodic(from: .now, by: 15)) { context in
                remindButton(now: context.date)
            }
            Text("Nudges the worker to begin. You can send one every 15 minutes.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        if canConfirmCompletion {
            actionButton(
                "Confirm completion",
                icon: .checkCheck,
                identifier: "gigDetail.confirmCompletion",
                action: onConfirmCompletion
            )
        }
        if noShowEligible {
            Button(action: onReportNoShow) {
                HStack(spacing: 6) {
                    Icon(.alertTriangle, size: 14, strokeWidth: 2.2, color: Theme.Color.error)
                    Text("Report no-show")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.error)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigDetail.noShow")
        }
        if canReleaseAssignment {
            Button(action: onCantMakeIt) {
                HStack(spacing: 6) {
                    Icon(.xCircle, size: 14, strokeWidth: 2.2, color: Theme.Color.error)
                    Text("Can't make it")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.error)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigDetail.cantMakeIt")
            Text("Releases you and reopens the task for new bids.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    /// "Remind worker" / "Sent · retry in 12m" — disabled while the
    /// server's 15-minute cooldown stands.
    private func remindButton(now: Date) -> some View {
        let remaining = reminderCooldownEnds.flatMap {
            GigDetailViewModel.cooldownRemaining(until: $0, now: now)
        }
        let onCooldown = remaining != nil
        return Button(action: onRemindWorker) {
            HStack(spacing: 6) {
                Icon(
                    .bell,
                    size: 14,
                    strokeWidth: 2.2,
                    color: onCooldown ? Theme.Color.appTextMuted : Theme.Color.appTextInverse
                )
                Text(remaining.map { "Sent · retry in \($0)" } ?? "Remind worker")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(onCooldown ? Theme.Color.appTextMuted : Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(onCooldown ? Theme.Color.appSurfaceSunken : Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(onCooldown)
        .accessibilityIdentifier("gigDetail.remindWorker")
    }

    private func actionButton(
        _ title: String,
        icon: PantopusIcon,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Icon(icon, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                Text(title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Review section

/// Post-completion review CTA / "Reviewed ✓" settled state.
struct GigReviewSection: View {
    let reviewSubmitted: Bool
    let revieweeName: String?
    let onLeaveReview: @MainActor () -> Void

    var body: some View {
        Group {
            if reviewSubmitted {
                HStack(spacing: Spacing.s2) {
                    Icon(.checkCheck, size: 16, strokeWidth: 2.4, color: Theme.Color.success)
                    Text("Reviewed ✓")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.success)
                    Spacer()
                }
                .padding(Spacing.s3)
                .background(Theme.Color.successBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .accessibilityIdentifier("gigDetail.review.done")
            } else {
                Button(action: onLeaveReview) {
                    HStack(spacing: 6) {
                        Icon(.star, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                        Text(revieweeName.map { "Leave a review for \($0)" } ?? "Leave a review")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigDetail.review")
            }
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
    }
}

// MARK: - Counter sheet

/// Presentation target for the counter-offer sheet.
struct GigCounterSheetTarget: Identifiable {
    let id: String
    let bid: GigBidDTO

    var bidderName: String {
        bid.bidder?.resolvedDisplayName ?? "this bidder"
    }

    var bidAmount: Double {
        bid.bidAmount ?? bid.amount ?? 0
    }
}

/// Amount + optional message → `POST .../bids/:bidId/counter`.
struct GigCounterSheet: View {
    let target: GigCounterSheetTarget
    let onSubmit: @MainActor (Double, String?) async -> String?
    let onDismiss: @MainActor () -> Void

    @State private var amountText = ""
    @State private var messageText = ""
    @State private var submitting = false
    @State private var errorText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Send a counter-offer")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("\(target.bidderName) bid \(GigOwnerBidsPanel.amountLabel(target.bidAmount)). Suggest your price.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Counter amount")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s2) {
                    Text("$")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    TextField("0", text: $amountText)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityIdentifier("gigDetail.counterSheet.amount")
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Message (optional)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("Why this price works", text: $messageText, axis: .vertical)
                    .lineLimit(2...4)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityIdentifier("gigDetail.counterSheet.message")
            }
            if let errorText {
                Text(errorText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
            }
            HStack(spacing: Spacing.s2) {
                SheetButton(title: "Cancel", style: .ghost, identifier: "gigDetail.counterSheet.cancel") {
                    onDismiss()
                }
                SheetButton(
                    title: submitting ? "Sending…" : "Send counter",
                    style: .primary,
                    enabled: parsedAmount != nil && !submitting,
                    identifier: "gigDetail.counterSheet.submit"
                ) {
                    Task { await submit() }
                }
            }
        }
        .padding(Spacing.s5)
        .presentationDetents([.height(380)])
        .accessibilityIdentifier("gigDetail.counterSheet")
    }

    private var parsedAmount: Double? {
        let cleaned = amountText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
        guard let value = Double(cleaned), value > 0 else { return nil }
        return value
    }

    private func submit() async {
        guard let amount = parsedAmount, !submitting else { return }
        submitting = true
        defer { submitting = false }
        let trimmed = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error = await onSubmit(amount, trimmed.isEmpty ? nil : trimmed) {
            errorText = error
        } else {
            onDismiss()
        }
    }
}

// MARK: - Report sheet

/// Reason radio list (+ optional details) → `POST /:gigId/report`.
struct GigReportSheet: View {
    let onSubmit: @MainActor (GigReportReason, String?) async -> Void
    let onDismiss: @MainActor () -> Void

    @State private var selected: GigReportReason?
    @State private var detailsText = ""
    @State private var submitting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Report this task")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Tell us what's wrong. Reports are reviewed by the moderation team.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                VStack(spacing: Spacing.s2) {
                    ForEach(GigReportReason.allCases, id: \.rawValue) { reason in
                        RadioRow(
                            label: reason.label,
                            selected: selected == reason,
                            identifier: "gigDetail.reportSheet.reason_\(reason.rawValue)"
                        ) { selected = reason }
                    }
                }
                TextField("Details (optional)", text: $detailsText, axis: .vertical)
                    .lineLimit(2...4)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityIdentifier("gigDetail.reportSheet.details")
                HStack(spacing: Spacing.s2) {
                    SheetButton(title: "Cancel", style: .ghost, identifier: "gigDetail.reportSheet.cancel") {
                        onDismiss()
                    }
                    SheetButton(
                        title: submitting ? "Reporting…" : "Submit report",
                        style: .destructive,
                        enabled: selected != nil && !submitting,
                        identifier: "gigDetail.reportSheet.submit"
                    ) {
                        guard let selected else { return }
                        Task {
                            submitting = true
                            let trimmed = detailsText.trimmingCharacters(in: .whitespacesAndNewlines)
                            await onSubmit(selected, trimmed.isEmpty ? nil : String(trimmed.prefix(1000)))
                            submitting = false
                        }
                    }
                }
            }
            .padding(Spacing.s5)
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("gigDetail.reportSheet")
    }
}

// MARK: - Cancel sheet

/// Fee-preview + reason radios → `POST /:gigId/cancel`. The preview is
/// fetched before presentation; `nil` falls back to generic copy.
struct GigCancelSheet: View {
    let preview: GigCancellationPreview?
    /// Phase 6b — non-nil when the viewer is the poster of an `assigned`
    /// gig; combined with the preview's `can_reschedule` it surfaces the
    /// "Reschedule instead" path (→ `POST /:gigId/reschedule`).
    var onReschedule: (@MainActor () -> Void)?
    let onConfirm: @MainActor (CancelGigReason?) async -> Void
    let onDismiss: @MainActor () -> Void

    @State private var selected: CancelGigReason?
    @State private var submitting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Cancel this task?")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let zoneLabel = preview?.zoneLabel {
                        Text(zoneLabel)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                feeCard
                VStack(spacing: Spacing.s2) {
                    ForEach(CancelGigReason.allCases, id: \.rawValue) { reason in
                        RadioRow(
                            label: reason.label,
                            selected: selected == reason,
                            identifier: "gigDetail.cancelSheet.reason_\(reason.rawValue)"
                        ) { selected = reason }
                    }
                }
                if preview?.canReschedule == true, let onReschedule {
                    Button(action: onReschedule) {
                        HStack(spacing: 6) {
                            Icon(.calendar, size: 14, strokeWidth: 2.2, color: Theme.Color.primary600)
                            Text("Reschedule instead")
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundStyle(Theme.Color.primary600)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigDetail.reschedule")
                }
                HStack(spacing: Spacing.s2) {
                    SheetButton(title: "Keep task", style: .ghost, identifier: "gigDetail.cancelSheet.dismiss") {
                        onDismiss()
                    }
                    SheetButton(
                        title: submitting ? "Cancelling…" : "Cancel task",
                        style: .destructive,
                        enabled: !submitting,
                        identifier: "gigDetail.cancelSheet.confirm"
                    ) {
                        Task {
                            submitting = true
                            await onConfirm(selected)
                            submitting = false
                        }
                    }
                }
            }
            .padding(Spacing.s5)
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("gigDetail.cancelSheet")
    }

    private var feeCard: some View {
        let fee = preview?.fee ?? 0
        let free = fee <= 0
        let copy: String = if free, preview?.inGrace == true {
            "Free to cancel — you're in the grace period."
        } else if free {
            "Free to cancel."
        } else {
            "Cancelling now costs \(GigOwnerBidsPanel.amountLabel(fee))."
        }
        return HStack(spacing: Spacing.s2) {
            Icon(
                free ? .check : .alertTriangle,
                size: 15,
                strokeWidth: 2.4,
                color: free ? Theme.Color.success : Theme.Color.warning
            )
            Text(copy)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(free ? Theme.Color.success : Theme.Color.warning)
            Spacer()
        }
        .padding(Spacing.s3)
        .background(free ? Theme.Color.successBg : Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("gigDetail.cancelSheet.fee")
    }
}

// MARK: - Phase 6b — reschedule sheet

/// Future-only date+time picker + optional note →
/// `POST /:gigId/reschedule`. Reached from the cancel sheet's
/// "Reschedule instead" button (poster, assigned gig, zone <= 1).
struct GigRescheduleSheet: View {
    let onSubmit: @MainActor (Date, String?) async -> String?
    let onDismiss: @MainActor () -> Void

    @State private var newStart = Self.defaultStart()
    @State private var noteText = ""
    @State private var submitting = false
    @State private var errorText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Reschedule this task")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Pick a new start time. Your helper is notified and their \"on my way\" status resets.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            DatePicker(
                "New start",
                selection: $newStart,
                in: Date.now...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.compact)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Theme.Color.appText)
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("gigDetail.rescheduleSheet.date")
            TextField("Add a note for your helper (optional)", text: $noteText, axis: .vertical)
                .lineLimit(2...3)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appText)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("gigDetail.rescheduleSheet.note")
            if let errorText {
                Text(errorText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
            }
            HStack(spacing: Spacing.s2) {
                SheetButton(title: "Back", style: .ghost, identifier: "gigDetail.rescheduleSheet.cancel") {
                    onDismiss()
                }
                SheetButton(
                    title: submitting ? "Rescheduling…" : "Reschedule task",
                    style: .primary,
                    enabled: !submitting && newStart > Date.now,
                    identifier: "gigDetail.rescheduleSheet.confirm"
                ) {
                    Task { await submit() }
                }
            }
        }
        .padding(Spacing.s5)
        .presentationDetents([.height(360)])
        .accessibilityIdentifier("gigDetail.rescheduleSheet")
    }

    /// Top of the next hour, at least an hour out — a sane future default
    /// that already satisfies the backend's future-only validation.
    private static func defaultStart() -> Date {
        let inAnHour = Date.now.addingTimeInterval(3600)
        return Calendar.current.date(bySetting: .minute, value: 0, of: inAnHour) ?? inAnHour
    }

    private func submit() async {
        guard !submitting else { return }
        submitting = true
        defer { submitting = false }
        let trimmed = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error = await onSubmit(newStart, trimmed.isEmpty ? nil : trimmed) {
            errorText = error
        } else {
            onDismiss()
        }
    }
}

// MARK: - No-show sheet

/// Confirmation + optional description → `POST /:gigId/report-no-show`.
/// Either party can report — `counterpartyLabel` keeps the copy honest
/// ("worker" for the poster, "poster" for the worker).
struct GigNoShowSheet: View {
    var counterpartyLabel: String = "worker"
    let onConfirm: @MainActor (String?) async -> Void
    let onDismiss: @MainActor () -> Void

    @State private var descriptionText = ""
    @State private var submitting = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Report a no-show")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(
                    "This cancels the task and affects the \(counterpartyLabel)'s reliability score. "
                        + "Only report if they truly didn't show."
                )
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
            TextField("What happened? (optional)", text: $descriptionText, axis: .vertical)
                .lineLimit(2...4)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appText)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("gigDetail.noShowSheet.description")
            HStack(spacing: Spacing.s2) {
                SheetButton(title: "Back", style: .ghost, identifier: "gigDetail.noShowSheet.cancel") {
                    onDismiss()
                }
                SheetButton(
                    title: submitting ? "Reporting…" : "Report no-show",
                    style: .destructive,
                    enabled: !submitting,
                    identifier: "gigDetail.noShowSheet.confirm"
                ) {
                    Task {
                        submitting = true
                        let trimmed = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                        await onConfirm(trimmed.isEmpty ? nil : trimmed)
                        submitting = false
                    }
                }
            }
        }
        .padding(Spacing.s5)
        .presentationDetents([.height(320)])
        .accessibilityIdentifier("gigDetail.noShowSheet")
    }
}

// MARK: - Phase 5b — payment card

/// Compact owner-side payment summary from `GET /:gigId/payment`:
/// status chip + subtotal / fees / tip / total (amounts arrive in cents).
struct GigPaymentCard: View {
    let payment: GigPaymentDTO
    let stateInfo: GigPaymentStateInfo?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(.creditCard, size: 16, strokeWidth: 2, color: Theme.Color.appText)
                Text("Payment")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                statusChip
            }
            VStack(spacing: Spacing.s2) {
                if let subtotal = payment.amountSubtotal {
                    row(label: "Subtotal", cents: subtotal)
                }
                if let fee = payment.amountPlatformFee, fee > 0 {
                    row(label: "Service fee", cents: fee)
                }
                if let tip = payment.tipAmount, tip > 0 {
                    row(label: "Tip", cents: tip)
                }
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
                totalRow
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.payment")
    }

    /// `stateInfo.label` ("Authorized", "Payment Captured", …) tinted by
    /// the backend's tone; falls back to a humanized raw status.
    private var statusChip: some View {
        let label = stateInfo?.label
            ?? (payment.paymentStatus ?? "Pending").replacingOccurrences(of: "_", with: " ").capitalized
        let tone = Self.chipTone(stateInfo?.color)
        return Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(tone.fg)
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s1)
            .background(tone.bg)
            .clipShape(Capsule())
    }

    /// Total = what the poster pays + any net tip (tips ride separate
    /// Payment rows server-side).
    private var totalRow: some View {
        let total = (payment.amountTotal ?? 0) + (payment.tipAmount ?? 0)
        return HStack {
            Text("Total")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Text(Self.centsLabel(total))
                .font(.system(size: 15, weight: .heavy).monospacedDigit())
                .foregroundStyle(Theme.Color.appText)
        }
        .accessibilityIdentifier("gigDetail.payment.total")
    }

    private func row(label: String, cents: Double) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(Self.centsLabel(cents))
                .font(.system(size: 12.5, weight: .semibold).monospacedDigit())
                .foregroundStyle(Theme.Color.appTextStrong)
        }
    }

    static func centsLabel(_ cents: Double) -> String {
        String(format: "$%.2f", cents / 100)
    }

    /// Map the backend's `stateInfo.color` to theme tones.
    static func chipTone(_ color: String?) -> (fg: Color, bg: Color) {
        switch color {
        case "green": (Theme.Color.success, Theme.Color.successBg)
        case "yellow", "orange": (Theme.Color.warning, Theme.Color.warningBg)
        case "blue": (Theme.Color.info, Theme.Color.infoBg)
        case "red": (Theme.Color.error, Theme.Color.errorBg)
        default: (Theme.Color.appTextSecondary, Theme.Color.appSurfaceSunken)
        }
    }
}

// MARK: - Phase 5b — change orders

/// "Changes" card under the active-task panel: one row per change order
/// (type · description · ±$ · status) with role-gated actions, plus the
/// "Propose a change" footer.
struct GigChangesCard: View {
    let orders: [GigChangeOrderDTO]
    let inFlightOrderId: String?
    /// `true` when the signed-in viewer proposed the order (→ Withdraw);
    /// otherwise the viewer is the counterparty (→ Approve / Reject).
    let isOwnOrder: @MainActor (GigChangeOrderDTO) -> Bool
    let onApprove: @MainActor (GigChangeOrderDTO) -> Void
    let onReject: @MainActor (GigChangeOrderDTO) -> Void
    let onWithdraw: @MainActor (GigChangeOrderDTO) -> Void
    let onPropose: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(.arrowsRepeat, size: 16, strokeWidth: 2, color: Theme.Color.appText)
                Text("Changes")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
            }
            if orders.isEmpty {
                Text("No changes proposed yet. Need a different price or more time? Propose it here.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                ForEach(orders) { order in
                    orderRow(order)
                }
            }
            proposeButton
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.changes")
    }

    private func orderRow(_ order: GigChangeOrderDTO) -> some View {
        let status = (order.status ?? "pending").lowercased()
        let inFlight = inFlightOrderId == order.id
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(Self.typeLabel(order.type))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let delta = Self.deltaLabel(order) {
                    Text(delta)
                        .font(.system(size: 13, weight: .heavy).monospacedDigit())
                        .foregroundStyle((order.amountChange ?? 0) < 0 ? Theme.Color.success : Theme.Color.primary600)
                }
                Spacer()
                statusChip(status)
            }
            if let description = order.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(3)
            }
            if status == "pending" {
                pendingActions(order, inFlight: inFlight)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .opacity(["rejected", "withdrawn"].contains(status) ? 0.55 : 1)
        .accessibilityIdentifier("gigDetail.change_\(order.id)")
    }

    private func pendingActions(_ order: GigChangeOrderDTO, inFlight: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            if isOwnOrder(order) {
                rowButton(
                    "Withdraw",
                    icon: .x,
                    style: .muted,
                    identifier: "gigDetail.change_\(order.id).withdraw"
                ) { onWithdraw(order) }
            } else {
                rowButton(
                    "Approve",
                    icon: .check,
                    style: .primary,
                    identifier: "gigDetail.change_\(order.id).approve"
                ) { onApprove(order) }
                rowButton(
                    "Reject",
                    icon: .x,
                    style: .destructive,
                    identifier: "gigDetail.change_\(order.id).reject"
                ) { onReject(order) }
            }
        }
        .disabled(inFlight)
        .opacity(inFlight ? 0.6 : 1)
    }

    private var proposeButton: some View {
        Button(action: onPropose) {
            HStack(spacing: 6) {
                Icon(.plus, size: 14, strokeWidth: 2.4, color: Theme.Color.primary600)
                Text("Propose a change")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigDetail.changes.propose")
    }

    private enum RowButtonStyle {
        case primary, destructive, muted

        var fg: Color {
            switch self {
            case .primary: Theme.Color.appTextInverse
            case .destructive: Theme.Color.error
            case .muted: Theme.Color.appTextSecondary
            }
        }

        var bg: Color {
            switch self {
            case .primary: Theme.Color.primary600
            case .destructive: Theme.Color.errorBg
            case .muted: Theme.Color.appSurfaceSunken
            }
        }
    }

    private func rowButton(
        _ title: String,
        icon: PantopusIcon,
        style: RowButtonStyle,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 12, strokeWidth: 2.4, color: style.fg)
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(style.fg)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(style.bg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func statusChip(_ status: String) -> some View {
        let label: String = switch status {
        case "approved": "Approved"
        case "rejected": "Rejected"
        case "withdrawn": "Withdrawn"
        default: "Pending"
        }
        let tone: (fg: Color, bg: Color) = switch status {
        case "approved": (Theme.Color.success, Theme.Color.successBg)
        case "rejected": (Theme.Color.error, Theme.Color.errorBg)
        case "withdrawn": (Theme.Color.appTextSecondary, Theme.Color.appSurfaceSunken)
        default: (Theme.Color.warning, Theme.Color.warningBg)
        }
        return Text(label)
            .font(.system(size: 10.5, weight: .bold))
            .foregroundStyle(tone.fg)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(tone.bg)
            .clipShape(Capsule())
    }

    static func typeLabel(_ raw: String?) -> String {
        guard let raw, let type = GigChangeOrderType(rawValue: raw) else {
            return (raw ?? "change").replacingOccurrences(of: "_", with: " ").capitalized
        }
        return type.label
    }

    /// "±$X" (+ "·+Ymin" when a time delta rides along).
    static func deltaLabel(_ order: GigChangeOrderDTO) -> String? {
        var pieces: [String] = []
        if let amount = order.amountChange, amount != 0 {
            let sign = amount < 0 ? "−" : "+"
            pieces.append("\(sign)\(GigOwnerBidsPanel.amountLabel(abs(amount)))")
        }
        if let minutes = order.timeChangeMinutes, minutes != 0 {
            pieces.append("+\(minutes) min")
        }
        return pieces.isEmpty ? nil : pieces.joined(separator: " · ")
    }
}

/// Propose-a-change sheet: type chips, description, signed dollar delta,
/// optional extra minutes → `POST /:gigId/change-orders`.
struct GigChangeOrderSheet: View {
    let onSubmit: @MainActor (GigChangeOrderType, String, Double?, Int?) async -> String?
    let onDismiss: @MainActor () -> Void

    @State private var type: GigChangeOrderType = .priceIncrease
    @State private var descriptionText = ""
    @State private var amountText = ""
    @State private var amountIsDecrease = false
    @State private var minutesText = ""
    @State private var submitting = false
    @State private var errorText: String?

    private let typeColumns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Propose a change")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("The other party has to approve before it takes effect.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                typePicker
                descriptionField
                amountField
                minutesField
                if let errorText {
                    Text(errorText)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.error)
                }
                HStack(spacing: Spacing.s2) {
                    SheetButton(title: "Cancel", style: .ghost, identifier: "gigDetail.changeSheet.cancel") {
                        onDismiss()
                    }
                    SheetButton(
                        title: submitting ? "Sending…" : "Send request",
                        style: .primary,
                        enabled: isValid && !submitting,
                        identifier: "gigDetail.changeSheet.submit"
                    ) {
                        Task { await submit() }
                    }
                }
            }
            .padding(Spacing.s5)
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("gigDetail.changeSheet")
    }

    private var typePicker: some View {
        LazyVGrid(columns: typeColumns, spacing: Spacing.s2) {
            ForEach(GigChangeOrderType.allCases, id: \.rawValue) { candidate in
                let selected = type == candidate
                Button {
                    type = candidate
                    amountIsDecrease = candidate == .priceDecrease || candidate == .scopeReduction
                } label: {
                    Text(candidate.label)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(selected ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(selected ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(selected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigDetail.changeSheet.type_\(candidate.rawValue)")
            }
        }
    }

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("What's changing?")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField("Describe the change (at least 5 characters)", text: $descriptionText, axis: .vertical)
                .lineLimit(2...4)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appText)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("gigDetail.changeSheet.description")
        }
    }

    private var amountField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Price change (optional)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                Button { amountIsDecrease.toggle() } label: {
                    Text(amountIsDecrease ? "−" : "+")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(amountIsDecrease ? Theme.Color.success : Theme.Color.primary600)
                        .frame(width: 44, height: 48)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigDetail.changeSheet.amountSign")
                HStack(spacing: Spacing.s2) {
                    Text("$")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    TextField("0", text: $amountText)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityIdentifier("gigDetail.changeSheet.amount")
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
    }

    private var minutesField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Extra minutes (optional)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField("0", text: $minutesText)
                .keyboardType(.numberPad)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("gigDetail.changeSheet.minutes")
        }
    }

    private var isValid: Bool {
        descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
    }

    /// Signed dollars — the +/− toggle applies the sign.
    private var parsedAmount: Double? {
        let cleaned = amountText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
        guard let value = Double(cleaned), value > 0 else { return nil }
        return amountIsDecrease ? -value : value
    }

    private var parsedMinutes: Int? {
        guard let value = Int(minutesText.trimmingCharacters(in: .whitespacesAndNewlines)), value > 0 else {
            return nil
        }
        return value
    }

    private func submit() async {
        guard isValid, !submitting else { return }
        submitting = true
        defer { submitting = false }
        let trimmed = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error = await onSubmit(type, trimmed, parsedAmount, parsedMinutes) {
            errorText = error
        } else {
            onDismiss()
        }
    }
}

// MARK: - Phase 5b — running late sheet

/// ETA chips (10/20/30/45/60 min) + optional note →
/// `POST /:gigId/worker-ack` with `running_late`.
struct GigRunningLateSheet: View {
    let onSubmit: @MainActor (Int, String?) async -> String?
    let onDismiss: @MainActor () -> Void

    @State private var etaMinutes = 20
    @State private var noteText = ""
    @State private var submitting = false
    @State private var errorText: String?

    private static let presets = [10, 20, 30, 45, 60]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Running late?")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Let the poster know roughly how late you'll be.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            HStack(spacing: Spacing.s2) {
                ForEach(Self.presets, id: \.self) { minutes in
                    let selected = etaMinutes == minutes
                    Button { etaMinutes = minutes } label: {
                        Text("\(minutes)m")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(selected ? Theme.Color.appTextInverse : Theme.Color.appText)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(selected ? Theme.Color.warning : Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigDetail.runningLateSheet.eta_\(minutes)")
                }
            }
            TextField("Add a note (optional)", text: $noteText, axis: .vertical)
                .lineLimit(2...3)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appText)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("gigDetail.runningLateSheet.note")
            if let errorText {
                Text(errorText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
            }
            HStack(spacing: Spacing.s2) {
                SheetButton(title: "Back", style: .ghost, identifier: "gigDetail.runningLateSheet.cancel") {
                    onDismiss()
                }
                SheetButton(
                    title: submitting ? "Sending…" : "Send \"~\(etaMinutes) min late\"",
                    style: .primary,
                    enabled: !submitting,
                    identifier: "gigDetail.runningLateSheet.submit"
                ) {
                    Task { await submit() }
                }
            }
        }
        .padding(Spacing.s5)
        .presentationDetents([.height(340)])
        .accessibilityIdentifier("gigDetail.runningLateSheet")
    }

    private func submit() async {
        guard !submitting else { return }
        submitting = true
        defer { submitting = false }
        let trimmed = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        if let error = await onSubmit(etaMinutes, trimmed.isEmpty ? nil : trimmed) {
            errorText = error
        } else {
            onDismiss()
        }
    }
}

// MARK: - Shared sheet bits

/// Selectable radio-style row used by the report + cancel sheets.
private struct RadioRow: View {
    let label: String
    let selected: Bool
    let identifier: String
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                if selected {
                    Icon(.check, size: 18, color: Theme.Color.primary600)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(selected ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(selected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

/// 46pt sheet action button in ghost / primary / destructive flavours.
private struct SheetButton: View {
    enum Style { case ghost, primary, destructive }

    let title: String
    let style: Style
    var enabled: Bool = true
    let identifier: String
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(foreground)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(background)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(style == .ghost ? Theme.Color.appBorder : Color.clear, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityIdentifier(identifier)
    }

    private var foreground: Color {
        guard enabled else { return Theme.Color.appTextMuted }
        return switch style {
        case .ghost: Theme.Color.appText
        case .primary, .destructive: Theme.Color.appTextInverse
        }
    }

    private var background: Color {
        guard enabled else { return Theme.Color.appSurfaceSunken }
        return switch style {
        case .ghost: Color.clear
        case .primary: Theme.Color.primary600
        case .destructive: Theme.Color.error
        }
    }
}
