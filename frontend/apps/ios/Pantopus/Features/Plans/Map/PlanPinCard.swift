//
//  PlanPinCard.swift
//  Pantopus
//
//  Board F3: a pin tapped. The plan's card in the sheet: the type tag and a
//  close button, the title (opens the plan), when, the area and the
//  distance band, the host, spots, and "Details" with the one main action.
//

import SwiftUI

struct PlanPinCard: View {
    let viewModel: PlansMapViewModel
    let planId: String
    let actions: PlansMapActions
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if let card = viewModel.selectedCard, card.id == planId {
                content(card)
            } else if viewModel.selectedFailed {
                failed
            } else {
                loading
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPinCard")
    }

    private func content(_ card: PlanCardDTO) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    PlanTypeTag(kind: card.kind)
                    Spacer()
                    closeButton
                }
                Button { actions.openPlan(card, card.id, .view) } label: {
                    Text(card.title)
                        .planFont(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the plan")
                Text(PlanCardLines.whenWhere(card))
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                PlanHostRow(host: card.host, kind: card.kind)
                // Someone already in (or hosting) doesn't need to hear how to get in.
                PlanSpotsBlock(
                    card: card,
                    trailing: card.viewer?.isIn == true || card.viewer?.isHost == true
                        ? nil : PlanCardLines.approval(card)
                )
                buttons(card)
                    .padding(.top, 2)
            }
            .padding(.bottom, Spacing.s4)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { viewModel.cardHeight = $0 }
        }
        .scrollIndicators(.hidden)
    }

    private var closeButton: some View {
        Button {
            withAnimation(reduceMotion ? .easeInOut(duration: 0.15) : .spring(response: 0.35, dampingFraction: 0.86)) {
                viewModel.clearSelection()
            }
        } label: {
            Icon(.x, size: 16, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
        .accessibilityIdentifier("planPinCardClose")
    }

    @ViewBuilder
    private func buttons(_ card: PlanCardDTO) -> some View {
        let main = PlanMainAction.for(card)
        HStack(spacing: 10) {
            Button("Details") { actions.openPlan(card, card.id, .view) }
                .planButton(.secondary, size: .small)
                .accessibilityIdentifier("planPinDetails")
            if let main {
                Button(main.title) { actions.openPlan(card, card.id, main.asks ? .ask : .view) }
                    .planButton(main.isPrimary ? .primary : .secondary, size: .small)
                    .accessibilityIdentifier("planPinMain")
            }
        }
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 120, height: 30, cornerRadius: Radii.pill)
            Shimmer(width: 260, height: 22, cornerRadius: Radii.xs)
            Shimmer(width: 220, height: 14, cornerRadius: Radii.xs)
            Shimmer(width: nil, height: 40, cornerRadius: Radii.lg)
        }
        .accessibilityElement()
        .accessibilityLabel("Loading the plan")
    }

    private var failed: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack {
                Text("This plan isn't available")
                    .planFont(.h4)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                closeButton
            }
            Text("It may have ended or been cancelled.")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

/// The one main action on a plan, for this viewer right now.
struct PlanMainAction: Equatable {
    let title: String
    let isPrimary: Bool
    /// Opens "Ask to join" (J3) rather than the plan.
    var asks = false

    static func `for`(_ card: PlanCardDTO) -> PlanMainAction? {
        guard let viewer = card.viewer else { return PlanMainAction(title: "Ask to join", isPrimary: true, asks: true) }
        if viewer.isHost { return PlanMainAction(title: "Your plan", isPrimary: true) }
        switch viewer.requestStatus {
        case .accepted: return PlanMainAction(title: "You're in", isPrimary: true)
        case .pending: return PlanMainAction(title: "Requested", isPrimary: false)
        case .waitlisted: return PlanMainAction(title: "On the waitlist", isPrimary: false)
        default: break
        }
        if viewer.canAsk { return PlanMainAction(title: card.isFull ? "Join the waitlist" : "Ask to join", isPrimary: true, asks: true) }
        if viewer.cannotAskReason == .fullUseWaitlist { return PlanMainAction(title: "Join the waitlist", isPrimary: true, asks: true) }
        return nil
    }
}

/// Lines several Plans screens share.
enum PlanCardLines {
    /// "Sun, Oct 18 · 1:25–4:45 PM · Near Prune Hill · about 1 mi"; a
    /// playdate before you're in: "Saturday morning · Downtown Camas · about 1 mi".
    static func whenWhere(_ card: PlanCardDTO, long: Bool = false) -> String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        var parts: [String] = []
        if card.state == .live {
            parts
                .append(PlanFormat
                    .rowWhen(state: .live, start: card.startsAtDate, end: card.endsAtDate, calendar: calendar) ?? "Happening now")
        } else if let start = card.startsAtDate {
            parts.append(PlanFormat.when(start: start, end: card.endsAtDate, long: long, calendar: calendar))
        } else {
            parts.append(PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, calendar: calendar))
        }
        parts.append(card.area.label)
        if let distance = PlanFormat.distance(card.distanceBand) { parts.append(distance) }
        return parts.joined(separator: " · ")
    }

    /// How people get in: "Sam approves each person", or the rule that lets
    /// this viewer (or, for the host, anyone) in right away, in the words of
    /// board J6 and the Android app. Playdates: "Maya approves each family".
    static func approval(_ card: PlanCardDTO) -> String {
        let first = firstName(card.host.displayName)
        if card.kind == .playdate { return "\(first) approves each family" }
        let rule = card.viewer?.isHost == true ? card.autoRules?.first : card.viewer?.autoRule
        switch rule {
        case .anyoneNearby: return "Lets in anyone nearby automatically"
        case .verified: return "Lets in verified neighbors automatically"
        case .hostedBefore: return card.viewer?.isHost == true ? "Lets in people you've hosted automatically" : "You can get in right away"
        case nil: return "\(first) approves each person"
        }
    }

    /// "watch party", "game", "dog walk": the plan in a sentence, as the server's notifications say it.
    static func noun(_ card: PlanCardDTO) -> String {
        switch card.kind {
        case .watchParty: "watch party"
        case .playdate: "playdate"
        case .pickupGame: "pickup game"
        case .walkCoffee:
            switch card.details?.walkKind {
            case "coffee": "coffee"
            case "dog_walk": "dog walk"
            case "stroller_walk": "stroller walk"
            default: "walk"
            }
        }
    }

    /// "Sam usually answers within an hour", when the server knows.
    static func answersWithin(_ host: PlanHostDTO) -> String? {
        guard let minutes = host.typicalAnswerMinutes else { return nil }
        let first = firstName(host.displayName)
        let span = switch minutes {
        case ..<20: "within minutes"
        case ..<75: "within an hour"
        case ..<180: "within a few hours"
        case ..<(24 * 60): "within a day"
        default: "in a day or two"
        }
        return "\(first) usually answers \(span)."
    }

    /// "Sam" from "Sam R.".
    static func firstName(_ displayName: String) -> String {
        displayName.split(separator: " ").first.map(String.init) ?? displayName
    }
}
