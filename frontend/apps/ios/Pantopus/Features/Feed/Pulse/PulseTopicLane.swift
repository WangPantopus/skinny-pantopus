//
//  PulseTopicLane.swift
//  Pantopus
//
//  The Nearby feed's topic lane. RN ships exactly one topic — Sports —
//  which replaces the post-type chip row with its own For You / Local /
//  Event / Watch mode chips, floats an active-event module above the
//  list, and offers starter prompts in the empty state.
//
//  Constants mirror `src/constants/feed.ts:31-70`; the feed query params
//  (`topic`, `sportsMode`, `eventKey`) are validated at
//  `backend/routes/posts.js:1478-1489`.
//

import Foundation
import SwiftUI

// MARK: - Topic

/// A Nearby topic lane. Only `sports` exists today; the chip row takes a
/// list so a second topic drops in without touching call sites.
public enum PulseTopic: String, CaseIterable, Sendable, Hashable, Identifiable {
    case sports

    public var id: String {
        rawValue
    }

    /// Chip label — RN `PLACE_TOPICS`.
    public var label: String {
        switch self {
        case .sports: "Sports"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .sports: .activity
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

/// Row of topic chips under the surface toggle. Tapping an active chip
/// exits the lane (RN `TopicChipRow.tsx:38`).
struct PulseTopicChipRow: View {
    let topics: [PulseTopic]
    let activeTopic: PulseTopic?
    let onSelect: (PulseTopic?) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(topics) { topic in
                    let active = activeTopic == topic
                    Button {
                        onSelect(active ? nil : topic)
                    } label: {
                        HStack(spacing: 6) {
                            Icon(
                                topic.icon,
                                size: 14,
                                strokeWidth: 2.2,
                                color: active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
                            )
                            Text(topic.label)
                                .font(.system(size: 12, weight: active ? .semibold : .regular))
                                .foregroundStyle(
                                    active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
                                )
                        }
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, 6)
                        .background(active ? Theme.Color.primary600 : Theme.Color.appSurfaceRaised)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().stroke(
                                active ? Theme.Color.primary600 : Theme.Color.appBorder,
                                lineWidth: 1
                            )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? [.isSelected] : [])
                    .accessibilityLabel("\(topic.label) topic")
                    .accessibilityIdentifier("pulseTopicChip_\(topic.rawValue)")
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
                Icon(.crown, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
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
                    .background(Theme.Color.primary600)
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
                                .foregroundStyle(Theme.Color.primary600)
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
