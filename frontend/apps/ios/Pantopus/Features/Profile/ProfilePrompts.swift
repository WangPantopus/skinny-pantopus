//
//  ProfilePrompts.swift
//  Pantopus
//
//  "Get to know <name>" (the 11-01 redesign, `Main.dc.html`): the prompt
//  catalog (the server stores keys; the apps own the words), the card on a
//  profile, the picker (`PromptPicker.dc.html`) and the answer screen with
//  its 120-character counter. No prompt asks where someone will be or when.
//

import SwiftUI

/// The ten prompts, in the order the picker lists them (brief Appendix B).
public enum ProfilePromptCatalog {
    public struct Entry: Identifiable, Hashable, Sendable {
        public let key: String
        public let text: String

        public var id: String {
            key
        }
    }

    public static let all: [Entry] = [
        Entry(key: "ask_me_about", text: "Ask me about…"),
        Entry(key: "i_can_lend", text: "I can lend…"),
        Entry(key: "best_spot", text: "Best spot around here…"),
        Entry(key: "new_here_recommend", text: "New here? I'd recommend…"),
        Entry(key: "looking_for", text: "Looking for…"),
        Entry(key: "favorite_local_food", text: "My favorite local food…"),
        Entry(key: "something_learning", text: "Something I'm learning…"),
        Entry(key: "lived_here_since", text: "I've lived here since…"),
        Entry(key: "best_way_to_say_hi", text: "Best way to say hi…"),
        Entry(key: "neighborhood_tradition", text: "A neighborhood tradition I love…")
    ]

    /// At most three answers, each up to 120 characters (the server's checks).
    public static let maxPrompts = 3
    public static let maxAnswerLength = 120

    public static func text(for key: String) -> String? {
        all.first { $0.key == key }?.text
    }

    /// The answers this app can show, in saved order: a key from a newer
    /// catalog, or an empty answer, is skipped.
    public static func shown(_ prompts: [ProfilePrompt]?) -> [ProfilePrompt] {
        (prompts ?? []).filter { prompt in
            text(for: prompt.key) != nil && !prompt.answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }
}

// MARK: - Profile card

/// "Get to know <name>": their answers in saved order. On your own profile
/// Edit opens the editor.
@MainActor
struct ProfilePromptsCard: View {
    let firstName: String
    let prompts: [ProfilePrompt]
    var onEdit: (@MainActor () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ProfileSectionTitle(title: "Get to know \(firstName)", onEdit: onEdit, editLabel: "Edit your prompts")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(prompts.enumerated()), id: \.element.key) { index, prompt in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(ProfilePromptCatalog.text(for: prompt.key) ?? "")
                            .scaledFont(13, weight: .semibold)
                            .foregroundStyle(Theme.Color.appTextMuted)
                        Text(prompt.answer)
                            .scaledFont(17)
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Spacing.s3)
                    .accessibilityElement(children: .combine)
                    if index < prompts.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorder)
                            .frame(height: 1)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfilePrompts")
    }
}

/// A profile section's title, with Edit on your own profile.
@MainActor
struct ProfileSectionTitle: View {
    let title: String
    var icon: PantopusIcon?
    var onEdit: (@MainActor () -> Void)?
    var editLabel = "Edit"

    var body: some View {
        HStack(spacing: 6) {
            if let icon {
                Icon(icon, size: 18, color: Theme.Color.appTextSecondary)
                    .accessibilityHidden(true)
            }
            Text(title)
                .scaledFont(20, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s2)
            if let onEdit {
                Button(action: onEdit) {
                    Text("Edit")
                        .scaledFont(17)
                        .foregroundStyle(Theme.Color.primaryInk)
                        // A 44 pt target without a taller row (the drawing's negative margins).
                        .hitArea(horizontal: 8, vertical: 12)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(editLabel)
            }
        }
        .frame(minHeight: 25)
    }
}

// MARK: - Picker

/// The prompt picker (`PromptPicker.dc.html`): all ten, the ones in use
/// marked "In use"; picking one opens its answer screen.
@MainActor
struct ProfilePromptPicker: View {
    let usedKeys: Set<String>
    let onSave: @MainActor (ProfilePrompt) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Pick up to 3. A short, friendly answer works best.")
                        .scaledFont(15)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, Spacing.s1)
                    VStack(spacing: Spacing.s0) {
                        ForEach(Array(ProfilePromptCatalog.all.enumerated()), id: \.element.key) { index, entry in
                            row(entry)
                            if index < ProfilePromptCatalog.all.count - 1 {
                                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                            }
                        }
                    }
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Pick a prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .navigationDestination(for: String.self) { key in
                ProfilePromptAnswerView(key: key, initialAnswer: "") { answer in
                    onSave(ProfilePrompt(key: key, answer: answer))
                    dismiss()
                }
            }
        }
        .accessibilityIdentifier("profilePromptPicker")
    }

    @ViewBuilder
    private func row(_ entry: ProfilePromptCatalog.Entry) -> some View {
        let inUse = usedKeys.contains(entry.key)
        let label = HStack(spacing: 10) {
            Text(entry.text)
                .scaledFont(17)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s2)
            if inUse {
                Text("In use")
                    .scaledFont(12, weight: .semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
            } else {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, 14)
        .frame(minHeight: 54)
        .contentShape(Rectangle())
        if inUse {
            label
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(entry.text), in use")
        } else {
            NavigationLink(value: entry.key) { label }
                .buttonStyle(.plain)
                .accessibilityIdentifier("profilePromptOption_\(entry.key)")
        }
    }
}

// MARK: - Answer

/// One prompt's answer: up to 120 characters with a counter, Save, and
/// Remove for an answer you already gave.
@MainActor
struct ProfilePromptAnswerView: View {
    let key: String
    let onSave: @MainActor (String) -> Void
    var onRemove: (@MainActor () -> Void)?

    @State private var answer: String
    @FocusState private var focused: Bool

    init(
        key: String,
        initialAnswer: String,
        onRemove: (@MainActor () -> Void)? = nil,
        onSave: @escaping @MainActor (String) -> Void
    ) {
        self.key = key
        self.onRemove = onRemove
        self.onSave = onSave
        _answer = State(initialValue: initialAnswer)
    }

    private var trimmed: String {
        answer.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(ProfilePromptCatalog.text(for: key) ?? "")
                    .scaledFont(17, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                TextField("Your answer", text: $answer, axis: .vertical)
                    .scaledFont(17)
                    .lineLimit(3...6)
                    .focused($focused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .accessibilityIdentifier("profilePromptAnswerField")
                    .onChange(of: answer) { _, value in
                        if value.count > ProfilePromptCatalog.maxAnswerLength {
                            answer = String(value.prefix(ProfilePromptCatalog.maxAnswerLength))
                        }
                    }
                Text("\(answer.count) / \(ProfilePromptCatalog.maxAnswerLength)")
                    .scaledFont(13)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .accessibilityLabel("\(answer.count) of \(ProfilePromptCatalog.maxAnswerLength) characters")
                if let onRemove {
                    Button(role: .destructive, action: onRemove) {
                        Text("Remove this prompt")
                            .scaledFont(17)
                            .foregroundStyle(Theme.Color.error)
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, Spacing.s4)
                    .accessibilityIdentifier("profilePromptRemove")
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Your answer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { onSave(trimmed) }
                    .disabled(trimmed.isEmpty)
                    .accessibilityIdentifier("profilePromptSave")
            }
        }
        .onAppear { focused = true }
    }
}
