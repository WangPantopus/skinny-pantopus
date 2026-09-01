//
//  MessageTemplateLibraryView.swift
//  Pantopus
//
//  Stream I16 — H8 Message Template Library (full screen). Two grouped cards:
//  "Starter templates" (read-only seeds, duplicable) and "My templates" (from the
//  backend, editable). A create FAB; per-row kebab for edit / duplicate / delete
//  on owned templates (the design's swipe affordance, rendered as the app's
//  standard overflow menu). Empty keeps the starter card. Mirrors the design
//  suite's H8.
//

import SwiftUI

struct MessageTemplateLibraryView: View {
    @State private var model: MessageTemplateLibraryViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: MessageTemplateLibraryViewModel(owner: owner, push: push, client: client))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            AutoTopBar(
                title: "Templates",
                leading: .back,
                onLeading: { dismiss() },
                trailing: AnyView(
                    Button { withAnimation { model.searchActive.toggle() } } label: {
                        Icon(.search, size: 18, color: Theme.Color.primary600)
                    }
                    .accessibilityLabel("Search templates")
                )
            )
            if model.searchActive { searchField }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .overlay(alignment: .bottomTrailing) { fab }
        .overlay(alignment: .bottom) { toast }
        .task { await model.load() }
        .task(id: model.actionError) {
            // Android-parity auto-dismiss (2.2s warning AutoToast).
            guard model.actionError != nil else { return }
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            withAnimation { model.actionError = nil }
        }
        .onAppear { if case .loaded = model.phase { Task { await model.refresh() } } }
        .refreshable { await model.refresh() }
        .alert("Delete template?", isPresented: deletePresented, presenting: model.deleteTarget) { _ in
            Button("Delete", role: .destructive) { Task { await model.confirmDelete() } }
            Button("Cancel", role: .cancel) { model.deleteTarget = nil }
        } message: { template in
            Text("\u{201C}\(template.name)\u{201D} will be removed. This can't be undone.")
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.templates.library")
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 15, color: Theme.Color.appTextMuted)
            TextField("Search templates", text: $model.query)
                .font(.system(size: 14)).foregroundStyle(Theme.Color.appText).autocorrectionDisabled()
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .loaded:
            loadedBody
        case let .error(message):
            AutoErrorView(headline: "Couldn't load templates", message: message) { Task { await model.load() } }
        }
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if !model.visibleStarters.isEmpty { starterGroup }
                myTemplatesGroup
                Color.clear.frame(height: 80)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
    }

    private var starterGroup: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            AutoOverline(text: "Starter templates").padding(.horizontal, 2)
            AutoCard(padding: EdgeInsets(top: Spacing.s0, leading: 14, bottom: Spacing.s0, trailing: 14)) {
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(model.visibleStarters.enumerated()), id: \.element.id) { idx, starter in
                        starterRow(starter)
                        if idx < model.visibleStarters.count - 1 { AutoRowDivider() }
                    }
                }
            }
        }
    }

    private func starterRow(_ starter: StarterTemplate) -> some View {
        Button { Task { await model.duplicateStarter(starter) } } label: {
            HStack(spacing: 11) {
                autoIconTile(.fileText, bg: Theme.Color.primary50, fg: Theme.Color.primary600)
                templateText(name: starter.name, preview: starter.body, channel: starter.channel)
                Spacer(minLength: Spacing.s2)
                Icon(.copy, size: 17, color: Theme.Color.appTextSecondary)
            }
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("starterRow_\(starter.id)")
        .accessibilityLabel("Duplicate starter \(starter.name)")
    }

    private var myTemplatesGroup: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            AutoOverline(text: "My templates").padding(.horizontal, 2)
            if model.visibleTemplates.isEmpty {
                if model.query.isEmpty {
                    AutoInlineEmpty(
                        icon: .fileText,
                        headline: "You haven't saved any yet",
                        subcopy: "Edit a starter or write your own to reuse in workflows.",
                        accent: model.accent,
                        accentBg: model.accentBg,
                        ctaTitle: "New template"
                    ) { model.createNew() }
                } else {
                    AutoInlineEmpty(
                        icon: .search,
                        headline: "No templates match",
                        subcopy: "Try a different word.",
                        accent: model.accent,
                        accentBg: model.accentBg
                    )
                }
            } else {
                AutoCard(padding: EdgeInsets(top: Spacing.s0, leading: 14, bottom: Spacing.s0, trailing: 14)) {
                    VStack(spacing: Spacing.s0) {
                        ForEach(Array(model.visibleTemplates.enumerated()), id: \.element.id) { idx, template in
                            myRow(template)
                            if idx < model.visibleTemplates.count - 1 { AutoRowDivider() }
                        }
                    }
                }
            }
        }
    }

    private func myRow(_ template: MessageTemplateDTO) -> some View {
        HStack(spacing: 11) {
            Button { model.openTemplate(template) } label: {
                HStack(spacing: 11) {
                    autoIconTile(.fileText, bg: Theme.Color.primary50, fg: Theme.Color.primary600)
                    templateText(name: template.name, preview: template.body, channel: WorkflowChannel(wire: template.channel))
                    Spacer(minLength: Spacing.s2)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Menu {
                Button("Edit") { model.openTemplate(template) }
                Button("Duplicate") { Task { await model.duplicate(template) } }
                Button("Delete", role: .destructive) { model.deleteTarget = template }
            } label: {
                Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextMuted).frame(width: 36, height: 36)
            }
            .accessibilityLabel("More actions for \(template.name)")
        }
        .padding(.vertical, 11)
        .accessibilityIdentifier("templateRow_\(template.id)")
    }

    private func templateText(name: String, preview: String, channel: WorkflowChannel) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.Color.appText).lineLimit(1)
            Text(firstLine(preview)).font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
            AutoChip(text: channel.label, icon: channel.icon, tone: .neutral)
        }
    }

    private func firstLine(_ body: String) -> String {
        body.split(whereSeparator: \.isNewline).first.map(String.init) ?? body
    }

    // MARK: FAB + toast

    @ViewBuilder
    private var fab: some View {
        if case .loaded = model.phase {
            AutoFAB(accent: model.accent, shadow: model.theme.ctaShadow, accessibilityLabel: "New template") {
                model.createNew()
            }
            .padding(.trailing, Spacing.s4)
            .padding(.bottom, Spacing.s6)
        }
    }

    /// Bottom toast stack: a transient mutation error takes priority — the dark
    /// AutoToast pill with a warning tint (Android `actionError` parity) instead
    /// of an alert dialog — else the success toast.
    @ViewBuilder
    private var toast: some View {
        if let actionError = model.actionError {
            AutoToast(text: actionError, icon: .alertTriangle, tint: Theme.Color.warning)
                .padding(.bottom, Spacing.s10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if model.showToast {
            AutoToast(text: model.toastText)
                .padding(.bottom, Spacing.s10)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                AutoCard {
                    VStack(spacing: Spacing.s0) {
                        ForEach(0..<4, id: \.self) { idx in
                            AutoSkeletonRow(showTrailingPill: false)
                            if idx < 3 { AutoRowDivider() }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s4)
        }
    }

    private var deletePresented: Binding<Bool> {
        Binding(get: { model.deleteTarget != nil }, set: { if !$0 { model.deleteTarget = nil } })
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MessageTemplateLibraryView(owner: .personal) { _ in }
    }
}
#endif
