//
//  StartPollFormView.swift
//  Pantopus
//
//  P2.5 — Start-a-Poll form built on `FormShell`. Five kinds (single /
//  multi / ranked / yes-no / approval) with a dynamic options list (min 2,
//  max 10 for choice kinds; auto-filled for yes-no), an audience picker,
//  a close-date picker, and an anonymity toggle. Wired from the
//  PollsListView FAB through the `HubRoute.startPoll(homeId:)` case.
//

import SwiftUI

@MainActor
struct StartPollFormView: View {
    @State private var viewModel: StartPollFormViewModel
    private let onClose: @MainActor () -> Void

    init(
        homeId: String,
        initialKind: StartPollKind = .singleChoice,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: StartPollFormViewModel(
            homeId: homeId,
            api: api,
            kind: initialKind
        ))
        self.onClose = onClose
    }

    var body: some View {
        FormShell(
            title: "Start a poll",
            rightActionLabel: "Post",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSubmitting,
            onClose: onClose,
            onCommit: { Task { await viewModel.submit() } },
            content: {
                questionGroup
                kindGroup
                optionsGroup
                audienceGroup
                scheduleGroup
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await viewModel.loadMembers() }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
    }

    // MARK: - Sections

    private var questionGroup: some View {
        FormFieldGroup("Question") {
            PantopusTextField(
                "Question",
                text: Binding(
                    get: { viewModel.question.value },
                    set: { viewModel.updateQuestion($0) }
                ),
                placeholder: "What should we decide?",
                state: questionFieldState,
                identifier: "startPollQuestionField"
            )
            Text("\(viewModel.question.value.count) / \(StartPollBounds.questionMax)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("startPollQuestionCount")
        }
    }

    private var kindGroup: some View {
        FormFieldGroup("Poll kind") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(StartPollKind.allCases) { kind in
                    KindRow(
                        kind: kind,
                        isSelected: viewModel.kind == kind
                    ) { viewModel.setKind(kind) }
                }
            }
            .accessibilityIdentifier("startPollKindPicker")
            Text(viewModel.kind.helper)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var optionsGroup: some View {
        FormFieldGroup(viewModel.kind == .yesNo ? "Options (auto)" : "Options") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(Array(viewModel.options.enumerated()), id: \.element.id) { index, option in
                    OptionRow(
                        optionId: option.id,
                        isLocked: option.isLocked,
                        index: index,
                        canRemove: canRemove,
                        label: Binding(
                            get: { viewModel.options.first { $0.id == option.id }?.label ?? "" },
                            set: { viewModel.updateOption(id: option.id, to: $0) }
                        )
                    ) { viewModel.removeOption(id: option.id) }
                }
                if viewModel.kind.allowsCustomOptions, viewModel.options.count < StartPollBounds.maxOptions {
                    Button {
                        viewModel.addOption()
                    } label: {
                        HStack(spacing: Spacing.s2) {
                            Icon(.plus, size: 14, color: Theme.Color.primary600)
                            Text("Add option")
                                .pantopusTextStyle(.body)
                                .foregroundStyle(Theme.Color.primary600)
                            Spacer()
                        }
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add option")
                    .accessibilityIdentifier("startPollAddOptionButton")
                }
                if viewModel.kind.allowsCustomOptions {
                    Text(optionsHelper)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
    }

    private var audienceGroup: some View {
        FormFieldGroup("Audience") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                AudienceRow(
                    title: "All household members",
                    subtitle: "Everyone with an active membership can vote.",
                    isSelected: !viewModel.audience.isSelective,
                    identifier: "startPollAudienceAll"
                ) { viewModel.selectAllMembers() }
                if viewModel.isLoadingMembers {
                    Shimmer(height: 40, cornerRadius: Radii.md)
                        .accessibilityIdentifier("startPollAudienceLoading")
                } else if viewModel.members.isEmpty {
                    Text("No other members to invite.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                } else {
                    let selected = viewModel.audience.selectedIds
                    ForEach(viewModel.members) { member in
                        MemberToggleRow(
                            member: member,
                            isOn: selected.contains(member.id)
                        ) { viewModel.toggleMember(member.id) }
                    }
                }
            }
        }
    }

    private var scheduleGroup: some View {
        FormFieldGroup("Close date") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                DatePicker(
                    "Close date",
                    selection: Binding(
                        get: { viewModel.closesAt ?? Date().addingTimeInterval(7 * 24 * 60 * 60) },
                        set: { viewModel.closesAt = $0 }
                    ),
                    in: Date().addingTimeInterval(StartPollBounds.closeMinSecondsAhead)...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .labelsHidden()
                .accessibilityIdentifier("startPollCloseDatePicker")

                Toggle(
                    isOn: Binding(
                        get: { viewModel.isAnonymous },
                        set: { viewModel.isAnonymous = $0 }
                    )
                ) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text("Anonymous voting")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appText)
                        Text("Hide who voted for what — only totals appear.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("startPollAnonymityToggle")
            }
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
        }
    }

    // MARK: - Helpers

    private var canRemove: Bool {
        viewModel.kind.allowsCustomOptions && viewModel.options.count > StartPollBounds.minOptions
    }

    private var optionsHelper: String {
        "At least \(StartPollBounds.minOptions), up to \(StartPollBounds.maxOptions). Each option must be unique."
    }

    private var questionFieldState: PantopusFieldState {
        guard viewModel.question.touched else { return .default }
        if let error = viewModel.question.error { return .error(error) }
        return viewModel.question.value.trimmingCharacters(in: .whitespaces).isEmpty
            ? .default
            : .valid
    }
}

// MARK: - Kind row

private struct KindRow: View {
    let kind: StartPollKind
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(kind.icon, size: 18, color: Theme.Color.primary600)
                    .frame(width: 28, height: 28)
                Text(kind.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                if isSelected {
                    Icon(.checkCircle, size: 20, color: Theme.Color.primary600)
                } else {
                    Circle()
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                        .frame(width: 20, height: 20)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorderSubtle,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(kind.label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("startPollKindOption_\(kind.rawValue)")
    }
}

// MARK: - Option row

private struct OptionRow: View {
    let optionId: String
    let isLocked: Bool
    let index: Int
    let canRemove: Bool
    @Binding var label: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            optionField
            if isLocked {
                Icon(.lock, size: 16, color: Theme.Color.appTextMuted)
                    .frame(width: 32, height: 44)
                    .accessibilityLabel("Locked option")
            } else if canRemove {
                Button(action: onRemove) {
                    Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 32, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove option \(index + 1)")
                .accessibilityIdentifier("startPollRemoveOption_\(optionId)")
            } else {
                Color.clear.frame(width: 32, height: 44)
            }
        }
    }

    private var optionField: some View {
        HStack {
            if isLocked {
                Text(label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField("Option \(index + 1)", text: $label)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(minHeight: 44)
        .background(isLocked ? Theme.Color.appSurfaceSunken : Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .accessibilityIdentifier("startPollOptionField_\(optionId)")
    }
}

// MARK: - Audience rows

private struct AudienceRow: View {
    let title: String
    let subtitle: String
    let isSelected: Bool
    let identifier: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                if isSelected {
                    Icon(.checkCircle, size: 20, color: Theme.Color.primary600)
                } else {
                    Circle()
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                        .frame(width: 20, height: 20)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorderSubtle,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier)
    }
}

private struct MemberToggleRow: View {
    let member: StartPollMember
    let isOn: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(.user, size: 18, color: Theme.Color.appTextSecondary)
                    .frame(width: 28, height: 28)
                Text(member.name)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                if isOn {
                    Icon(.checkCircle, size: 20, color: Theme.Color.primary600)
                } else {
                    Circle()
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                        .frame(width: 20, height: 20)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(
                        isOn ? Theme.Color.primary600 : Theme.Color.appBorderSubtle,
                        lineWidth: isOn ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(member.name)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("startPollMemberRow_\(member.id)")
    }
}

#Preview {
    NavigationStack {
        StartPollFormView(homeId: "preview") {}
    }
}
