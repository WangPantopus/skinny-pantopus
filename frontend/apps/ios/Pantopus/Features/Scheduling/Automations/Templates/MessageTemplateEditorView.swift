//
//  MessageTemplateEditorView.swift
//  Pantopus
//
//  Stream I16 — H5 Message Template Editor. A scroll of sections: channel chips,
//  a name, a subject (shown for Email / SMS, required for Email), and the body
//  with an "Insert variable" bar (H6), a live counter, and a Preview button (H7).
//  Sticky Done POSTs (new) or PUTs (existing). Mirrors the design suite's H5.
//

import SwiftUI

struct MessageTemplateEditorView: View {
    @State private var model: MessageTemplateEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        templateId: String?,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: MessageTemplateEditorViewModel(owner: owner, templateId: templateId, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoTopBar(
                title: model.navTitle,
                leading: .close,
                onLeading: { dismiss() },
                trailing: AnyView(AutoTopBarTextButton(title: "Done", isEnabled: model.canSave) { saveAndDismiss() })
            )
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
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
                subject: model.previewSubject,
                body: model.body,
                channel: model.channel
            ) { model.showPreview = false }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Delete \"\(model.name.isEmpty ? "this template" : model.name)\"?",
            isPresented: $model.showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete template", role: .destructive) {
                Task { if await model.delete() { dismiss() } }
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("This template will be permanently removed and can't be undone.")
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.templates.editor")
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
            loadedBody
        case let .error(message):
            AutoErrorView(headline: "Couldn't load template", message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    channelSection
                    nameSection
                    activeSection
                    if model.showsSubject { subjectSection }
                    messageSection
                    if let saveError = model.saveError {
                        AutoNote(tone: .error, icon: .alertTriangle, text: saveError)
                    }
                    if let deleteError = model.deleteError {
                        AutoNote(tone: .error, icon: .alertTriangle, text: deleteError)
                    }
                    if !model.isNew {
                        deleteTemplateButton
                    }
                    Color.clear.frame(height: Spacing.s4)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s3)
            }
            AutoSheetFooter {
                AutoPrimaryButton(
                    title: model.isSaving ? "Saving" : "Done",
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

    /// Active / Inactive toggle — mirrors web's `is_active` card control.
    private var activeSection: some View {
        AutoCard(padding: EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
            HStack(spacing: Spacing.s3) {
                Icon(.zap, size: 16, strokeWidth: 1.8, color: model.isActive ? model.accent : Theme.Color.appTextMuted)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Active").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Text(model.isActive ? "Workflows can use this template." : "Template is paused — no sends.")
                        .font(.system(size: 12)).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Toggle("", isOn: $model.isActive)
                    .tint(model.accent)
                    .labelsHidden()
                    .accessibilityLabel("Template active")
            }
        }
        .accessibilityIdentifier("templateEditor.activeToggle")
    }

    /// Destructive delete row — visible only when editing an existing template.
    private var deleteTemplateButton: some View {
        Button(role: .destructive) {
            model.showDeleteConfirm = true
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.trash2, size: 14, color: Theme.Color.error)
                Text("Delete template")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            .frame(maxWidth: .infinity, minHeight: 38)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s2)
        .accessibilityIdentifier("templateEditor.delete")
    }

    private var channelSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Channel")
            AutoCard(padding: EdgeInsets(top: 12, leading: 13, bottom: 12, trailing: 13)) {
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
            }
        }
    }

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Name")
            AutoTextField(placeholder: "Booking thank-you", text: $model.name, accent: model.accent)
            if model.didAttemptSave, model.nameIsEmpty {
                Text("Give your template a name.").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.error)
            }
        }
    }

    private var subjectSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader(model.subjectRequired ? "Subject" : "Subject · optional")
            AutoTextField(placeholder: "You're booked: {{event_title}}", text: $model.subject, accent: model.accent)
            if model.didAttemptSave, model.subjectMissing {
                Text("Email templates need a subject.").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.error)
            }
        }
    }

    private var messageSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader("Message")
            VStack(alignment: .leading, spacing: 8) {
                insertVariableBar
                AutoTextEditor(
                    placeholder: "Write what attendees should see…",
                    text: $model.body,
                    isError: model.didAttemptSave && model.bodyIsEmpty
                )
                HStack(alignment: .top, spacing: Spacing.s2) {
                    messageHint
                    Spacer(minLength: Spacing.s2)
                    Text("\(model.bodyCount) / \(model.counterLimit)")
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
                    .accessibilityIdentifier("templateEditor.preview")
                }
            }
        }
    }

    @ViewBuilder
    private var messageHint: some View {
        if model.didAttemptSave, model.bodyIsEmpty {
            Text("Add a message before saving.").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.error)
        } else if model.isOverLimit {
            Text("This will send as more than one SMS.").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.Color.warning)
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
        .accessibilityIdentifier("templateEditor.insertVariable")
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(width: 90, height: 9, cornerRadius: Radii.xs)
                    Shimmer(height: 60, cornerRadius: Radii.xl)
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
        MessageTemplateEditorView(owner: .personal, templateId: nil)
    }
}
#endif
