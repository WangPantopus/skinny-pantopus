//
//  PlanPlaceSuggestions.swift
//  Pantopus
//
//  H6's "Suggest places": Pantopus picks up to three public places near the
//  host that suit the draft (its kind, time, size and details), each with a
//  line on why (`POST /api/plans/places/suggest`). From the search box,
//  "Ask Pantopus" sends what the host typed ("big screens and food") too.
//  The picks come from the same public places as the list below; tapping
//  one chooses it like a row there.
//

import SwiftUI

struct PlanPlaceSuggestions: View {
    let model: PlanComposerModel
    let center: UserCoordinate?
    /// What the host typed in the search box; nil for the plain "Suggest places".
    let ask: String?
    let chosenId: String?
    let onChoose: (PlanPlaceOptionDTO) -> Void

    private enum Phase: Equatable {
        case idle
        /// `gathering`: the area's places are still on their way.
        case loading(gathering: Bool)
        case loaded([PlanPlaceOptionDTO], fromAI: Bool)
        case empty(String)
        case failed(String)
    }

    @State private var phase = Phase.idle
    @State private var request = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            switch phase {
            case .idle:
                startRow
            case let .loading(gathering):
                Text.planOverline(heading).padding(.bottom, 2)
                ForEach(0..<2, id: \.self) { _ in Shimmer(width: nil, height: 52, cornerRadius: Radii.lg).padding(.vertical, 6) }
                Text(gathering
                    ? "Gathering the public places near you first\u{2026}"
                    : "Pantopus is picking places for your \(noun)\u{2026}")
                    .planFont(.footnote)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("planPlaceSuggestStatus")
            case let .loaded(picks, fromAI):
                Text.planOverline(heading).padding(.bottom, 2)
                ForEach(Array(picks.enumerated()), id: \.element.id) { index, place in
                    PlanPlaceRow(place: place, kind: model.kind, isOn: chosenId == place.id, divider: index > 0, center: center) {
                        onChoose(place)
                    }
                }
                Text(fromAI
                    ? "Picked by Pantopus from the public places near you. Check the details before you go."
                    : "Good fits from the public places near you.")
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, Spacing.s1)
            case let .empty(line):
                Text.planOverline(heading).padding(.bottom, 2)
                Text(line)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s2)
                    .accessibilityIdentifier("planPlaceSuggestStatus")
            case let .failed(line):
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(line)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("planPlaceSuggestStatus")
                    Button("Try again") { request += 1 }
                        .planButton(.secondary, size: .small)
                }
                .padding(.vertical, Spacing.s2)
            }
        }
        .task(id: request) { await suggest() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPlaceSuggestions")
    }

    private var startRow: some View {
        Button { request += 1 } label: {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(Theme.Color.primary100)
                    .frame(width: 44, height: 44)
                    .overlay(Icon(.sparkles, size: 22, color: Theme.Color.primary700))
                VStack(alignment: .leading, spacing: 0) {
                    Text(ask.map { "Ask Pantopus: \u{201C}\($0)\u{201D}" } ?? "Suggest places for your \(noun)")
                        .planFont(.rowTitle)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                    Text(ask == nil
                        ? "Pantopus picks from the public places near you, for your plan's time"
                        : "Find places nearby that fit what you typed")
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(ask == nil ? "planPlaceSuggest" : "planPlaceAskPantopus")
    }

    private var heading: String {
        ask.map { "For \u{201C}\($0)\u{201D}" } ?? "Suggested for your \(noun)"
    }

    private var noun: String {
        switch model.kind {
        case .watchParty: "watch party"
        case .playdate: "playdate"
        case .pickupGame: "game"
        case .walkCoffee: "walk"
        case .studyGroup: "study group"
        }
    }

    private func suggest() async {
        guard request > 0 else { return }
        guard let center else {
            phase = .failed("Couldn't find your location. Check location access and try again.")
            return
        }
        phase = .loading(gathering: false)
        let title = model.effectiveTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let about = model.about.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = PlanPlaceSuggestBody(
            latitude: center.latitude,
            longitude: center.longitude,
            kind: model.kind,
            title: title.isEmpty ? nil : title,
            about: about.isEmpty ? nil : about,
            startsAt: model.effectiveStart,
            endsAt: model.end,
            spots: model.spots,
            details: model.details,
            ask: ask
        )
        let started = Date()
        while !Task.isCancelled {
            do {
                let reply: PlanPlaceSuggestionsResponse = try await APIClient.shared.request(PlansEndpoints.suggestPlaces(body))
                guard !Task.isCancelled else { return }
                guard reply.loading else {
                    phase = reply.picks.isEmpty
                        ? .empty(ask.map { "Nothing nearby fits \u{201C}\($0)\u{201D}. Try other words, or pick from the list." }
                            ?? "Nothing nearby fits this plan. Pick from the list below.")
                        : .loaded(reply.picks, fromAI: reply.source == "ai")
                    return
                }
                guard Date().timeIntervalSince(started) < PlanPlacePicker.gatherLimit else {
                    phase = .failed(PlanPlacePicker.slowLine)
                    return
                }
                phase = .loading(gathering: true)
                try? await Task.sleep(for: .seconds(3))
            } catch {
                guard !Task.isCancelled else { return }
                phase = .failed(Self.failure(error))
                return
            }
        }
    }

    private static func failure(_ error: any Error) -> String {
        if case let .clientError(status, message) = error as? APIError, status == 429 {
            return message ?? "Pantopus has made a lot of suggestions this hour. Try again later."
        }
        if case .server = error as? APIError { return PlanPlacePicker.unavailableLine }
        return "Couldn't get suggestions. Check your connection and try again."
    }
}
