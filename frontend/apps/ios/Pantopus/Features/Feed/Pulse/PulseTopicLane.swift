//
//  PulseTopicLane.swift
//  Pantopus
//
//  The Nearby feed's topics (Pulse S4; build spec §4): `All` and the twelve
//  topics as filter chips, a few at a time with "More". A chip filters; it
//  joins nothing. Sports and fitness keeps the Sports lane RN shipped: it
//  replaces the post-type chip row with its own For You / Local / Event /
//  Watch mode chips, floats an active-event module above the list, and
//  offers starter prompts in the empty state.
//
//  The topic ids are the contract's (`docs/product/pulse-build/02-contract.md`
//  §1, `backend/services/pulse/topics.js`); the Sports constants mirror
//  `src/constants/feed.ts:31-70`; the feed query params (`topic`,
//  `sportsMode`, `eventKey`) are validated at `backend/routes/posts.js:1460`.
//

import Foundation
import SwiftUI

// MARK: - Topic

/// One of the twelve Pulse topics. Nobody creates topics; they have no
/// owners or counts. `sports` is the Sports lane's existing id.
public enum PulseTopic: String, CaseIterable, Sendable, Hashable, Identifiable {
    case aroundHere = "around_here"
    case outdoors
    case gardening
    case homeRepairs = "home_repairs"
    case food
    case kidsSchools = "kids_schools"
    case pets
    case artsCulture = "arts_culture"
    case sports
    case gettingAround = "getting_around"
    case localGovernment = "local_government"
    case volunteering

    /// How many topics the chip row shows before "More".
    static let shownBeforeMore = 5

    /// A post's stored topic; nil for none, or one this build doesn't know.
    public init?(stored: String?) {
        guard let stored, let topic = PulseTopic(rawValue: stored) else { return nil }
        self = topic
    }

    public var id: String {
        rawValue
    }

    /// The topic's name, as the build spec writes it.
    public var label: String {
        switch self {
        case .aroundHere: "Around here"
        case .outdoors: "Outdoors"
        case .gardening: "Gardening"
        case .homeRepairs: "Home and repairs"
        case .food: "Food"
        case .kidsSchools: "Kids and schools"
        case .pets: "Pets"
        case .artsCulture: "Arts and culture"
        case .sports: "Sports and fitness"
        case .gettingAround: "Getting around"
        case .localGovernment: "Local government"
        case .volunteering: "Volunteering"
        }
    }

    /// `topic` query value on `GET /api/posts/feed`.
    public var queryValue: String {
        rawValue
    }
}

// MARK: - Sports mode

/// Mode chips shown while the Sports lane is active. Sent as
/// `sportsMode` — the handler 400s on anything outside this set
/// (`backend/routes/posts.js:1485`).
public enum PulseSportsMode: String, CaseIterable, Sendable, Hashable, Identifiable {
    case forYou = "for_you"
    case local
    case event
    case watch

    public var id: String {
        rawValue
    }

    /// Default chip label. The `event` chip is relabelled at runtime with
    /// the primary active event's short label.
    public var label: String {
        switch self {
        case .forYou: "For You"
        case .local: "Local"
        case .event: "Event"
        case .watch: "Watch"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .forYou: .sparkles
        case .local: .mapPin
        case .event: .crown
        case .watch: .tv
        }
    }
}

// MARK: - Starter prompts

/// One Sports empty-state starter. Tapping it opens the composer with
/// the prompt pre-filled — RN `SPORTS_PULSE_STARTERS`
/// (`src/constants/feed.ts:180-193`).
public struct PulseSportsStarter: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    /// Composer body pre-fill.
    public let placeholder: String

    /// Ordered exactly as RN renders them.
    public static let all: [PulseSportsStarter] = [
        PulseSportsStarter(
            id: "anyone_watching",
            label: "Anyone watching tonight?",
            placeholder: "Who are you watching tonight? Anyone want to join?"
        ),
        PulseSportsStarter(
            id: "best_place_watch",
            label: "Best place to watch?",
            placeholder: "Any good spots to watch around here?"
        ),
        PulseSportsStarter(
            id: "youth_signups",
            label: "Youth sports signups?",
            placeholder: "Looking for youth league signups or tryouts…"
        ),
        PulseSportsStarter(
            id: "pickup_weekend",
            label: "Pickup game this weekend?",
            placeholder: "Anyone want to run a pickup game this weekend?"
        )
    ]
}

// MARK: - Topic chip row

/// `All` and the twelve topics under the surface toggle, scrolling sideways:
/// the first few, then "More" for the rest (build spec §3–4). Picking a
/// topic replaces the one before; `All`, or the chosen chip again, clears
/// it. The chosen topic always shows, even before "More". Scalable type.
struct PulseTopicChipRow: View {
    let activeTopic: PulseTopic?
    let onSelect: (PulseTopic?) -> Void
    /// "More" was tapped: every topic shows.
    @State private var showsAll = false

    private var shownTopics: [PulseTopic] {
        let first = Array(PulseTopic.allCases.prefix(PulseTopic.shownBeforeMore))
        if showsAll { return PulseTopic.allCases }
        guard let activeTopic, !first.contains(activeTopic) else { return first }
        return first + [activeTopic]
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                chip("All", selected: activeTopic == nil, spoken: "All topics", id: "all") {
                    onSelect(nil)
                }
                ForEach(shownTopics) { topic in
                    let selected = activeTopic == topic
                    chip(topic.label, selected: selected, spoken: "\(topic.label) topic", id: topic.rawValue) {
                        onSelect(selected ? nil : topic)
                    }
                }
                if !showsAll {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { showsAll = true }
                    } label: {
                        chipLabel("More", selected: false)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("More topics")
                    .accessibilityIdentifier("pulseTopicChip_more")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 6)
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("pulseTopicChipRow")
    }

    private func chip(
        _ text: String,
        selected: Bool,
        spoken: String,
        id: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            chipLabel(text, selected: selected)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier("pulseTopicChip_\(id)")
    }

    /// A chosen chip is filled and its words heavier, so the choice never
    /// rests on color alone.
    private func chipLabel(_ text: String, selected: Bool) -> some View {
        Text(text)
            .pulseFont(selected ? .smallStrong : .small)
            .foregroundStyle(selected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            .lineLimit(1)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 6)
            .background(selected ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(selected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1)
            )
            .hitArea(vertical: 6)
    }
}

// MARK: - Active event module

/// Compact card above the Sports feed while a major event is live —
/// RN `SportsEventModule.tsx`.
struct PulseSportsEventModule: View {
    let event: ActiveSportsEventDTO
    let onSeeThreads: () -> Void
    let onStartThread: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Icon(.crown, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryInk)
                Text("\(event.displayName ?? event.eventKey) is live")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
            }
            Text("Start a game thread, ask where to watch, or share your take.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Spacing.s2) {
                Button(action: onSeeThreads) {
                    Text("See threads")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, 7)
                        .background(Theme.Color.appSurface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseSportsEventSeeThreads")

                Button(action: onStartThread) {
                    HStack(spacing: 6) {
                        Icon(.pencil, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                        Text("Start a thread")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 7)
                    .background(Theme.Color.primarySolid)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseSportsEventStartThread")
            }
            .padding(.top, Spacing.s1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("pulseSportsEventModule")
    }
}

// MARK: - Starter prompt row

/// Starter chips rendered under the Sports lane's empty state.
struct PulseSportsStarterRow: View {
    let onSelect: (PulseSportsStarter) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Start the conversation")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(PulseSportsStarter.all) { starter in
                        Button { onSelect(starter) } label: {
                            Text(starter.label)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Theme.Color.primaryInk)
                                .padding(.horizontal, Spacing.s3)
                                .padding(.vertical, Spacing.s2)
                                .background(Theme.Color.primary50)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("pulseSportsStarter_\(starter.id)")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("pulseSportsStarters")
    }
}
