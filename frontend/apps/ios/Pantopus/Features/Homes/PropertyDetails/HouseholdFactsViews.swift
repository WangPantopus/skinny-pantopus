//
//  HouseholdFactsViews.swift
//  Pantopus
//
//  A household confirms, corrects and adds to a Home's facts, and reports what it
//  can't correct (`backend/services/householdFacts.js`). All of this comes from what
//  the server sends: a server without it, or someone it isn't for, gets nothing new.
//

import SwiftUI

/// What the controls ask of the screen.
struct HouseholdActions {
    let saving: Bool
    let save: ([HouseholdFactChange]) -> Void
    let edit: (HouseholdGroupDTO) -> Void
    let report: (PropertyRecordSection) -> Void
    /// "Is this your layout?": yes, no or undo.
    var answerLayout: (String) -> Void = { _ in }
    /// The Home, for what this device remembers about it (link and confirm).
    var homeId: String = ""
}

private let otherChip = "__other"

/// "Bedrooms? 1 2 3 4 Other". A tap answers it; Other is the person's own number. Also on Add Home.
struct HouseholdQuestionRow: View {
    let question: HouseholdQuestionDTO
    /// The answer so far, when the field is the screen's own (Add Home).
    var value: String?
    var disabled = false
    let onAnswer: (String) -> Void
    let onOther: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(question.prompt)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
            ChipPicker(
                options: question.options.map { ChipPicker.Option(id: $0.value, label: $0.label) }
                    + [ChipPicker.Option(id: otherChip, label: question.other)],
                selection: selection,
                identifier: "household_question_\(question.key)"
            )
            .disabled(disabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var selection: Binding<String?> {
        Binding(
            get: {
                guard let value, !value.isEmpty else { return nil }
                return question.options.contains { $0.value == value } ? value : otherChip
            },
            set: { chosen in
                if chosen == otherChip {
                    onOther()
                } else if let chosen {
                    onAnswer(chosen)
                }
            }
        )
    }
}

/// The county's own page: a person checks a fact at the source and comes back to confirm it.
struct HouseholdCountyPageLink: View {
    let page: HouseholdCountyPageDTO
    /// Link and confirm: told when the person opens it, so "Is this right?" can wait for them to come back.
    var onOpen: (() -> Void)?

    @Environment(\.openURL) private var openURL

    var body: some View {
        if let url = URL(string: page.url), url.scheme == "https" {
            Button {
                onOpen?()
                openURL(url)
            } label: {
                Text(page.label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.primary600)
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            .accessibilityRemoveTraits(.isButton)
            .accessibilityAddTraits(.isLink)
            .accessibilityIdentifier("household_countyPage")
        }
    }
}

/// One-tap questions for what the record lacks.
struct HouseholdQuestionsCard: View {
    let household: PropertyHouseholdContent
    let actions: HouseholdActions

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            SectionHeader("A few quick questions")
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(household.questions) { question in
                    HouseholdQuestionRow(
                        question: question,
                        disabled: actions.saving,
                        onAnswer: { actions.save([.correct(question.key, value: $0)]) },
                        onOther: { openFact(question.key) }
                    )
                }
                if let page = household.countyPage, household.countyCheck == nil {
                    HouseholdCountyPageLink(page: page)
                }
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            }
        }
    }

    private func openFact(_ key: String) {
        guard let fact = household.fact(key) else { return }
        actions.edit(HouseholdGroupDTO(single: fact))
    }
}

private extension HouseholdGroupDTO {
    /// The editor for one fact, typed in: Other was the answer.
    init(single fact: HouseholdFactDTO) {
        self.init(
            id: fact.key,
            sectionId: nil,
            title: fact.label,
            lead: nil,
            prompt: nil,
            confirmed: nil,
            fix: nil,
            facts: [fact.typedOnly],
            report: nil,
            reported: nil
        )
    }
}

private extension HouseholdFactDTO {
    var typedOnly: HouseholdFactDTO {
        HouseholdFactDTO(
            key: key,
            label: label,
            value: value,
            current: current,
            note: note,
            input: input,
            unit: unit,
            options: [],
            canUndo: canUndo
        )
    }
}

/// The foot of a record card: "Is this right?", what the household said, "Report a problem".
struct HouseholdGroupFooter: View {
    let group: HouseholdGroupDTO
    let section: PropertyRecordSection
    let actions: HouseholdActions

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let confirmed = group.confirmed {
                HStack(spacing: Spacing.s2) {
                    Text(confirmed)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s2)
                    action("Undo", id: "undo") { actions.save([.undoConfirm(group: group.id)]) }
                }
            }
            if let prompt = group.prompt {
                HStack(spacing: Spacing.s3) {
                    Text(prompt)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    action("Yes", id: "yes") { actions.save([.confirm(group: group.id)]) }
                }
            }
            if let reported = group.reported {
                Text(reported)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let fix = group.fix {
                action(fix, id: "fix") { actions.edit(group) }
            }
            if let report = group.report {
                action(report, id: "report") { actions.report(section) }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
    }

    private func action(_ title: String, id: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            Text(title)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.primary600)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(actions.saving)
        .accessibilityIdentifier("propertyDetails_household_\(group.id)_\(id)")
    }
}

/// "Add details": for what the record has no card for.
struct HouseholdAddDetailsCard: View {
    let group: HouseholdGroupDTO
    let actions: HouseholdActions

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let lead = group.lead {
                Text(lead)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button { actions.edit(group) } label: {
                Text(group.fix ?? group.title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(actions.saving)
            .accessibilityIdentifier("propertyDetails_household_add")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }
}

/// "Fix something" and "Add details": tap what's right, or type it.
struct HouseholdFactEditorSheet: View {
    let group: HouseholdGroupDTO
    /// Opened from "Is this right?" after the county's page: what's saved is checked there, the facts left as they were too.
    var checkGroup: String?
    let onSave: ([HouseholdFactChange]) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var drafts: [String: String] = [:]
    @State private var typing: Set<String> = []
    @State private var saving = false
    @State private var failed = false

    private var changes: [HouseholdFactChange] {
        group.facts.compactMap { fact in
            guard let value = drafts[fact.key]?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty,
                  value != fact.current else { return nil }
            return checkGroup == nil ? .correct(fact.key, value: value) : .correctFromCountyPage(fact.key, value: value)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text(group.lead ?? "Tap what's right. The county's own record stays as it is.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if failed {
                        Text("Couldn't save that. Check it and try again.")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("household_editor_error")
                    }
                    ForEach(group.facts) { fact in
                        factField(fact)
                    }
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.Color.appBg.ignoresSafeArea())
            .navigationTitle(group.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("household_editor_cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save(checkGroup.map { changes + [.confirm(group: $0)] } ?? changes) } }
                        .disabled(changes.isEmpty || saving)
                        .accessibilityIdentifier("household_editor_save")
                }
            }
        }
    }

    private func save(_ changes: [HouseholdFactChange]) async {
        saving = true
        failed = false
        let saved = await onSave(changes)
        saving = false
        if saved { dismiss() } else { failed = true }
    }

    private func factField(_ fact: HouseholdFactDTO) -> some View {
        let value = drafts[fact.key] ?? fact.current
        let known = fact.options.contains { $0.value.caseInsensitiveCompare(value) == .orderedSame }
        let showsField = fact.options.isEmpty || typing.contains(fact.key) || (!value.isEmpty && !known)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                Text(fact.label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                if fact.canUndo {
                    Button("Undo") { Task { await save([.undo(fact.key)]) } }
                        .font(Theme.Font.role(.small))
                        .foregroundStyle(Theme.Color.primary600)
                        .buttonStyle(.plain)
                        .disabled(saving)
                        .accessibilityIdentifier("household_fact_\(fact.key)_undo")
                }
            }
            if !fact.options.isEmpty {
                ChipPicker(
                    options: fact.options.map { ChipPicker.Option(id: $0.value, label: $0.label) }
                        + [ChipPicker.Option(id: otherChip, label: "Other")],
                    selection: chipSelection(fact, value: value, known: known, showsField: showsField),
                    identifier: "household_fact_\(fact.key)"
                )
            }
            if showsField {
                TextField(fact.unit ?? "", text: Binding(
                    get: { drafts[fact.key] ?? fact.current },
                    set: { drafts[fact.key] = $0 }
                ))
                .font(Theme.Font.role(.small))
                .foregroundStyle(Theme.Color.appText)
                .keyboardType(fact.input == "text" ? .default : fact.input == "decimal" ? .decimalPad : .numberPad)
                .autocorrectionDisabled(fact.input != "text")
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
                .typesInFieldOnTap()
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                }
                .accessibilityLabel(fact.label)
                .accessibilityIdentifier("household_fact_\(fact.key)_field")
            }
            if let note = fact.note {
                Text(note)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    private func chipSelection(_ fact: HouseholdFactDTO, value: String, known: Bool, showsField: Bool) -> Binding<String?> {
        Binding(
            get: {
                if showsField { return otherChip }
                return known ? fact.options.first { $0.value.caseInsensitiveCompare(value) == .orderedSame }?.value : nil
            },
            set: { chosen in
                if chosen == otherChip {
                    typing.insert(fact.key)
                } else if let chosen {
                    typing.remove(fact.key)
                    drafts[fact.key] = chosen
                }
            }
        )
    }
}

/// "Report a problem": it reaches review, and the page stays as it is.
struct HouseholdReportSheet: View {
    let section: PropertyRecordSection
    let onSend: (String?, String?) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var field: String?
    @State private var note = ""
    @State private var sending = false
    @State private var failed = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text("We'll check it against the county's record. This page stays as it is until the county's record changes.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if failed {
                        Text("Couldn't send that. Please try again.")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                    }
                    Text("What looks wrong?")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                    ChipPicker(
                        options: section.rows.map { ChipPicker.Option(id: $0.id, label: $0.label) },
                        selection: $field,
                        identifier: "household_report_field"
                    )
                    Text("Anything to add? (optional)")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                    TextField("", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                        .font(Theme.Font.role(.small))
                        .foregroundStyle(Theme.Color.appText)
                        .padding(Spacing.s3)
                        .typesInFieldOnTap()
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        }
                        .accessibilityLabel("Anything to add")
                        .accessibilityIdentifier("household_report_note")
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.Color.appBg.ignoresSafeArea())
            .navigationTitle("Report a problem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("household_report_cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { await send() } }
                        .disabled(sending)
                        .accessibilityIdentifier("household_report_send")
                }
            }
        }
    }

    private func send() async {
        sending = true
        failed = false
        let text = String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(500))
        let sent = await onSend(field, text.isEmpty ? nil : text)
        sending = false
        if sent { dismiss() } else { failed = true }
    }
}
