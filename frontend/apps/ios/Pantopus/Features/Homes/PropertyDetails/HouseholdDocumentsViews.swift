//
//  HouseholdDocumentsViews.swift
//  Pantopus
//
//  "From your papers": a household sends a PDF of its home's inspection report, appraisal or listing sheet; the
//  server reads it, keeps nothing, and lists the facts it states. The household marks each one Right, Fix or Skip,
//  and only what it keeps is saved (`backend/services/householdDocuments`). The card's words come from the server:
//  without them, nothing new is drawn.
//

import SwiftUI

/// Where "Add from a document" stands on this visit.
struct HouseholdDocumentsState {
    var reading = false
    var error: String?
    var notice: String?
}

/// "From your papers", in the style of the "Add details" card.
struct HouseholdDocumentsCard: View {
    let offer: HouseholdDocumentsOfferDTO
    let state: HouseholdDocumentsState
    let saving: Bool
    let onPick: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(offer.title)
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text(offer.lead)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let notice = state.notice {
                Text(notice)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("propertyDetails_documents_notice")
            }
            if let error = state.error {
                Text(error)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("propertyDetails_documents_error")
            }
            Button(action: onPick) {
                HStack(spacing: Spacing.s2) {
                    if state.reading { ProgressView().controlSize(.small) }
                    Text(state.reading ? "Reading your report…" : offer.action)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(state.reading || saving)
            .accessibilityIdentifier("propertyDetails_documents_add")
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

private enum DocumentChoice: String {
    case keep, fix, skip
}

private let documentChoices: [ChipPicker.Option] = [
    ChipPicker.Option(id: DocumentChoice.keep.rawValue, label: "Right"),
    ChipPicker.Option(id: DocumentChoice.fix.rawValue, label: "Fix"),
    ChipPicker.Option(id: DocumentChoice.skip.rawValue, label: "Skip")
]
private let otherAnswer = "__other"

/// "Check what we found": each fact the report states, kept only when the household says so. Same sheet as
/// "Fix something".
struct DocumentFactsSheet: View {
    let answer: DocumentFactsAnswerDTO
    let onSave: ([DocumentFactsSaveRequest.Fact]) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var choices: [String: String] = [:]
    @State private var drafts: [String: String] = [:]
    @State private var typing: Set<String> = []
    @State private var saving = false
    @State private var failed = false

    private var kept: [DocumentFactsSaveRequest.Fact] {
        answer.facts.compactMap { fact in
            switch choices[fact.key] {
            case DocumentChoice.keep.rawValue:
                return DocumentFactsSaveRequest.Fact(key: fact.key, value: fact.current)
            case DocumentChoice.fix.rawValue:
                let value = (drafts[fact.key] ?? fact.current).trimmingCharacters(in: .whitespacesAndNewlines)
                return value.isEmpty ? nil : DocumentFactsSaveRequest.Fact(key: fact.key, value: value)
            default:
                return nil
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text(answer.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let message = answer.message {
                        Text(message)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("documentFacts_message")
                    } else {
                        Text(answer.lead)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        if failed {
                            Text("Couldn't save that. Check it and try again.")
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.error)
                                .accessibilityIdentifier("documentFacts_error")
                        }
                        ForEach(answer.facts) { fact in
                            factRow(fact)
                        }
                        if let missing = answer.missing {
                            Text(missing)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.Color.appBg.ignoresSafeArea())
            .navigationTitle(answer.message == nil ? "Check what we found" : answer.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(answer.message == nil ? "Cancel" : "Close") { dismiss() }
                        .accessibilityIdentifier("documentFacts_cancel")
                }
                if answer.message == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(kept.isEmpty ? "Save" : "Save \(kept.count)") { Task { await save() } }
                            .disabled(kept.isEmpty || saving)
                            .accessibilityIdentifier("documentFacts_save")
                    }
                }
            }
        }
    }

    private func save() async {
        saving = true
        failed = false
        let saved = await onSave(kept)
        saving = false
        if saved { dismiss() } else { failed = true }
    }

    private func factRow(_ fact: DocumentFactDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                Text(fact.label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Text(fact.value ?? fact.current)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.trailing)
            }
            if let note = fact.note {
                Text(note)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text(fact.source)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            ChipPicker(
                options: documentChoices,
                selection: Binding(get: { choices[fact.key] }, set: { choices[fact.key] = $0 }),
                identifier: "documentFacts_\(fact.key)"
            )
            if choices[fact.key] == DocumentChoice.fix.rawValue {
                fixField(fact)
            }
        }
        .padding(.bottom, Spacing.s2)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("documentFacts_row_\(fact.key)")
    }

    /// The fact's own choices and field, as "Fix something" has them, starting from the report's value.
    private func fixField(_ fact: DocumentFactDTO) -> some View {
        let value = drafts[fact.key] ?? fact.current
        let known = fact.options.contains { $0.value.caseInsensitiveCompare(value) == .orderedSame }
        let showsField = fact.options.isEmpty || typing.contains(fact.key) || (!value.isEmpty && !known)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            if !fact.options.isEmpty {
                ChipPicker(
                    options: fact.options.map { ChipPicker.Option(id: $0.value, label: $0.label) }
                        + [ChipPicker.Option(id: otherAnswer, label: "Other")],
                    selection: Binding(
                        get: {
                            if showsField { return otherAnswer }
                            return known ? fact.options.first { $0.value.caseInsensitiveCompare(value) == .orderedSame }?.value : nil
                        },
                        set: { chosen in
                            if chosen == otherAnswer {
                                typing.insert(fact.key)
                            } else if let chosen {
                                typing.remove(fact.key)
                                drafts[fact.key] = chosen
                            }
                        }
                    ),
                    identifier: "documentFacts_\(fact.key)_fix"
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
                .accessibilityIdentifier("documentFacts_\(fact.key)_field")
            }
        }
    }
}
