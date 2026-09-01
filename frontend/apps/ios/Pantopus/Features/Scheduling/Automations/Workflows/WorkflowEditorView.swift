//
//  WorkflowEditorView.swift
//  Pantopus
//
//  Stream I16 — H3 Workflow Editor (full screen). Build / Activity tabs. The
//  Build tab is a scroll of sections: an optional name, a Trigger summary row
//  (opens the H4 Trigger Picker), an Action channel picker (SMS disabled "coming
//  soon") with the channel-implied audience, a Message body with an "Insert
//  variable" bar (opens H6), a live counter and a Preview button (opens H7), and
//  an active toggle. Activity is a friendly empty until a run-log endpoint
//  exists. Save POSTs (new) or PUTs (existing). Matches the design suite's H3.
//

import SwiftUI

struct WorkflowEditorView: View {
    @State private var model: WorkflowEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        workflowId: String?,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: WorkflowEditorViewModel(owner: owner, workflowId: workflowId, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoTopBar(
                title: model.navTitle,
                leading: .close,
                onLeading: { dismiss() },
                trailing: AnyView(
                    AutoTopBarTextButton(title: "Save", isEnabled: model.canSave) { saveAndDismiss() }
                )
            )
            AutoUnderlineTabs(
                tabs: ["Build", "Activity"],
                selectedIndex: model.tab.rawValue,
                accent: model.accent
            ) { model.tab = WorkflowEditorViewModel.Tab(rawValue: $0) ?? .build }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .sheet(isPresented: $model.showTriggerPicker) {
            TriggerPickerSheet(
                trigger: model.trigger,
                offsetMinutes: model.offsetMinutes,
                accent: model.accent,
                onApply: { trigger, offset in model.applyTrigger(trigger, offsetMinutes: offset) },
                onClose: { model.showTriggerPicker = false }
            )
        }
        .sheet(isPresented: $model.showVariablePicker) {
            VariablePickerSheet(
                accent: model.accent,
                onInsert: { model.insert(variable: $0) },
                onClose: { model.showVariablePicker = false }
            )
        }
        .sheet(isPresented: $model.showPreview) {
            MessagePreviewView(
                owner: model.owner,
                subject: model.previewDraft.subject,
                body: model.previewDraft.body,
                channel: model.previewDraft.channel
            ) { model.showPreview = false }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Delete \"\(model.name.isEmpty ? "this workflow" : model.name)\"?",
            isPresented: $model.showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete workflow", role: .destructive) {
                Task { if await model.delete() { dismiss() } }
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("This workflow will be permanently removed and can't be undone.")
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.workflows.editor")
    }

    private func saveAndDismiss() {
        Task { if await model.save() { dismiss() } }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .loaded:
            switch model.tab {
            case .build: buildBody
            case .activity: activityBody
            }
        case let .error(message):
            AutoErrorView(headline: "Couldn't load workflow", message: message) {
                Task { await model.load() }
            }
        }
    }

    // MARK: Build tab

    private var buildBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    nameSection
                    triggerSection
                    actionSection
                    messageSection
                    enableSection
                    if let saveError = model.saveError {
                        AutoNote(tone: .error, icon: .alertTriangle, text: saveError)
                    }
                    if let deleteError = model.deleteError {
                        AutoNote(tone: .error, icon: .alertTriangle, text: deleteError)
                    }
                    if !model.isNew {
                        deleteWorkflowButton
                    }
                    Color.clear.frame(height: Spacing.s4)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s3)
            }
            AutoSheetFooter {
                AutoPrimaryButton(
                    title: model.isSaving ? "Saving" : "Save workflow",
                    icon: .check,
                    isSaving: model.isSaving,
                    isDisabled: !model.canSave,
                    action: saveAndDismiss
                )
            }
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        AutoOverline(text: text).padding(.horizontal, 2)
    }

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Name · optional")
            AutoTextField(placeholder: model.channel.actionSummary, text: $model.name, accent: model.accent)
        }
    }

    private var triggerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Trigger")
            AutoCard(padding: EdgeInsets(top: 4, leading: 13, bottom: 4, trailing: 13)) {
                Button { model.showTriggerPicker = true } label: {
                    HStack(spacing: 11) {
                        autoIconTile(model.trigger.icon, bg: model.accentBg, fg: model.accent)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(model.trigger.summary(offsetMinutes: model.offsetMinutes))
                                .font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                            Text("Tap to choose when this runs").font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s2)
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("workflowEditor.triggerRow")
            }
        }
    }

    private var actionSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Action")
            AutoCard(padding: EdgeInsets(top: 12, leading: 13, bottom: 12, trailing: 13)) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 7) {
                        ForEach(WorkflowChannel.allCases, id: \.self) { channel in
                            AutoChannelChip(
                                label: channel.label,
                                icon: channel.icon,
                                isOn: model.channel == channel,
                                isComingSoon: channel.isComingSoon,
                                accent: model.accent,
                                accentBg: model.accentBg
                            ) { model.setChannel(channel) }
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    Text(model.recipientCaption).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    private var messageSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Message")
            VStack(alignment: .leading, spacing: 8) {
                insertVariableBar
                AutoTextEditor(
                    placeholder: "Write what this sends…",
                    text: $model.message,
                    isError: model.didAttemptSave && model.messageIsEmpty
                )
                HStack(alignment: .top, spacing: Spacing.s2) {
                    messageHint
                    Spacer(minLength: Spacing.s2)
                    Text("\(model.messageCount) / \(model.counterLimit)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(model.isOverLimit ? Theme.Color.error : Theme.Color.appTextMuted)
                }
                HStack {
                    Spacer()
                    Button { model.showPreview = true } label: {
                        HStack(spacing: 4) {
                            Icon(.eye, size: 13, color: model.canPreview ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                            Text("Preview").font(.system(size: 12, weight: .bold))
                                .foregroundStyle(model.canPreview ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                        }
                    }
                    .disabled(!model.canPreview)
                    .accessibilityIdentifier("workflowEditor.preview")
                }
            }
        }
    }

    @ViewBuilder
    private var messageHint: some View {
        if model.didAttemptSave, model.messageIsEmpty {
            Text("Add a message before saving.").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.error)
        } else if model.channel == .sms {
            Text("Messages over 160 characters send as more than one.").font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        } else {
            Text("Variables fill in per booking.").font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var insertVariableBar: some View {
        Button { model.showVariablePicker = true } label: {
            HStack(spacing: 5) {
                Icon(.hash, size: 12, strokeWidth: 2.4, color: model.accent)
                Text("Insert variable").font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])).foregroundStyle(Theme.Color.appBorderStrong))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("workflowEditor.insertVariable")
    }

    private var enableSection: some View {
        AutoCard(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Workflow active").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Text("Turn off to pause without deleting.").font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Toggle("", isOn: $model.isActive)
                    .labelsHidden()
                    .tint(model.accent)
                    .accessibilityLabel("Workflow active")
            }
        }
    }

    /// Destructive delete row — visible only when editing an existing workflow
    /// (mirrors the template editor's delete pattern).
    private var deleteWorkflowButton: some View {
        Button(role: .destructive) {
            model.showDeleteConfirm = true
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.trash2, size: 14, color: Theme.Color.error)
                Text("Delete workflow")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            .frame(maxWidth: .infinity, minHeight: 38)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s2)
        .accessibilityIdentifier("workflowEditor.delete")
    }

    // MARK: Activity tab

    private var activityBody: some View {
        ScrollView {
            AutoInlineEmpty(
                icon: .clock,
                headline: "No activity yet",
                subcopy: "Once this workflow runs, delivered and failed sends will show up here.",
                accent: model.accent,
                accentBg: model.accentBg
            )
            .padding(.top, Spacing.s12)
        }
    }

    // MARK: Loading

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(width: 90, height: 9, cornerRadius: Radii.xs)
                    Shimmer(height: 70, cornerRadius: Radii.xl)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s4)
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        WorkflowEditorView(owner: .personal, workflowId: nil)
    }
}
#endif
