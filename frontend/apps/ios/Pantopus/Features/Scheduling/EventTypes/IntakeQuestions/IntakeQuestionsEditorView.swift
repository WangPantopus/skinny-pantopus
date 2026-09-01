//
//  IntakeQuestionsEditorView.swift
//  Pantopus
//
//  Stream I2 — B3 Intake Questions Editor (routed full-screen FormShell port of
//  the design's bottom-sheet `intake-frames.jsx`). Name + email render as locked
//  "always asked" rows inside one white ListBlock card; custom questions are flat
//  rows inside a second ListBlock card, each carrying a trash-2 + a grip-vertical
//  drag handle. Tapping a row replaces it with the inline blue `EditGroup` field
//  group (label, 3-column segmented type selector, options list, bordered
//  required-toggle row, "Save question" + red Delete). A pillar-accent overline
//  ("Personal · Intro call") sits above the title.
//

import SwiftUI

struct IntakeQuestionsEditorView: View {
    @State private var viewModel: IntakeQuestionsEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: IntakeQuestionsEditorViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var isReady: Bool {
        if case .ready = viewModel.phase { return true }
        return false
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Intake questions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isReady ? .hidden : .visible, for: .navigationBar)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.intakeQuestions")
            .alert("Couldn't save", isPresented: saveErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.saveError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load these questions", message: message) {
                await viewModel.reload()
            }
        case .ready:
            editor
        }
    }

    private var editor: some View {
        FormShell(
            title: "Intake questions",
            subtitle: viewModel.eventName.isEmpty ? nil : viewModel.eventName,
            leading: .back,
            rightActionLabel: "Done",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { if await viewModel.save() { dismiss() } } },
            content: {
                overline
                helper
                lockedDefaults
                questionList
                addButton
            }
        )
    }

    /// Pillar-accent overline ("Personal · Intro call") above the title — the
    /// design sheet's identity line (FormShell already prints the subtitle).
    private var overline: some View {
        Text(viewModel.pillarOverline.uppercased())
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.7)
            .foregroundStyle(viewModel.owner.theme.accent)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
    }

    private var helper: some View {
        Text("Ask people a few things when they book. Name and email are always asked.")
            .font(.system(size: 11))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)
    }

    /// Locked defaults — bare white ListBlock card (no overline), each row a
    /// sunken icon tile + label + "Always asked" caption + lock glyph.
    private var lockedDefaults: some View {
        VStack(spacing: 0) {
            IntakeLockedRow(icon: .user, title: "Name", isLast: false)
            IntakeLockedRow(icon: .mail, title: "Email", isLast: true)
        }
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
    }

    private var questionList: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Your questions".uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            if viewModel.questions.isEmpty {
                Text("You haven't added any yet.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s4)
            } else {
                questionsCard
            }
        }
    }

    /// One white ListBlock card; flat rows separated by 1px dividers. The row
    /// being edited is replaced in place by the blue EditGroup field group.
    private var questionsCard: some View {
        VStack(spacing: 0) {
            ForEach($viewModel.questions) { $question in
                let id = question.id
                let index = viewModel.questions.firstIndex { $0.id == id } ?? 0
                if viewModel.isEditing(id) {
                    IntakeQuestionEditGroup(
                        question: $question,
                        onSave: { viewModel.saveEditing() },
                        onDelete: { viewModel.deleteQuestion(id) },
                        onTypeChange: { viewModel.didChangeType(id) },
                        onAddOption: { viewModel.addOption(to: id) },
                        onRemoveOption: { viewModel.removeOption(from: id, at: $0) }
                    )
                    .padding(.vertical, Spacing.s1)
                } else {
                    IntakeQuestionRow(
                        question: question,
                        isLast: index == viewModel.questions.count - 1,
                        canMoveUp: index > 0,
                        canMoveDown: index < viewModel.questions.count - 1,
                        onEdit: { viewModel.edit(id) },
                        onDelete: { viewModel.deleteQuestion(id) },
                        onMoveUp: { viewModel.move(id, by: -1) },
                        onMoveDown: { viewModel.move(id, by: 1) }
                    )
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
    }

    private var addButton: some View {
        Button(
            action: { viewModel.startAdd() },
            label: {
                HStack(spacing: 7) {
                    Icon(.plus, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Add a question")
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .pantopusShadow(.primary)
            }
        )
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("scheduling.intake.addQuestion")
    }

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 64, cornerRadius: Radii.lg).padding(.horizontal, Spacing.s4)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}

// MARK: - Locked default row

/// Design `LockedRow` — 32pt sunken icon tile · label + "Always asked" caption ·
/// lock glyph. No toggle, no drag. Divider below unless `isLast`.
private struct IntakeLockedRow: View {
    let icon: PantopusIcon
    let title: String
    let isLast: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 11) {
                Icon(icon, size: 15, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Always asked")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer()
                Icon(.lock, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    .accessibilityLabel("Always asked")
            }
            .padding(.vertical, 10)
            if !isLast {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
    }
}
