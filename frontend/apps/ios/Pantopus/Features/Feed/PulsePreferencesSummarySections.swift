//
//  PulsePreferencesSummarySections.swift
//  Pantopus
//
//  The lists in Pulse preferences (Pulse S10.3): FOLLOWING, UPDATES, MUTED
//  TOPICS and MUTED PEOPLE, each row with its undo, and "Mute a topic" for
//  the area the page reads. Scalable type; each button tells VoiceOver
//  what it undoes; at the largest sizes a row's button moves under its
//  words. MUTED TOPICS keeps S4's words and ids.
//

import SwiftUI

struct PulsePreferencesSummarySections: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let model: PulsePreferencesSummaryModel
    /// The area the Pulse page reads, for "Mute a topic"; nil leaves it out.
    let areaId: String?
    let areaName: String?
    /// After any change, so the page reads again.
    let onChanged: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            switch model.state {
            case .loading:
                sectionHeader("FOLLOWING")
                Shimmer(height: 44, cornerRadius: Radii.sm)
                    .accessibilityLabel("Loading what you follow and mute")
            case .error:
                sectionHeader("FOLLOWING")
                retryRow
            case let .loaded(lists):
                following(lists.follows)
                updates(lists.alerts)
                mutedTopics(lists)
                mutedPeople(lists.people)
            }
            if let message = model.message {
                Text(message)
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.error)
                    .padding(.top, Spacing.s2)
                    .accessibilityIdentifier("pulsePreferencesSummaryMessage")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulsePreferencesSummary")
    }

    // MARK: - Sections

    @ViewBuilder private func following(_ follows: [PulsePreferencesFollow]) -> some View {
        sectionHeader("FOLLOWING")
        if follows.isEmpty {
            emptyLine("You're not following anything yet.")
        }
        ForEach(follows) { item in
            let title = model.title(item.follow)
            row(
                RowWords(
                    title: title,
                    detail: PulsePreferencesSummaryModel.detail(item.follow),
                    action: "Stop following",
                    spoken: "Stop following \(title)",
                    rowId: "pulsePreferencesFollow_\(item.id)",
                    buttonId: "pulsePreferencesStopFollowing_\(item.id)"
                ),
                enabled: item.undo != nil && !model.pending.contains("follow-\(item.id)")
            ) {
                if await model.stopFollowing(item) { onChanged() }
            }
        }
    }

    @ViewBuilder private func updates(_ alerts: [PulsePreferencesFollow]) -> some View {
        sectionHeader("UPDATES")
        if alerts.isEmpty {
            emptyLine("Updates are off for everything you follow.")
        }
        ForEach(alerts) { item in
            let title = model.title(item.follow)
            row(
                RowWords(
                    title: title,
                    detail: item.follow.notify == "each" ? "Notify me about each update" : "Daily recap of new replies",
                    action: "Turn off",
                    spoken: "Turn off updates for \(title)",
                    rowId: "pulsePreferencesAlert_\(item.id)",
                    buttonId: "pulsePreferencesTurnOffAlert_\(item.id)"
                ),
                enabled: item.undo != nil && !model.pending.contains("alert-\(item.id)")
            ) {
                if await model.turnOffUpdates(item) { onChanged() }
            }
        }
    }

    private func mutedTopics(_ lists: PulsePreferencesLists) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionHeader("MUTED TOPICS")
            if lists.topicMutes.isEmpty, lists.typeMutes.isEmpty {
                emptyLine("No muted topics.")
            }
            ForEach(lists.topicMutes) { mute in
                let topic = mute.entityId ?? ""
                let name = PulseTopic(stored: topic)?.label ?? topic
                row(
                    RowWords(
                        title: name,
                        detail: mute.areaId.map { "In \(model.areaNames[$0] ?? "one area")" } ?? "Everywhere",
                        action: "Unmute",
                        spoken: "Unmute \(name)",
                        rowId: "pulsePreferencesMutedTopic_\(topic)",
                        buttonId: "pulsePreferencesUnmuteTopic_\(topic)"
                    ),
                    enabled: mute.undo != nil && !model.pending.contains("mute-\(mute.id)")
                ) {
                    if await model.unmute(mute) { onChanged() }
                }
            }
            ForEach(lists.typeMutes) { mute in
                let type = mute.entityId ?? ""
                let name = "\(PulseIntent.from(postType: type).label) posts"
                row(
                    RowWords(
                        title: name,
                        detail: nil,
                        action: "Unmute",
                        spoken: "Unmute \(name)",
                        rowId: "pulsePreferencesMutedType_\(type)",
                        buttonId: "pulsePreferencesUnmuteType_\(type)"
                    ),
                    enabled: mute.undo != nil && !model.pending.contains("mute-\(mute.id)")
                ) {
                    if await model.unmute(mute) { onChanged() }
                }
            }
            muteTopicMenu
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulsePreferencesMutedTopics")
    }

    @ViewBuilder private func mutedPeople(_ people: [PulsePreferencesMute]) -> some View {
        sectionHeader("MUTED PEOPLE")
        if people.isEmpty {
            emptyLine("No muted people.")
        }
        ForEach(people) { mute in
            let entity = mute.entityId ?? mute.id
            let name = model.names[entity] ?? "Someone you muted"
            row(
                RowWords(
                    title: name,
                    detail: mute.entityType == "business" ? "Business" : nil,
                    action: "Unmute",
                    spoken: "Unmute \(name)",
                    rowId: "pulsePreferencesMutedPerson_\(entity)",
                    buttonId: "pulsePreferencesUnmutePerson_\(entity)"
                ),
                enabled: mute.undo != nil && !model.pending.contains("mute-\(mute.id)")
            ) {
                if await model.unmute(mute) { onChanged() }
            }
        }
    }

    /// "Mute a topic in Camas": the topics not muted there yet.
    @ViewBuilder private var muteTopicMenu: some View {
        if let areaId, let areaName, !model.topicsToMute(areaId: areaId).isEmpty {
            Menu {
                ForEach(model.topicsToMute(areaId: areaId)) { topic in
                    Button(topic.label) {
                        Task { if await model.muteTopic(topic, areaId: areaId) { onChanged() } }
                    }
                    .accessibilityIdentifier("pulsePreferencesMuteTopic_\(topic.rawValue)")
                }
            } label: {
                Text("Mute a topic in \(areaName)")
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            }
            .accessibilityIdentifier("pulsePreferencesMuteTopicMenu")
        }
    }

    // MARK: - Pieces

    private var retryRow: some View {
        HStack(spacing: Spacing.s3) {
            Text("Couldn't load what you follow and mute.")
                .pulseFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            Button("Try again") {
                Task { await model.load() }
            }
            .pulseFont(.button)
            .frame(minHeight: 44)
            .accessibilityIdentifier("pulsePreferencesSummaryRetry")
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .pulseFont(.overline)
            .foregroundStyle(Theme.Color.appTextMuted)
            .accessibilityAddTraits(.isHeader)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s2)
    }

    private func emptyLine(_ text: String) -> some View {
        Text(text)
            .pulseFont(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.vertical, Spacing.s2)
    }

    /// One item: its words, then the button that undoes it (beside them, or
    /// under them at the largest text sizes).
    private func row(_ words: RowWords, enabled: Bool, perform: @escaping @MainActor () async -> Void) -> some View {
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Spacing.s1))
            : AnyLayout(HStackLayout(alignment: .center, spacing: Spacing.s3))
        return layout {
            VStack(alignment: .leading, spacing: 2) {
                Text(words.title)
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                if let detail = words.detail {
                    Text(detail)
                        .pulseFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            Button {
                Task { await perform() }
            } label: {
                Text(words.action)
                    .pulseFont(.button)
                    .foregroundStyle(enabled ? Theme.Color.primaryInk : Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s2)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(!enabled)
            .accessibilityLabel(words.spoken)
            .accessibilityIdentifier(words.buttonId)
        }
        .padding(.vertical, Spacing.s1)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier(words.rowId)
    }
}

/// What one row says: its words, its button and VoiceOver's name for it.
private struct RowWords {
    let title: String
    let detail: String?
    let action: String
    let spoken: String
    let rowId: String
    let buttonId: String
}
