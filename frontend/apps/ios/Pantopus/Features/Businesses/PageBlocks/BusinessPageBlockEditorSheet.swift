//
//  BusinessPageBlockEditorSheet.swift
//  Pantopus
//
//  C4 — per-block field editor + the "Add block" type picker. Mirrors RN
//  `src/components/business/blocks/BlockEditor.tsx` and `BlockTypePicker.tsx`.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

// MARK: - Type picker

/// Grid of block types the owner can add. Unknown types never appear here —
/// the picker is driven off `BusinessPageBlockKind.pickable`.
@MainActor
public struct BusinessPageBlockTypePicker: View {
    private let onSelect: @MainActor (BusinessPageBlockKind) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        onSelect: @escaping @MainActor (BusinessPageBlockKind) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.onSelect = onSelect
        self.onClose = onClose
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(spacing: Spacing.s3), count: 2),
                    spacing: Spacing.s3
                ) {
                    ForEach(BusinessPageBlockKind.pickable, id: \.rawValue) { kind in
                        let entry = BusinessPageBlockRegistry.entry(for: kind)
                        Button {
                            onSelect(kind)
                        } label: {
                            VStack(alignment: .leading, spacing: Spacing.s2) {
                                Icon(entry.icon, size: 24, color: Theme.Color.primary600)
                                Text(entry.label)
                                    .pantopusTextStyle(.body)
                                    .foregroundStyle(Theme.Color.appTextStrong)
                                Text(entry.summary)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Spacing.s3)
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("businessPageBlocks.pick.\(kind.rawValue)")
                    }
                }
                .padding(Spacing.s3)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Add block")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onClose() }
                        .accessibilityIdentifier("businessPageBlocks.picker.cancel")
                }
            }
        }
        .accessibilityIdentifier("businessPageBlocks.picker")
    }
}

// MARK: - Block editor

/// Field editor for one block. Edits a local copy and hands it back on Done,
/// matching RN's modal semantics (Cancel discards).
@MainActor
public struct BusinessPageBlockEditorSheet: View {
    @State private var draft: BusinessPageBlock
    @State private var showsSettings = false

    private let onSave: @MainActor (BusinessPageBlock) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        block: BusinessPageBlock,
        onSave: @escaping @MainActor (BusinessPageBlock) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        _draft = State(initialValue: block)
        self.onSave = onSave
        self.onClose = onClose
    }

    private var entry: BusinessPageBlockRegistryEntry {
        BusinessPageBlockRegistry.entry(for: draft.kind)
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    typeBadge
                    fields
                    settingsSection
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Edit \(entry.label)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onClose() }
                        .accessibilityIdentifier("businessPageBlocks.editor.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { onSave(draft) }
                        .accessibilityIdentifier("businessPageBlocks.editor.done")
                }
            }
        }
        .accessibilityIdentifier("businessPageBlocks.editor")
    }

    private var typeBadge: some View {
        HStack(spacing: Spacing.s2) {
            Icon(entry.icon, size: 18, color: Theme.Color.primary600)
            Text(entry.label)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.primary600)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Type-specific fields

    @ViewBuilder private var fields: some View {
        switch BusinessPageBlockForm(kind: draft.kind) {
        case .hero:
            stringField("Headline", key: "headline", placeholder: "Your headline")
            stringField("Subhead", key: "subhead", placeholder: "Supporting text")
            buttonListEditor(title: "Call-to-Action Buttons", key: "cta")
        case .text:
            stringField("Heading", key: "heading", placeholder: "Section heading")
            stringField("Body", key: "body", placeholder: "Body text…")
        case .gallery:
            stringField("Heading", key: "heading", placeholder: "Gallery")
            numberField("Image Count", key: "image_count", fallback: 6)
            hint("Image uploads available in the media manager")
        case .catalog:
            stringField("Heading", key: "heading", placeholder: "Our Services")
            chipRow(
                title: "Filter",
                options: BusinessPageBlockOptions.catalogFilterKinds,
                selected: draft.filterKind
            ) { key in setString("filter_kind", key) }
            numberField("Max Items", key: "max_items", fallback: 8)
        case .cta:
            stringField("Heading", key: "heading", placeholder: "Ready to get started?")
            stringField("Subhead", key: "subhead", placeholder: "Supporting text")
            buttonListEditor(title: "Buttons", key: "buttons")
        case .faq:
            stringField("Heading", key: "heading", placeholder: "FAQ")
            faqEditor
        case .stats:
            statsEditor
        case .embed:
            stringField("URL", key: "url", placeholder: "https://youtube.com/…")
            hint("YouTube, Vimeo, Google Maps, and other embeddable URLs")
        case .postsFeed:
            stringField("Heading", key: "heading", placeholder: "Latest Updates")
            numberField("Max Items", key: "max_items", fallback: 5)
        case let .headingOnly(hintText):
            stringField("Heading", key: "heading", placeholder: "Section heading")
            hint(hintText)
        case let .note(note):
            hint(note)
        case let .unsupported(type):
            hint("Unknown block type: \(type). Update the app to edit this block.")
        }
    }

    // MARK: - Settings

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button {
                showsSettings.toggle()
            } label: {
                HStack {
                    Text("Block settings")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    Icon(showsSettings ? .chevronUp : .chevronDown, size: 18, color: Theme.Color.appTextSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessPageBlocks.editor.settingsToggle")

            if showsSettings {
                Toggle(isOn: visibleBinding) {
                    Text("Visible to visitors")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("businessPageBlocks.editor.visible")

                chipRow(
                    title: "Padding",
                    options: BusinessPageBlockOptions.padding,
                    selected: draft.settings["padding"]?.stringValue ?? "default"
                ) { key in draft.settings["padding"] = .string(key) }

                chipRow(
                    title: "Background",
                    options: BusinessPageBlockOptions.background,
                    selected: draft.settings["background"]?.stringValue ?? "default"
                ) { key in draft.settings["background"] = .string(key) }
            }
        }
        .padding(.top, Spacing.s3)
    }

    private var visibleBinding: Binding<Bool> {
        Binding(get: { draft.isVisible }, set: { draft.isVisible = $0 })
    }

    // MARK: - Field builders

    private func stringField(_ label: String, key: String, placeholder: String) -> some View {
        PantopusTextField(
            label,
            text: Binding(
                get: { draft.data[key]?.stringValue ?? "" },
                set: { setString(key, $0) }
            ),
            placeholder: placeholder,
            identifier: "businessPageBlocks.field.\(key)"
        )
    }

    private func numberField(_ label: String, key: String, fallback: Int) -> some View {
        PantopusTextField(
            label,
            text: Binding(
                get: {
                    if let number = draft.data[key]?.numberValue { return String(Int(number)) }
                    return String(fallback)
                },
                set: { draft.data[key] = .number(Double(Int($0) ?? fallback)) }
            ),
            placeholder: String(fallback),
            keyboardType: .numberPad,
            identifier: "businessPageBlocks.field.\(key)"
        )
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chipRow(
        title: String,
        options: [(key: String, label: String)],
        selected: String,
        onSelect: @escaping @MainActor (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(options, id: \.key) { option in
                        Button {
                            onSelect(option.key)
                        } label: {
                            Text(option.label)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(
                                    selected == option.key
                                        ? Theme.Color.appTextInverse
                                        : Theme.Color.appTextSecondary
                                )
                                .padding(.horizontal, Spacing.s3)
                                .padding(.vertical, Spacing.s2)
                                .background(
                                    selected == option.key
                                        ? Theme.Color.primary600
                                        : Theme.Color.appSurface
                                )
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - List editors

    private func buttonListEditor(title: String, key: String) -> some View {
        let buttons = draft.buttonList(key: key)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ForEach(Array(buttons.enumerated()), id: \.offset) { index, button in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        PantopusTextField(
                            "Label",
                            text: Binding(
                                get: { button.label },
                                set: { newValue in
                                    var next = buttons
                                    next[index] = BusinessPageBlockButton(label: newValue, action: button.action)
                                    setButtons(key, next)
                                }
                            ),
                            placeholder: "Button label"
                        )
                        removeButton(identifier: "businessPageBlocks.removeButton.\(index)") {
                            var next = buttons
                            next.remove(at: index)
                            setButtons(key, next)
                        }
                    }
                    chipRow(
                        title: "Action",
                        options: BusinessPageBlockOptions.ctaActions,
                        selected: button.action
                    ) { action in
                        var next = buttons
                        next[index] = BusinessPageBlockButton(label: button.label, action: action)
                        setButtons(key, next)
                    }
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            addRow(title: "Add button", identifier: "businessPageBlocks.addButton.\(key)") {
                setButtons(key, buttons + [BusinessPageBlockButton(label: "", action: "message")])
            }
        }
    }

    private var faqEditor: some View {
        let items = draft.faqItems
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Questions & answers")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        PantopusTextField(
                            "Question",
                            text: Binding(
                                get: { item.question },
                                set: { newValue in
                                    var next = items
                                    next[index] = BusinessPageBlockFaqItem(question: newValue, answer: item.answer)
                                    setFaq(next)
                                }
                            ),
                            placeholder: "Question"
                        )
                        removeButton(identifier: "businessPageBlocks.removeFaq.\(index)") {
                            var next = items
                            next.remove(at: index)
                            setFaq(next)
                        }
                    }
                    PantopusTextField(
                        "Answer",
                        text: Binding(
                            get: { item.answer },
                            set: { newValue in
                                var next = items
                                next[index] = BusinessPageBlockFaqItem(question: item.question, answer: newValue)
                                setFaq(next)
                            }
                        ),
                        placeholder: "Answer"
                    )
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            addRow(title: "Add question", identifier: "businessPageBlocks.addFaq") {
                setFaq(items + [BusinessPageBlockFaqItem(question: "", answer: "")])
            }
        }
    }

    private var statsEditor: some View {
        let stats = draft.stats
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Stats")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            ForEach(Array(stats.enumerated()), id: \.offset) { index, stat in
                HStack(alignment: .top, spacing: Spacing.s2) {
                    PantopusTextField(
                        "Value",
                        text: Binding(
                            get: { stat.value },
                            set: { newValue in
                                var next = stats
                                next[index] = BusinessPageBlockStat(label: stat.label, value: newValue)
                                setStats(next)
                            }
                        ),
                        placeholder: "100+"
                    )
                    PantopusTextField(
                        "Label",
                        text: Binding(
                            get: { stat.label },
                            set: { newValue in
                                var next = stats
                                next[index] = BusinessPageBlockStat(label: newValue, value: stat.value)
                                setStats(next)
                            }
                        ),
                        placeholder: "Customers"
                    )
                    removeButton(identifier: "businessPageBlocks.removeStat.\(index)") {
                        var next = stats
                        next.remove(at: index)
                        setStats(next)
                    }
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            addRow(title: "Add stat", identifier: "businessPageBlocks.addStat") {
                setStats(stats + [BusinessPageBlockStat(label: "", value: "")])
            }
        }
    }

    private func removeButton(
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(.xCircle, size: 20, color: Theme.Color.error)
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s5)
        .accessibilityIdentifier(identifier)
    }

    private func addRow(
        title: String,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(.plusCircle, size: 18, color: Theme.Color.primary600)
                Text(title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    // MARK: - Data writes

    private func setString(_ key: String, _ value: String) {
        draft.data[key] = .string(value)
    }

    private func setButtons(_ key: String, _ buttons: [BusinessPageBlockButton]) {
        draft.data[key] = .array(buttons.map(\.json))
    }

    private func setFaq(_ items: [BusinessPageBlockFaqItem]) {
        draft.data["items"] = .array(items.map(\.json))
    }

    private func setStats(_ stats: [BusinessPageBlockStat]) {
        draft.data["stats"] = .array(stats.map(\.json))
    }
}
