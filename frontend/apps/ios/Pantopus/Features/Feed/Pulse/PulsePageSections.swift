//
//  PulsePageSections.swift
//  Pantopus
//
//  The Pulse page's parts besides the cards (Pulse S6; build spec §3): the
//  header with its "…" menu and area pill, the Nearby · Following picker, the
//  end of the page, "Show earlier", a quiet day and the error. Pulse scalable
//  type throughout; same words as Android (`PulsePageScreen.kt`).
//

import SwiftUI

/// "Pulse", the page's "…" menu, and the area it reads.
struct PulsePageHeader: View {
    let areaName: String?
    let topMenu: FeedTopMenu?
    let onOpenPreferences: () -> Void
    let onOpenAreas: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                Text("Pulse")
                    .pulseFont(.pageTitle)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s2)
                moreMenu
            }
            areaPill(areaName ?? "Choose an area")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private func areaPill(_ name: String) -> some View {
        Button(action: onOpenAreas) {
            HStack(spacing: Spacing.s1) {
                Icon(.mapPin, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryInk)
                    .accessibilityHidden(true)
                Text(name)
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appText)
                Icon(.chevronDown, size: 16, color: Theme.Color.appTextSecondary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 44)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Area: \(name)")
        .accessibilityHint("Choose where to read Pulse")
        .accessibilityIdentifier("pulseAreaPill")
    }

    /// Connections (and Beacons while that launch cut is on), then Pulse
    /// preferences: the Pulse tab's top-right menu (Pulse S3).
    private var moreMenu: some View {
        Menu {
            if let topMenu {
                Button(action: topMenu.onOpenConnections) {
                    Label { Text("Connections") } icon: { Icon(.users) }
                }
                .accessibilityIdentifier("pulseMenuConnections")
                if let onOpenBeacons = topMenu.onOpenBeacons {
                    Button(action: onOpenBeacons) {
                        Label { Text("Beacons") } icon: { Icon(.radio) }
                    }
                    .accessibilityIdentifier("pulseMenuBeacons")
                }
            }
            Button(action: onOpenPreferences) {
                Label { Text("Pulse preferences") } icon: { Icon(.slidersHorizontal) }
            }
            .accessibilityIdentifier("pulseMenuPreferences")
        } label: {
            Icon(.moreHorizontal, size: 20, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .hitArea(horizontal: 4, vertical: 4)
        }
        .accessibilityLabel("More")
        .accessibilityIdentifier("pulseMoreMenu")
    }
}

/// Nearby · Following (Known arrives with S12). The chosen one is filled and
/// semibold, and VoiceOver hears "Selected".
struct PulsePageModePicker: View {
    let selected: PulsePageMode
    let onSelect: (PulsePageMode) -> Void

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(PulsePageMode.allCases, id: \.self) { mode in
                let isSelected = selected == mode
                Button {
                    onSelect(mode)
                } label: {
                    Text(mode.label)
                        .pulseFont(isSelected ? .button : .small)
                        .foregroundStyle(isSelected ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(isSelected ? Theme.Color.appSurface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .shadow(color: isSelected ? Theme.Color.appText.opacity(0.08) : .clear, radius: 2, x: 0, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
                .accessibilityIdentifier("pulseView_\(mode.rawValue)")
            }
        }
        .padding(Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
    }
}

/// "You're caught up": nothing is hidden below it, and "Show earlier" is the
/// only way back. An empty page already says it is quiet, so it shows only
/// "Show earlier" (agreed with PA).
struct PulsePageEndCard: View {
    let content: PulsePageContent
    let showsEarlierButton: Bool
    let onShowEarlier: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if content.end.caughtUp, !content.isEmpty {
                Icon(.check, size: 28, strokeWidth: 2.6, color: Theme.Color.success)
                    .frame(width: 56, height: 56)
                    .background(Theme.Color.successBg)
                    .clipShape(Circle())
                    .accessibilityHidden(true)
                Text("You're caught up")
                    .pulseFont(.title)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("pulseCaughtUp")
                Text(content.end.sentence)
                    .pulseFont(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if showsEarlierButton {
                PulsePageShowEarlierButton(action: onShowEarlier)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s6)
        .padding(.vertical, Spacing.s6)
        .accessibilityIdentifier("pulseEnd")
    }
}

/// Below the EARLIER group: loading, "Show earlier" again, or "Nothing
/// earlier."
struct PulsePageEarlierFooter: View {
    let phase: PulsePageViewModel.EarlierPhase
    let onShowEarlier: () -> Void

    var body: some View {
        switch phase {
        case .idle:
            EmptyView()
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .accessibilityLabel("Loading earlier conversations")
                .accessibilityIdentifier("pulseEarlierLoading")
        case .more:
            PulsePageShowEarlierButton(action: onShowEarlier)
                .frame(maxWidth: .infinity)
        case .done:
            Text("Nothing earlier.")
                .pulseFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .accessibilityIdentifier("pulseNothingEarlier")
        }
    }
}

/// "Show earlier": the only way older conversations arrive.
struct PulsePageShowEarlierButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("Show earlier")
                .pulseFont(.button)
                .foregroundStyle(Theme.Color.primary600)
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pulseShowEarlier")
    }
}

/// A quiet day says so; nothing is invented to fill the page.
struct PulsePageQuietDay: View {
    let areaName: String
    let following: Bool
    let topic: PulseTopic?
    let onCompose: () -> Void
    let onShowAllTopics: () -> Void

    private var topicContent: FeedEmptyContent? {
        topic.map(FeedSurface.quietTopicContent)
    }

    /// Same words as Android: Following says what will show up there.
    private var bodyText: String {
        if let topic, following {
            return "New conversations about \(topic.label.lowercased()) that you follow will show here."
        }
        if let topicContent { return topicContent.body }
        return following
            ? "New activity in conversations you follow will show here."
            : "When neighbors post, it shows here. Start a conversation if you'd like."
    }

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Text(topicContent?.headline ?? (following ? "No new conversations" : "Quiet in \(areaName) today"))
                .pulseFont(.headline)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(bodyText)
                .pulseFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if topic != nil {
                Button(action: onShowAllTopics) {
                    Text("Show all topics")
                        .pulseFont(.button)
                        .foregroundStyle(Theme.Color.primary600)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseTopicShowAll")
            } else if !following {
                Button(action: onCompose) {
                    Text("Start a conversation")
                        .pulseFont(.button)
                        .foregroundStyle(Theme.Color.primary600)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseStartConversation")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s6)
        .padding(.vertical, Spacing.s10)
        .accessibilityIdentifier("pulseQuietDay")
    }
}

/// The page couldn't be read and nothing was saved to show instead.
struct PulsePageErrorCard: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Text("Couldn't load Pulse")
                .pulseFont(.headline)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pulseFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: onRetry) {
                Text("Try again")
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(minHeight: 44)
                    .background(Theme.Color.primarySolid)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulsePageRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s6)
        .padding(.vertical, Spacing.s10)
        .accessibilityIdentifier("pulsePageError")
    }
}
