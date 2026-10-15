//
//  PulseComposerSections.swift
//  Pantopus
//
//  The parts of the one-box composer under the text (Pulse S8, wireframe
//  2, appendix "Composer"): PANTOPUS SUGGESTS with Type, About and Topic,
//  the details a type needs, the two promises (Who can read, Shown to) and
//  "Posting as". Scalable type; every row names itself and its value for
//  VoiceOver; nothing carries meaning by color alone.
//

import SwiftUI

struct PulseComposerSuggestCard: View {
    @Bindable var model: PulseComposerModel
    let onAbout: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("PANTOPUS SUGGESTS · TAP TO CHANGE")
                .pulseFont(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(Spacing.s3)
                .accessibilityAddTraits(.isHeader)
            divider
            Menu {
                ForEach(model.kinds) { kind in
                    Button(kind.label) { model.choose(kind: kind) }
                        .accessibilityIdentifier("pulseComposerType_\(kind.rawValue)")
                }
            } label: {
                PulseComposerRow(title: "Type", value: model.draft.kind.label)
            }
            .accessibilityIdentifier("pulseComposerType")
            divider
            Button(action: onAbout) {
                PulseComposerRow(title: "About", value: model.aboutWords)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulseComposerAbout")
            divider
            Menu {
                Button("No topic") { model.choose(topic: nil) }
                ForEach(PulseTopic.allCases) { topic in
                    Button(topic.label) { model.choose(topic: topic) }
                        .accessibilityIdentifier("pulseComposerTopic_\(topic.rawValue)")
                }
            } label: {
                PulseComposerRow(title: "Topic", value: model.topic?.label ?? "No topic")
            }
            .accessibilityIdentifier("pulseComposerTopic")
        }
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.md))
        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Theme.Color.appBorder, lineWidth: 1))
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

/// "Type  Ask  ›": one row of the suggestions or the promises.
struct PulseComposerRow: View {
    let title: String
    let value: String
    var detail: String?
    var showsChevron = true

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s3) {
            Text(title)
                .pulseFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(minWidth: 72, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .pulseFont(.headline)
                    .foregroundStyle(Theme.Color.appText)
                if let detail {
                    Text(detail)
                        .pulseFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsChevron {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
        }
        .padding(Spacing.s3)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel([title, value, detail].compactMap(\.self).joined(separator: ", "))
    }
}

/// What a type needs besides its words: who gets an offer, when a heads-up
/// ends, when an event starts, lost or found.
struct PulseComposerTypeDetails: View {
    @Bindable var model: PulseComposerModel

    var body: some View {
        switch model.draft.kind {
        case .offer:
            picker("Who gets it", selection: $model.draft.claimMode, choices: [("choose", "I choose"), ("first", "First to ask")])
        case .headsUp:
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack {
                    Text("Kind").pulseFont(.body).foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    Picker("Kind", selection: $model.draft.headsUpKind) {
                        ForEach(PulseSafetyAlertKind.allCases, id: \.rawValue) { Text($0.label).tag($0.rawValue) }
                    }
                    .pickerStyle(.menu)
                    .accessibilityIdentifier("pulseComposerHeadsUpKind")
                }
                DatePicker("Ends", selection: headsUpEnds, in: Date()...Date().addingTimeInterval(14 * 24 * 3600))
                    .pulseFont(.body)
                    .accessibilityIdentifier("pulseComposerHeadsUpEnds")
            }
        case .event:
            DatePicker("Starts", selection: eventStarts, in: Date()...)
                .pulseFont(.body)
                .accessibilityIdentifier("pulseComposerEventStarts")
        case .lostFound:
            picker("Lost or found", selection: $model.draft.lostFound, choices: [("lost", "Lost"), ("found", "Found")])
        case .ask, .share:
            EmptyView()
        }
    }

    private var headsUpEnds: Binding<Date> {
        Binding(
            get: { model.draft.headsUpEnds ?? Date().addingTimeInterval(48 * 3600) },
            set: { model.draft.headsUpEnds = $0 }
        )
    }

    private var eventStarts: Binding<Date> {
        Binding(
            get: { model.draft.eventStarts ?? Date().addingTimeInterval(24 * 3600) },
            set: { model.draft.eventStarts = $0 }
        )
    }

    private func picker(_ title: String, selection: Binding<String>, choices: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title)
                .pulseFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Picker(title, selection: selection) {
                ForEach(choices, id: \.0) { Text($0.1).tag($0.0) }
            }
            .pickerStyle(.segmented)
        }
    }
}

/// The two promises, always shown (build spec §5): who can read it and who
/// it's shown to.
struct PulseComposerPromises: View {
    @Bindable var model: PulseComposerModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            whoCanRead
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            PulseComposerRow(
                title: "Shown to",
                value: "Nearby readers in \(model.area?.name ?? "your town")",
                detail: model.topic.map { "and people who follow \($0.label)" },
                showsChevron: false
            )
            .accessibilityIdentifier("pulseComposerShownTo")
            if let topic = model.topic {
                Text(Self.followersLine(topic))
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Spacing.s3)
                    .background(Theme.Color.infoBg)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
    }

    /// A town post is Public or for its verified neighbors; a street or
    /// neighborhood post is always for its verified neighbors.
    @ViewBuilder private var whoCanRead: some View {
        if model.area?.kind == "town" {
            Menu {
                Button("Public") { model.draft.townVerifiedOnly = false }
                Button("Verified neighbors") { model.draft.townVerifiedOnly = true }
            } label: {
                PulseComposerRow(title: "Who can read", value: whoValue, detail: whoDetail)
            }
            .accessibilityIdentifier("pulseComposerWhoCanRead")
        } else {
            PulseComposerRow(title: "Who can read", value: whoValue, detail: whoDetail, showsChevron: false)
                .accessibilityIdentifier("pulseComposerWhoCanRead")
        }
    }

    private var whoValue: String {
        model.readScope == "public" ? "Public" : "Verified neighbors"
    }

    private var whoDetail: String {
        model.readScope == "public"
            ? "Anyone can read and share it"
            : "Only verified neighbors of \(model.area?.name ?? "this area") can read it"
    }

    /// "Showing it to gardeners doesn't limit who can read it." (appendix);
    /// the other topics name their followers.
    static func followersLine(_ topic: PulseTopic) -> String {
        let readers = topic == .gardening ? "gardeners" : "people who follow \(topic.label)"
        return "Showing it to \(readers) doesn't limit who can read it."
    }
}

/// "Posting as Dana [New here]": the label shows once a post has worn it.
struct PulseComposerPostingAs: View {
    let name: String
    let label: PulseAuthorLabel?

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text("Posting as \(name)")
                .pulseFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let label { PulseAuthorLabelChip(label: label) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("pulseComposerPostingAs")
    }
}
