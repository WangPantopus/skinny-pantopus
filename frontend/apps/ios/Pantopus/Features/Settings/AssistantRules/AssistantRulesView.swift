//
//  AssistantRulesView.swift
//  Pantopus
//
//  Settings → What Pantopus does for you
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §18.5), in the
//  Settings list style (Security & devices): each rule's sentence and switch,
//  "Until Jan 16 · Extend", why it paused, its last runs (each opening its
//  plan) and Delete with a confirmation. Loading, empty, loaded and error
//  states. Reached from the Privacy group and `pantopus://settings/rules`.
//

import SwiftUI

struct AssistantRulesView: View {
    @State private var viewModel: AssistantRulesViewModel
    private let onBack: @MainActor () -> Void

    init(viewModel: AssistantRulesViewModel = AssistantRulesViewModel(), onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar(title: "What Pantopus does for you", onBack: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s6)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityIdentifier("rules.toast")
                    .dismissToast(after: toast) { viewModel.toast = nil }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.toast)
        .alert(
            "Delete this rule?",
            isPresented: Binding(
                get: { viewModel.deleting != nil },
                set: { if !$0 { viewModel.deleting = nil } }
            ),
            presenting: viewModel.deleting
        ) { rule in
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await viewModel.delete(rule) }
            }
        } message: { rule in
            Text(rule.kind == "plan_repeat"
                ? "Pantopus stops posting it. The plans it already posted stay."
                : "Pantopus stops sending these reminders.")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("rules.screen")
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            skeleton
        case let .error(message):
            ScrollView {
                ErrorState(headline: "Couldn\u{2019}t load what Pantopus does for you", message: message) {
                    await viewModel.load()
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, Spacing.s16)
            }
            .accessibilityIdentifier("rules.error")
        case .empty:
            ScrollView {
                VStack(spacing: Spacing.s4) {
                    header
                    EmptyState(
                        icon: .repeat2,
                        headline: "Nothing yet",
                        subcopy: "Ask Pantopus to post your weekly game for you."
                    )
                    .accessibilityIdentifier("rules.empty")
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
            }
            .refreshable { [weak viewModel] in await viewModel?.refresh() }
        case .loaded:
            list
        }
    }

    private var skeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(0..<2, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        HStack {
                            Shimmer(height: 14, cornerRadius: Radii.xs)
                            Shimmer(width: 44, height: 24, cornerRadius: Radii.pill)
                        }
                        Shimmer(width: 160, height: 10, cornerRadius: Radii.xs)
                        Shimmer(width: 220, height: 10, cornerRadius: Radii.xs)
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("rules.loading")
    }

    private var header: some View {
        Text("Pantopus does these on its own, within the terms you turned on, and tells you each time.")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("rules.header")
    }

    // MARK: - Loaded

    private var list: some View {
        List {
            Section {
                header
                    .listRowBackground(Theme.Color.appBg)
                    .listRowInsets(EdgeInsets(top: Spacing.s2, leading: Spacing.s1, bottom: Spacing.s1, trailing: Spacing.s1))
                    .listRowSeparator(.hidden)
            }
            ForEach(viewModel.rules) { rule in
                ruleSection(rule)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.Color.appBg)
        .refreshable { [weak viewModel] in await viewModel?.refresh() }
        .accessibilityIdentifier("rules.list")
    }

    private func ruleSection(_ rule: AIRuleDTO) -> some View {
        let busy = viewModel.busyIds.contains(rule.id)
        return Section {
            Toggle(isOn: Binding(
                get: { viewModel.isOn(rule) },
                set: { value in Task { await viewModel.setEnabled(rule, value) } }
            )) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(rule.summary)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(viewModel.isOn(rule) ? "On" : "Off")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(viewModel.isOn(rule) ? Theme.Color.success : Theme.Color.appTextSecondary)
                }
                .padding(.vertical, Spacing.s1)
            }
            .tint(Theme.Color.primary600)
            .disabled(busy)
            .accessibilityIdentifier("rules.switch")
            if let until = AssistantRulesViewModel.until(rule) {
                HStack(spacing: Spacing.s2) {
                    Text(until)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("\u{00B7}")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .accessibilityHidden(true)
                    Button("Extend") { Task { await viewModel.extend(rule) } }
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .buttonStyle(.borderless)
                        .disabled(busy)
                        .accessibilityHint("Runs it 12 more weeks from today.")
                        .accessibilityIdentifier("rules.extend")
                    Spacer(minLength: Spacing.s0)
                }
                .frame(minHeight: 44)
            }
            if let paused = AssistantRulesViewModel.pausedLine(rule.pausedReason) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.alertTriangle, size: 14, strokeWidth: 2.4, color: Theme.Color.warning)
                        .padding(.top, 1)
                        .accessibilityHidden(true)
                    Text(paused)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, Spacing.s1)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("rules.paused")
            }
            if !rule.runs.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Last runs", style: .overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    ForEach(Array(rule.runs.enumerated()), id: \.offset) { _, run in
                        runRow(run)
                    }
                }
                .padding(.vertical, Spacing.s1)
            }
            Button {
                viewModel.deleting = rule
            } label: {
                Text("Delete")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .disabled(busy)
            .accessibilityIdentifier("rules.delete")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("rules.row")
    }

    @ViewBuilder
    private func runRow(_ run: AIRuleDTO.Run) -> some View {
        let failed = run.status == "error"
        let line = HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(failed ? .alertCircle : .checkCircle, size: 14, strokeWidth: 2.4, color: failed ? Theme.Color.error : Theme.Color.success)
                .padding(.top, 2)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(run.label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let day = AssistantRulesViewModel.runDay(run.at) {
                    Text(day)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s0)
            if run.link != nil {
                Icon(.chevronRight, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
        }
        if let link = run.link, DeepLinkRouter.shared.canResolve(path: link) {
            Button { DeepLinkRouter.shared.handle(path: link) } label: {
                line.contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .accessibilityElement(children: .combine)
            .accessibilityHint("Opens the plan.")
            .accessibilityIdentifier("rules.run")
        } else {
            line
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("rules.run")
        }
    }
}
