//
//  PlansTodayCards.swift
//  Pantopus
//
//  Plans on Today (boards A1 and A2): "Going today" with Directions and
//  "On my way", and "You're hosting today" with Message guests and Open
//  plan. Only with the `plans` flag on, and only on the day of the plan.
//  Area-only cards from "Your plans"; Directions reads the exact place when
//  tapped (never kept).
//

import MapKit
import SwiftUI

@Observable
@MainActor
final class PlansTodayModel {
    private(set) var hosting: [PlanCardDTO] = []
    private(set) var going: [PlanCardDTO] = []
    /// A5: ended plans to ask about (guests) or to host again (hosts).
    private(set) var recent: [PlanCardDTO] = []
    /// Answers given here, by plan.
    private(set) var answered: [String: PlanFeedbackBody.Answer] = [:]
    /// Plans this viewer said "On my way" to, here.
    private(set) var onTheirWay: Set<String> = []
    private(set) var working: Set<String> = []
    var error: String?

    func load(force: Bool = false) async {
        guard PlansFlags.shared.plans else {
            hosting = []
            going = []
            return
        }
        if !force, let copy = PlansStoreReads.peekMine() { apply(copy) }
        if let snapshot = try? await PlansStoreReads.mine(force: force) { apply(snapshot.value) }
    }

    private func apply(_ mine: MyPlansResponse) {
        hosting = mine.hosting.filter(Self.isToday)
        going = mine.going.filter(Self.isToday)
        recent = mine.recent.filter { card in
            if PlanAfterDismissals.isDismissed(card.id) { return false }
            return card.viewer?.isHost == true || card.viewer?.feedbackGiven != true || answered[card.id] != nil
        }
    }

    /// "Great", "It was OK", "Something wasn't right" (the last files a report).
    func answer(_ card: PlanCardDTO, _ answer: PlanFeedbackBody.Answer) async {
        working.insert(card.id)
        defer { working.remove(card.id) }
        do {
            _ = try await APIClient.shared.request(
                PlansEndpoints.feedback(planId: card.id, PlanFeedbackBody(answer: answer)),
                as: EmptyResponse.self
            )
            answered[card.id] = answer
            error = nil
        } catch {
            self.error = PlanErrors.sentence(for: error)
        }
    }

    func dismiss(_ card: PlanCardDTO) {
        PlanAfterDismissals.dismiss(card.id)
        recent.removeAll { $0.id == card.id }
    }

    /// "Host again": the earlier plan with its place, read fresh.
    func hostAgain(_ card: PlanCardDTO) async -> PlanDetailDTO? {
        working.insert(card.id)
        defer { working.remove(card.id) }
        return try? await PlansStoreReads.detail(id: card.id)
    }

    /// Live now, or starting later today in the plan's own time zone.
    static func isToday(_ card: PlanCardDTO) -> Bool {
        if card.state == .live { return true }
        guard card.state == .upcoming, let start = card.startsAtDate else { return false }
        return PlanFormat.calendar(for: card.timezone).isDateInToday(start)
    }

    func onMyWay(_ card: PlanCardDTO) async {
        working.insert(card.id)
        defer { working.remove(card.id) }
        do {
            _ = try await APIClient.shared.request(PlansEndpoints.onMyWay(planId: card.id), as: EmptyResponse.self)
            onTheirWay.insert(card.id)
            error = nil
        } catch {
            self.error = PlanErrors.sentence(for: error)
        }
    }

    /// Opens the exact place in Maps (read fresh, never kept).
    func directions(_ card: PlanCardDTO) async {
        working.insert(card.id)
        defer { working.remove(card.id) }
        guard let place = try? await PlansStoreReads.detail(id: card.id).place else {
            error = "We couldn't load the place. Open the plan and try again."
            return
        }
        let item = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(
            latitude: place.latitude,
            longitude: place.longitude
        )))
        item.name = place.name ?? card.title
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault])
    }
}

struct PlansTodayCards: View {
    @State private var model = PlansTodayModel()
    @State private var flags = PlansFlags.shared
    @Environment(RootTabModel.self) private var rootTabs

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if flags.plans {
                ForEach(model.hosting) { card in hostingCard(card) }
                ForEach(model.going) { card in goingCard(card) }
                ForEach(model.recent) { card in
                    PlanAfterCard(card: card, model: model) { again in
                        PlansNavigator.shared.pendingHost = PlansHostRequest(start: PlansHostStart(kind: card.kind, again: again))
                        rootTabs.selected = .nearby
                    }
                }
                if let error = model.error, !(model.hosting.isEmpty && model.going.isEmpty && model.recent.isEmpty) {
                    Text(error).planFont(.footnote).foregroundStyle(Theme.Color.error)
                }
            }
        }
        // Space below the cards only when there are any.
        .padding(.bottom, model.hosting.isEmpty && model.going.isEmpty && model.recent.isEmpty ? 0 : Spacing.s4)
        .task(id: flags.plans) { await model.load() }
        .refreshesOnPlansChange { await model.load() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansToday")
    }

    // MARK: - A1

    private func goingCard(_ card: PlanCardDTO) -> some View {
        let host = PlanCardLines.firstName(card.host.displayName)
        let title = card.placeKind == .home ? "\(shortTitle(card)) at \(host)'s" : shortTitle(card)
        return cardShell(card, overline: "Going today", title: title, line: goingLine(card)) {
            HStack(spacing: 10) {
                Button { Task { await model.directions(card) } } label: {
                    PlanButtonLabel(title: "Directions", icon: .locationArrow, kind: .tonal)
                }
                .planButton(.tonal, size: .small)
                .accessibilityIdentifier("plansTodayDirections")
                if model.onTheirWay.contains(card.id) {
                    Button {} label: { PlanButtonLabel(title: "We told \(host)", icon: .check, kind: .secondary) }
                        .planButton(.secondary, size: .small)
                        .disabled(true)
                } else {
                    Button { Task { await model.onMyWay(card) } } label: {
                        PlanButtonLabel(title: "On my way", kind: .primary, isLoading: model.working.contains(card.id))
                    }
                    .planButton(.primary, size: .small)
                    .accessibilityIdentifier("plansTodayOnMyWay")
                }
            }
        }
    }

    /// "1:25 PM · about 1 mi · 6 going".
    private func goingLine(_ card: PlanCardDTO) -> String {
        var parts: [String] = []
        if card.state == .live {
            parts.append("Happening now")
        } else if let start = card.startsAtDate {
            parts.append(PlanFormat.time(start, calendar: PlanFormat.calendar(for: card.timezone)))
        }
        if let distance = PlanFormat.distance(card.distanceBand) { parts.append(distance) }
        parts.append("\(card.goingCount) going")
        return parts.joined(separator: " · ")
    }

    // MARK: - A2

    private func hostingCard(_ card: PlanCardDTO) -> some View {
        let time = card.startsAtDate.map { PlanFormat.time($0, calendar: PlanFormat.calendar(for: card.timezone)) }
        return cardShell(
            card,
            overline: "You're hosting today",
            title: [shortTitle(card), card.state == .live ? "now" : time].compactMap { $0 }.joined(separator: " · "),
            line: hostingLine(card)
        ) {
            HStack(spacing: 10) {
                Button("Message guests") { open(card, intent: .chat) }
                    .planButton(.tonal, size: .small)
                    .accessibilityIdentifier("plansTodayMessageGuests")
                Button("Open plan") { open(card, intent: .view) }
                    .planButton(.primary, size: .small)
                    .accessibilityIdentifier("plansTodayOpenPlan")
            }
        }
    }

    /// "6 coming · 2 spots left · 1 request".
    private func hostingLine(_ card: PlanCardDTO) -> String {
        var parts = ["\(card.goingCount) coming"]
        parts.append(card.isFull ? "full" : "\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s") left")
        if let requests = card.requestsCount, requests > 0 {
            parts.append("\(requests) request\(requests == 1 ? "" : "s")")
        }
        return parts.joined(separator: " · ")
    }

    // MARK: - Shared

    /// "Seahawks game" for a watch party with a game; the title otherwise.
    private func shortTitle(_ card: PlanCardDTO) -> String {
        card.details?.game.map { "\($0.label) game" } ?? card.title
    }

    private func cardShell(
        _ card: PlanCardDTO,
        overline: String,
        title: String,
        line: String,
        @ViewBuilder buttons: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button { open(card, intent: .view) } label: {
                HStack(spacing: Spacing.s3) {
                    PlanTile(kind: card.kind)
                    VStack(alignment: .leading, spacing: 1) {
                        Text.planOverline(overline)
                        Text(title).planFont(.h4).foregroundStyle(Theme.Color.appText).multilineTextAlignment(.leading)
                        Text(line).planFont(.small).monospacedDigit().foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            buttons()
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(card.kind.color.opacity(0.4), lineWidth: 1)
        )
    }

    private func open(_ card: PlanCardDTO, intent: PlanOpenIntent) {
        PlansStoreReads.seed(card)
        PlansNavigator.shared.pending = .plan(id: card.id, intent: intent)
        rootTabs.selected = .nearby
    }
}
