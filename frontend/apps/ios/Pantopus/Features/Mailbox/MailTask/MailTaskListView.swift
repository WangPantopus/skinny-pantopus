//
//  MailTaskListView.swift
//  Pantopus
//
//  A17.12 (list surface) — Mail tasks. Two frames driven by
//  `MailTaskListViewModel`, matching RN `src/app/mailbox/tasks.tsx`:
//
//  · list   — "n active · n completed" header, active task cards
//    (checkbox → complete/reopen, tap → the A17.12 detail, "Post as
//    neighbor task" → convert-to-gig), and a collapsible
//    "Completed (n)" section.
//  · create — the task form reached from a mail item: the mail
//    reference card, title + description fields, a low/medium/high
//    priority selector, "Create Task", and the RN escalation shortcut
//    that posts the mail as a neighbor task instead.
//
//  The designs folder has no list frame for A17.12 (only the detail,
//  `tasks.jsx`), so the chrome follows the A17 nav + section-card
//  archetype. Mirrors `MailTaskListScreen.kt` on Android.
//

// swiftlint:disable function_body_length type_body_length

import SwiftUI

public struct MailTaskListView: View {
    @State private var viewModel: MailTaskListViewModel

    public init(viewModel: MailTaskListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailTaskList")
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .overlay(alignment: .bottom) { toastOverlay }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .alert(
            viewModel.alert?.title ?? "",
            isPresented: Binding(
                get: { viewModel.alert != nil },
                set: { if !$0 { viewModel.alert = nil } }
            ),
            presenting: viewModel.alert
        ) { _ in
            Button("OK", role: .cancel) { viewModel.alert = nil }
        } message: { alert in
            Text(alert.message)
        }
        .confirmationDialog(
            viewModel.convertTarget?.title ?? "",
            isPresented: Binding(
                get: { viewModel.convertTarget != nil },
                set: { if !$0 { viewModel.convertTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Post as Task") {
                Task { await viewModel.confirmConvert() }
            }
            .accessibilityIdentifier("mailTaskList_convert_confirm")
            Button("Close", role: .cancel) { viewModel.convertTarget = nil }
        } message: {
            Text(convertMessage)
        }
    }

    private var convertMessage: String {
        let detail = viewModel.convertTarget?.detail.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return detail.isEmpty ? "No description" : detail
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
            .accessibilityIdentifier("mailTaskList_back")
            .accessibilityLabel("Back to Mailbox")
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1 + 2) {
                Circle().fill(Theme.Color.categoryTask).frame(width: 8, height: 8)
                Text(viewModel.mode == .create ? "NEW TASK" : "MAIL TASKS")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(viewModel.mode == .create ? "New task" : "Mail tasks")
            Spacer(minLength: Spacing.s0)
            Color.clear.frame(width: 72, height: 1)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.mode == .create {
            createFrame
        } else {
            switch viewModel.state {
            case .loading:
                loadingFrame
            case .empty:
                emptyFrame
            case let .loaded(active, completed):
                listFrame(active: active, completed: completed)
            case let .error(message):
                ErrorState(headline: "Couldn't load your mail tasks", message: message) {
                    await viewModel.refresh()
                }
                .accessibilityIdentifier("mailTaskList_error")
            }
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 160, height: 20)
                Shimmer(height: 92, cornerRadius: Radii.xl)
                Shimmer(height: 92, cornerRadius: Radii.xl)
                Shimmer(height: 92, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
        }
        .accessibilityIdentifier("mailTaskList_loading")
    }

    private var emptyFrame: some View {
        EmptyState(
            icon: .listChecks,
            headline: "No mail tasks",
            subcopy: "Open a mail item and tap \u{201C}Create task\u{201D} to get started.",
            cta: EmptyState.CTA(title: "Refresh") { await viewModel.refresh() }
        )
        .accessibilityIdentifier("mailTaskList_empty")
    }

    // MARK: - List frame

    private func listFrame(active: [MailTaskRow], completed: [MailTaskRow]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("\(active.count) active \u{00B7} \(completed.count) completed")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("mailTaskList_counts")

                ForEach(active) { row in
                    taskCard(row)
                }

                if !completed.isEmpty {
                    completedToggle(count: completed.count)
                    if viewModel.showsCompleted {
                        ForEach(completed) { row in
                            taskCard(row)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .refreshable { await viewModel.refresh() }
    }

    private func completedToggle(count: Int) -> some View {
        Button(action: { viewModel.showsCompleted.toggle() }, label: {
            HStack(spacing: Spacing.s2) {
                Text("Completed (\(count))")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s0)
                Icon(
                    viewModel.showsCompleted ? .chevronUp : .chevronDown,
                    size: 16,
                    color: Theme.Color.appTextSecondary
                )
            }
            .frame(minHeight: 44)
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailTaskList_completedToggle")
    }

    private func taskCard(_ row: MailTaskRow) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Button(action: { viewModel.toggle(row) }, label: {
                    Icon(
                        row.isDone ? .checkCircle : .circle,
                        size: 22,
                        color: row.isDone ? Theme.Color.success : Theme.Color.appTextSecondary
                    )
                    .frame(width: 44, height: 44, alignment: .leading)
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailTaskList_toggle_\(row.id)")
                .accessibilityLabel(row.isDone ? "Reopen \(row.title)" : "Complete \(row.title)")

                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(row.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .strikethrough(row.isDone, color: Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                    if let sender = row.mailSender, !sender.isEmpty {
                        Text(sender)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let preview = row.mailPreview, !preview.isEmpty {
                        Text(preview)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(2)
                    }
                    HStack(spacing: Spacing.s2) {
                        priorityPill(row.priority)
                        if let due = row.dueLabel {
                            Text(due)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: Spacing.s0)
            }

            if row.isConvertedToGig {
                HStack(spacing: Spacing.s1) {
                    Icon(.usersRound, size: 12, color: Theme.Color.business)
                    Text("Posted as a neighbor task")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.business)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.businessBg)
                .clipShape(Capsule())
            } else if !row.isDone {
                Button(action: { viewModel.requestConvert(row) }, label: {
                    HStack(spacing: Spacing.s2) {
                        if viewModel.convertingTaskId == row.id {
                            ProgressView().controlSize(.small)
                        } else {
                            Icon(.usersRound, size: 14, color: Theme.Color.business)
                        }
                        Text("Convert to neighbor gig")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.business)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(Theme.Color.businessBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .disabled(viewModel.convertingTaskId == row.id)
                .accessibilityIdentifier("mailTaskList_convert_\(row.id)")
            }
        }
        .padding(Spacing.s3 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture { viewModel.openTask(row) }
        .accessibilityIdentifier("mailTaskList_row_\(row.id)")
    }

    private func priorityPill(_ priority: MailTaskPriority) -> some View {
        Text(priority.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(priority.foreground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(priority.background)
            .clipShape(Capsule())
    }

    // MARK: - Create frame

    private var createFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if let sender = viewModel.mailSender, !sender.isEmpty {
                    mailReferenceCard(sender: sender, subject: viewModel.mailSubject ?? "")
                }

                section(label: "TASK DETAILS") {
                    VStack(spacing: Spacing.s2) {
                        TextField("Task title", text: Binding(
                            get: { viewModel.draftTitle },
                            set: { viewModel.draftTitle = $0 }
                        ))
                        .textFieldStyle(.plain)
                        .font(.system(size: 13))
                        .padding(Spacing.s3)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .accessibilityIdentifier("mailTaskList_field_title")

                        TextEditor(text: Binding(
                            get: { viewModel.draftDescription },
                            set: { viewModel.draftDescription = $0 }
                        ))
                        .font(.system(size: 13))
                        .frame(height: 84)
                        .scrollContentBackground(.hidden)
                        .padding(Spacing.s2)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .accessibilityIdentifier("mailTaskList_field_description")
                        .accessibilityLabel("Description (optional)")
                    }
                }

                section(label: "PRIORITY") {
                    HStack(spacing: Spacing.s2) {
                        priorityButton(.low, label: "Low")
                        priorityButton(.medium, label: "Medium")
                        priorityButton(.high, label: "High")
                    }
                }

                Button(action: { Task { await viewModel.create() } }, label: {
                    HStack(spacing: Spacing.s2) {
                        if viewModel.isCreating {
                            ProgressView().controlSize(.small).tint(Theme.Color.appTextInverse)
                        } else {
                            Icon(.check, size: 17, color: Theme.Color.appTextInverse)
                        }
                        Text("Create Task")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .disabled(viewModel.isCreating)
                .accessibilityIdentifier("mailTaskList_create")

                // A17.8 → "Ask a Neighbor". RN's escalation out of the task
                // pipeline (`src/app/mailbox/tasks.tsx:231-240`).
                Button(action: { viewModel.postAsNeighborTask() }, label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.usersRound, size: 15, color: Theme.Color.business)
                        Text("Post as Neighbor Task Instead")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.business)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.s3)
                    .background(Theme.Color.businessBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailTaskList_postAsNeighborTask")

                Button(action: { viewModel.cancelCreate() }, label: {
                    Text("See all mail tasks")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailTaskList_seeAll")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func mailReferenceCard(sender: String, subject: String) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.mail, size: 16, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text(sender)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                if !subject.isEmpty {
                    Text(subject)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.warning)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("mailTaskList_mailRef")
    }

    private func priorityButton(_ priority: MailTaskPriority, label: String) -> some View {
        let selected = viewModel.draftPriority == priority
        return Button(action: { viewModel.draftPriority = priority }, label: {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(selected ? priority.foreground : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(selected ? priority.background : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailTaskList_priority_\(priority.rawValue)")
    }

    private func section(
        label: String,
        @ViewBuilder body: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 2) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            body()
        }
        .padding(Spacing.s3 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
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
                .padding(.bottom, Spacing.s10)
                .transition(.opacity)
                .task {
                    try? await Task.sleep(nanoseconds: 1_800_000_000)
                    viewModel.toast = nil
                }
                .accessibilityLabel(toast)
        }
    }
}
