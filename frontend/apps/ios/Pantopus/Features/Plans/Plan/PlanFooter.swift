//
//  PlanFooter.swift
//  Pantopus
//
//  The sticky footer of a plan (one primary action per screen, board P2):
//  "Ask to join" (J1/J2), "Change who's coming" and "Withdraw request"
//  (J5), "Leave the waitlist" (J6), "Can't make it" (J7). Also the
//  confirmations those actions ask for first.
//

import SwiftUI

struct PlanFooter: View {
    let viewModel: PlanScreenViewModel
    /// Opens J3/J4; true when changing an earlier request.
    let onAsk: (Bool) -> Void
    let onConfirm: (PlanConfirmation) -> Void

    var body: some View {
        if let card = viewModel.card, let content = content(card) {
            VStack(spacing: Spacing.s2) {
                content
                if let error = viewModel.actionError {
                    Text(error)
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.error)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("planActionError")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface.ignoresSafeArea(edges: .bottom))
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
        }
    }

    private func content(_ card: PlanCardDTO) -> AnyView? {
        switch viewModel.mode {
        case .browsing:
            AnyView(browsing(card))
        case .requested:
            AnyView(VStack(spacing: Spacing.s2) {
                Button("Change who's coming") { onAsk(true) }
                    .planButton(.secondary)
                    .accessibilityIdentifier("planChangeRequest")
                Button("Withdraw request") { onConfirm(.withdraw(host: card.host.displayName)) }
                    .planButton(.textDanger, size: .extraSmall)
                    .accessibilityIdentifier("planWithdraw")
            })
        case .waitlisted:
            AnyView(VStack(spacing: Spacing.s2) {
                Button("Leave the waitlist") { onConfirm(.leaveWaitlist) }
                    .planButton(.secondary)
                    .accessibilityIdentifier("planLeaveWaitlist")
                caption(waitlistCaption(card))
            })
        case .going:
            AnyView(
                Button("Can't make it") { onConfirm(.cantMakeIt(host: card.host.displayName)) }
                    .planButton(.textDanger)
                    .accessibilityIdentifier("planCantMakeIt")
            )
        case .hosting, .closed, .notThisTime:
            nil
        }
    }

    /// One primary action, as on Android: ask (or join the waitlist), verify,
    /// share a location, or the reason someone can't, greyed out.
    @ViewBuilder
    private func browsing(_ card: PlanCardDTO) -> some View {
        let viewer = card.viewer
        if viewer?.canAsk ?? true {
            Button { onAsk(false) } label: {
                PlanButtonLabel(title: card.isFull ? "Join the waitlist" : "Ask to join", kind: .primary, isLoading: viewModel.isWorking)
            }
            .planButton(.primary)
            .accessibilityIdentifier("planAsk")
            if let text = card.isFull ? PlanCannotAskCopy.waitlist : askCaption(card) { caption(text) }
        } else if let reason = viewer?.cannotAskReason {
            switch reason {
            case .fullUseWaitlist:
                Button { onAsk(false) } label: { PlanButtonLabel(title: "Join the waitlist", kind: .primary) }
                    .planButton(.primary)
                    .accessibilityIdentifier("planAsk")
                caption(PlanCannotAskCopy.waitlist)
            case .needsVerifiedAddress:
                Button("Verify your address to join") { PlanVerification.open() }
                    .planButton(.primary)
                    .accessibilityIdentifier("planVerify")
                caption("This plan is for verified neighbors.")
            case .needsLocation:
                Button { Task { await viewModel.shareLocation() } } label: {
                    PlanButtonLabel(title: "Share your location to join", kind: .primary, isLoading: viewModel.isWorking)
                }
                .planButton(.primary)
                .disabled(viewModel.isWorking)
                .accessibilityIdentifier("planShareLocation")
                caption("Hosts only see a distance like \u{201C}about 1 mi\u{201D}.")
            default:
                Button(PlanCannotAskCopy.title(reason)) {}
                    .planButton(.primary)
                    .disabled(true)
                    .accessibilityIdentifier("planCannotAsk")
                if let text = PlanCannotAskCopy.caption(reason) { caption(text) }
            }
        }
    }

    private func caption(_ text: String) -> some View {
        Text(text)
            .planFont(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// "Sam usually answers within an hour" when the server says. Otherwise a
    /// playdate says "Maya approves each family" (J2); other plans already say
    /// how people get in above the footer.
    private func askCaption(_ card: PlanCardDTO) -> String? {
        // Board J2: a playdate says who approves each family.
        if card.kind == .playdate { return PlanCardLines.approval(card) }
        if card.howPeopleGetIn == "automatic" { return "You're in as soon as you ask, until the spots fill." }
        if let within = PlanCardLines.answersWithin(card.host) { return String(within.dropLast()) }
        return nil
    }

    /// "Starts in 7 hours. The waitlist closes 30 minutes before it ends."
    private func waitlistCaption(_ card: PlanCardDTO) -> String {
        let starts = card.state == .live ? "Happening now." : card.startsAtDate.map { PlanFormat.startsIn($0) + "." } ?? ""
        let closes = card.kind == .pickupGame || card.kind == .walkCoffee
            ? "The waitlist closes 30 minutes before it ends."
            : "The waitlist closes when it starts."
        return [starts, closes].filter { !$0.isEmpty }.joined(separator: " ")
    }
}

/// The J1 footer's words when someone can't ask (as on Android).
enum PlanCannotAskCopy {
    /// Under "Join the waitlist".
    static let waitlist = "Full for now. If a spot opens, we'll tell you right away."

    /// The greyed-out button.
    static func title(_ reason: PlanCannotAskReason) -> String {
        switch reason {
        case .tooFar: "Too far to join"
        case .ended: "Asking has closed"
        default: "Ask to join"
        }
    }

    /// Why, under the greyed-out button.
    static func caption(_ reason: PlanCannotAskReason) -> String? {
        switch reason {
        case .tooFar: "This plan is for neighbors who live or are close by."
        case .tooManyRequests: "You have 10 open requests. Withdraw one to ask here."
        case .declined, .removed: "This one didn't work out."
        case .blocked: "You can't join this plan."
        case .other: "You can't ask to join this plan right now."
        case .needsVerifiedAddress, .needsLocation, .fullUseWaitlist, .ended: nil
        }
    }
}

/// The confirmations a plan's actions ask for first.
enum PlanConfirmation: Identifiable, Equatable {
    case withdraw(host: String)
    case leaveWaitlist
    case cantMakeIt(host: String)
    /// "Can't make it" to the host's "Still coming?" (H11): answers it and leaves.
    case notComing(host: String)
    case blockHost(name: String)
    case removeGuest(name: String, requestId: String, atHome: Bool)

    var id: String {
        switch self {
        case .withdraw: "withdraw"
        case .leaveWaitlist: "leaveWaitlist"
        case .cantMakeIt: "cantMakeIt"
        case .notComing: "notComing"
        case .blockHost: "blockHost"
        case let .removeGuest(_, requestId, _): "remove.\(requestId)"
        }
    }

    var title: String {
        switch self {
        case .withdraw: "Withdraw your request?"
        case .leaveWaitlist: "Leave the waitlist?"
        case .cantMakeIt, .notComing: "Can't make it?"
        case let .blockHost(name): "Block \(PlanCardLines.firstName(name))?"
        case let .removeGuest(name, _, _): "Remove \(PlanCardLines.firstName(name))?"
        }
    }

    var message: String {
        switch self {
        case let .withdraw(host):
            "\(PlanCardLines.firstName(host)) won't see it anymore."
        case .leaveWaitlist:
            "You'll lose your place in line."
        case let .cantMakeIt(host), let .notComing(host):
            "We'll tell \(PlanCardLines.firstName(host)), and your spot goes to the next person waiting. "
                + "You'll lose the exact place, the note and the chat."
        case .blockHost:
            "You won't see each other's plans, requests or messages."
        case let .removeGuest(name, _, atHome):
            atHome
                ? "\(PlanCardLines.firstName(name)) has already seen the address. They lose the plan, the note and the chat from now on."
                : "They lose the plan, the exact place, the note and the chat from now on."
        }
    }

    var confirmLabel: String {
        switch self {
        case .withdraw: "Withdraw"
        case .leaveWaitlist: "Leave"
        case .cantMakeIt, .notComing: "I can't make it"
        case .blockHost: "Block"
        case .removeGuest: "Remove"
        }
    }

    /// Runs it; returns the toast to show when it went through.
    func perform(_ viewModel: PlanScreenViewModel) async -> String? {
        switch self {
        case .withdraw:
            await viewModel.withdraw() ? "Request withdrawn" : nil
        case .leaveWaitlist:
            await viewModel.withdraw() ? "You left the waitlist" : nil
        case let .cantMakeIt(host):
            await viewModel.withdraw() ? "We told \(PlanCardLines.firstName(host))" : nil
        case let .notComing(host):
            await viewModel.stillComing(false) ? "We told \(PlanCardLines.firstName(host))" : nil
        case .blockHost:
            await viewModel.blockHost() ? "Blocked. You won't see each other's plans." : nil
        case let .removeGuest(_, requestId, _):
            await viewModel.remove(requestId: requestId) ? "Removed. They no longer see the plan." : nil
        }
    }
}
