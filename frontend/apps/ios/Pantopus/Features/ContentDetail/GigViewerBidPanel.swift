//
//  GigViewerBidPanel.swift
//  Pantopus
//
//  "Your bid" — the bidder-side mirror of `GigOwnerBidsPanel`. Renders in
//  the gig-detail scroll footer whenever the signed-in viewer already has a
//  live bid on the gig, and carries every action RN's `BidPanel` exposes:
//  Update bid, Withdraw bid, and (while a counter-offer is pending) Accept
//  counter / Decline counter. Withdraw and Decline confirm first.
//
//  RN reference: `src/components/gig-detail/BidPanel.tsx:106,224,251,268,292`.
//

import SwiftUI

struct GigViewerBidPanel: View {
    let viewModel: GigDetailViewModel
    /// Opens the shared bid sheet pre-filled with the existing bid.
    let onEditBid: @MainActor () -> Void
    /// `(message, isError)` — routed to the host's toast.
    let onToast: @MainActor (String, Bool) -> Void

    @State private var showWithdrawConfirm = false
    @State private var showDeclineConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Your bid")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            card
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.yourBid")
        .confirmationDialog(
            "Withdraw your bid?",
            isPresented: $showWithdrawConfirm,
            titleVisibility: .visible
        ) {
            Button("Withdraw bid", role: .destructive) {
                Task {
                    if let error = await viewModel.withdrawViewerBid() {
                        onToast(error, true)
                    } else {
                        onToast("Bid withdrawn.", false)
                    }
                }
            }
            Button("Keep bid", role: .cancel) {}
        } message: {
            Text("The poster is notified and \(amountLabel) is removed from this task.")
        }
        .confirmationDialog(
            "Decline this counter-offer?",
            isPresented: $showDeclineConfirm,
            titleVisibility: .visible
        ) {
            Button("Decline counter", role: .destructive) {
                Task {
                    if let error = await viewModel.declineViewerCounter() {
                        onToast(error, true)
                    } else {
                        onToast("Counter-offer declined.", false)
                    }
                }
            }
            Button("Keep deciding", role: .cancel) {}
        } message: {
            Text("Your original bid of \(amountLabel) stays active.")
        }
    }

    // MARK: - Card

    private var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            headerRow
            if let message = viewModel.viewerBid?.message, !message.isEmpty {
                Text(message)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(4)
            }
            if viewModel.viewerHasPendingCounter {
                counterCallout
                counterActions
            } else if viewModel.viewerCanEditBid {
                editActions
            } else {
                acceptedNote
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .opacity(viewModel.viewerBidActionInFlight ? 0.6 : 1)
        .accessibilityIdentifier("gigDetail.yourBid.card")
    }

    private var headerRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(amountLabel)
                .font(.system(size: 18, weight: .heavy).monospacedDigit())
                .foregroundStyle(Theme.Color.primary600)
                .accessibilityIdentifier("gigDetail.yourBid.amount")
            Spacer(minLength: Spacing.s2)
            statusPill
        }
    }

    private var statusPill: some View {
        let status = (viewModel.viewerBid?.status ?? "pending").lowercased()
        let foreground: Color = switch status {
        case "accepted": Theme.Color.success
        case "countered": Theme.Color.primary700
        default: Theme.Color.warning
        }
        let background: Color = switch status {
        case "accepted": Theme.Color.successBg
        case "countered": Theme.Color.primary50
        default: Theme.Color.warningBg
        }
        return HStack(spacing: 5) {
            Icon(statusIcon(status), size: 11, strokeWidth: 2.4, color: foreground)
            Text(status.prefix(1).uppercased() + String(status.dropFirst()))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(Capsule())
        .accessibilityIdentifier("gigDetail.yourBid.status")
    }

    private func statusIcon(_ status: String) -> PantopusIcon {
        switch status {
        case "accepted": .check
        case "countered": .arrowsRepeat
        default: .circle
        }
    }

    /// "The poster countered with $X" banner above Accept / Decline.
    private var counterCallout: some View {
        Text("The poster countered with \(counterLabel)")
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundStyle(Theme.Color.primary700)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s2)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityIdentifier("gigDetail.yourBid.counterCallout")
    }

    private var counterActions: some View {
        HStack(spacing: Spacing.s2) {
            panelButton(
                "Accept \(counterLabel)",
                icon: .check,
                style: .primary,
                identifier: "gigDetail.yourBid.acceptCounter"
            ) {
                Task {
                    if let error = await viewModel.acceptViewerCounter() {
                        onToast(error, true)
                    } else {
                        onToast("Counter-offer accepted.", false)
                    }
                }
            }
            panelButton(
                "Decline",
                icon: .x,
                style: .destructive,
                identifier: "gigDetail.yourBid.declineCounter"
            ) {
                showDeclineConfirm = true
            }
        }
        .disabled(viewModel.viewerBidActionInFlight)
    }

    private var editActions: some View {
        HStack(spacing: Spacing.s2) {
            panelButton(
                "Update bid",
                icon: .pencil,
                style: .primary,
                identifier: "gigDetail.yourBid.update",
                action: onEditBid
            )
            panelButton(
                "Withdraw",
                icon: .trash2,
                style: .destructive,
                identifier: "gigDetail.yourBid.withdraw"
            ) {
                showWithdrawConfirm = true
            }
        }
        .disabled(viewModel.viewerBidActionInFlight)
    }

    /// Settled bids can't be edited — either the poster accepted (the task
    /// details take over below) or the gig left `open`, which is exactly
    /// when the backend rejects a PUT / DELETE on the bid.
    private var acceptedNote: some View {
        let accepted = (viewModel.viewerBid?.status ?? "").lowercased() == "accepted"
        return Text(
            accepted
                ? "This bid was accepted — the task details are below."
                : "This task is no longer taking bid changes."
        )
        .pantopusTextStyle(.caption)
        .foregroundStyle(Theme.Color.appTextSecondary)
        .accessibilityIdentifier("gigDetail.yourBid.settledNote")
    }

    // MARK: - Labels

    private var amountLabel: String {
        Self.money(viewModel.viewerBid?.bidAmount ?? 0)
    }

    private var counterLabel: String {
        Self.money(viewModel.viewerBid?.counterAmount ?? 0)
    }

    private static func money(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(value))"
            : String(format: "$%.2f", value)
    }

    // MARK: - Buttons

    private enum PanelButtonStyle { case primary, destructive }

    private func panelButton(
        _ title: String,
        icon: PantopusIcon,
        style: PanelButtonStyle,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        let foreground: Color = switch style {
        case .primary: Theme.Color.appTextInverse
        case .destructive: Theme.Color.error
        }
        let background: Color = switch style {
        case .primary: Theme.Color.primary600
        case .destructive: Theme.Color.errorBg
        }
        return Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 12, strokeWidth: 2.4, color: foreground)
                Text(title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
