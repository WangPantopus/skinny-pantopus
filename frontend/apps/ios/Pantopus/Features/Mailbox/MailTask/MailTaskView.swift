//
//  MailTaskView.swift
//  Pantopus
//
//  A17.12 — Mail-task detail screen. A task Pantopus auto-extracted from
//  a piece of mail, with two frames driven by `MailTaskViewModel`:
//
//  · open — header row (trust + Task chip + relative time), `TaskCard`,
//    the task AI-elf strip, `DueSnoozeCard`, `SubtaskChecklist`,
//    `SourceMailCard`, a delegate hint, and a sticky action dock
//    (Mark done · Snooze · Delegate).
//  · done — `TaskCard` (struck title, full progress), the "Submitted"
//    elf, a "What got filed" completion summary, the all-checked
//    checklist, `SourceMailCard`, a `NextUpCard` suggestion, and a
//    reopen / view-confirmation / archive dock.
//
//  Loading uses shimmer skeletons that mirror the loaded geometry.
//  Mirrors `ui/screens/mailbox/mail_task/MailTaskScreen.kt` on Android.
//

import SwiftUI

public struct MailTaskView: View {
    @State private var viewModel: MailTaskViewModel

    public init(viewModel: MailTaskViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailTask")
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { toastOverlay }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .confirmationDialog(
            "Hand this off",
            isPresented: Binding(
                get: { viewModel.showsDelegateSheet },
                set: { viewModel.showsDelegateSheet = $0 }
            ),
            titleVisibility: .visible
        ) {
            Button("Delegate · Home drawer") { viewModel.showsDelegateSheet = false }
                .accessibilityIdentifier("mailTask_delegate_homeDrawer")
            Button("Cancel", role: .cancel) { viewModel.showsDelegateSheet = false }
        } message: {
            Text("Delegate to someone in your Home drawer.")
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s1) {
            Button(action: { viewModel.tapBack() }, label: {
                HStack(spacing: Spacing.s0) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.primary600)
                    Text("Mailbox")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(minHeight: 44)
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailTask_back")
            .accessibilityLabel("Back to Mailbox")
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1 + 2) {
                Circle().fill(Theme.Color.categoryTask).frame(width: 8, height: 8)
                Text("TASK")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Task")
            Spacer(minLength: Spacing.s0)
            HStack(spacing: 2) {
                navIcon(.share, label: "Share")
                navIcon(.moreHorizontal, label: "More")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func navIcon(_ icon: PantopusIcon, label: String) -> some View {
        Button(action: {}, label: {
            Icon(icon, size: 18, color: Theme.Color.appTextStrong)
                .frame(width: 34, height: 34)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
        })
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            MailTaskLoadingView()
        case let .loaded(task):
            loaded(task)
        case let .error(message):
            errorView(message)
        }
    }

    /// The AI elf, subtask checklist, snooze row, completion summary,
    /// next-up suggestion, and delegate hint have no backend source on the
    /// live task API, so they only render when the projection carries them
    /// (i.e. the sample/preview path) — never faked from live data.
    private func loaded(_ task: MailTaskContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerRow(task)
                TaskCard(content: task)
                if let elf = task.elf {
                    TaskElfStrip(elf: elf)
                }
                if task.isDone {
                    if let completion = task.completion {
                        CompletionSummaryCard(completion: completion)
                    }
                    if !task.subtasks.isEmpty {
                        SubtaskChecklist(
                            subtasks: task.subtasks,
                            allDone: true,
                            onToggle: { viewModel.toggleSubtask(id: $0) },
                            onAddStep: { viewModel.addStep() }
                        )
                    }
                    if let source = task.source {
                        SourceMailCard(source: source) { viewModel.openSourceMail() }
                    }
                    if let nextUp = task.nextUp {
                        NextUpCard(nextUp: nextUp) { viewModel.openNextUp() }
                    }
                } else {
                    if let due = task.due, !task.snoozeOptions.isEmpty {
                        DueSnoozeCard(
                            due: due,
                            options: task.snoozeOptions
                        ) { viewModel.snooze(optionId: $0) }
                    }
                    if !task.subtasks.isEmpty {
                        SubtaskChecklist(
                            subtasks: task.subtasks,
                            allDone: false,
                            onToggle: { viewModel.toggleSubtask(id: $0) },
                            onAddStep: { viewModel.addStep() }
                        )
                    }
                    if let source = task.source {
                        SourceMailCard(source: source) { viewModel.openSourceMail() }
                    }
                    if task.elf != nil {
                        DelegateHintCard { viewModel.delegate() }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
        }
        .safeAreaInset(edge: .bottom) {
            actionDock(task)
        }
    }

    private func errorView(_ message: String) -> some View {
        ErrorState(headline: "Couldn't load this task", message: message) {
            await viewModel.retry()
        }
        .accessibilityIdentifier("mailTask_error")
    }

    private func headerRow(_ task: MailTaskContent) -> some View {
        HStack(spacing: Spacing.s1 + 2) {
            HStack(spacing: Spacing.s1) {
                Icon(.shieldCheck, size: 11, color: Theme.Color.success)
                Text("Verified")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.successBg)
            .clipShape(Capsule())
            HStack(spacing: Spacing.s1) {
                Circle().fill(Theme.Color.categoryTask).frame(width: 6, height: 6)
                Text("Task")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
            Spacer(minLength: Spacing.s0)
            Text(task.timeLabel)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 2)
    }

    // MARK: - Action dock

    private func actionDock(_ task: MailTaskContent) -> some View {
        VStack(spacing: Spacing.s2 + 2) {
            if task.isDone {
                doneDock
            } else {
                openDock
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private var openDock: some View {
        VStack(spacing: Spacing.s2 + 2) {
            dockPrimary(icon: .check, title: "Mark done") { viewModel.markDone() }
                .accessibilityIdentifier("mailTask_markDone")
            HStack(spacing: Spacing.s2) {
                dockChip(icon: .clock, label: "Snooze") { viewModel.snoozeFromDock() }
                    .accessibilityIdentifier("mailTask_dock_snooze")
                dockChip(icon: .userPlus, label: "Delegate") { viewModel.delegate() }
                    .accessibilityIdentifier("mailTask_dock_delegate")
                dockChip(icon: .calendarPlus, label: "Calendar") { viewModel.addToCalendar() }
                    .accessibilityIdentifier("mailTask_dock_calendar")
            }
        }
    }

    private var doneDock: some View {
        VStack(spacing: Spacing.s2 + 2) {
            Button(action: { viewModel.reopen() }, label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.undo2, size: 16, color: Theme.Color.primary700)
                    Text("Reopen task")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Theme.Color.primary200, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailTask_reopen")
            HStack(spacing: Spacing.s2) {
                dockChip(icon: .fileText, label: "View confirmation") { viewModel.viewConfirmation() }
                    .accessibilityIdentifier("mailTask_dock_viewConfirmation")
                dockChip(icon: .archive, label: "Archive") { viewModel.archive() }
                    .accessibilityIdentifier("mailTask_dock_archive")
            }
        }
    }

    private func dockPrimary(icon: PantopusIcon, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 17, color: Theme.Color.appTextInverse)
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
    }

    private func dockChip(icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 17, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Toast

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appText.opacity(0.9))
                .clipShape(Capsule())
                .padding(.bottom, 120)
                .transition(.opacity)
                .task {
                    try? await Task.sleep(nanoseconds: 1_800_000_000)
                    viewModel.toast = nil
                }
                .accessibilityLabel(toast)
        }
    }
}

#if DEBUG
#Preview("A17.12 · open") {
    NavigationStack {
        MailTaskView(viewModel: MailTaskViewModel(taskId: "preview", seed: .active))
    }
}

#Preview("A17.12 · done") {
    NavigationStack {
        MailTaskView(viewModel: MailTaskViewModel(taskId: "preview", seed: .done))
    }
}
#endif
