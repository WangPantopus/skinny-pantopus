import SwiftUI

struct HomeTaskRecurrenceView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var model: HomeTaskRecurrenceViewModel
    @State private var isVisible = false
    @State private var showTimezone = false

    var body: some View {
        NavigationStack {
            Form {
                if !model.isCurrent {
                    Text("Your session changed. Reopen the task to continue.")
                } else if !model.isActive {
                    Text("Schedule content is hidden.")
                } else {
                    if model.loading || model.busy { ProgressView("Checking schedule…") }
                    if let error = model
                        .error { Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeTaskRecurrence.error") }
                    if let task = model.task, let state = model.state {
                        Section {
                            Text(task.title).font(.headline)
                            if let due = task.dueAt {
                                let date = HomeTaskRecurrenceDate.label(due, timezone: model.timezone)
                                Text("The saved task is the first occurrence: \(date).")
                            } else { Text("Save a due date on this task before starting repeats.") }
                        }
                        Section("Current schedule") {
                            Text(status(state.configuration)).accessibilityIdentifier("homeTaskRecurrence.status")
                            if let config = state.configuration, config.generatedCount > 0 {
                                Text("Tasks created by this schedule: \(config.generatedCount)")
                            }
                        }
                        if let pending = model.pending { recovery(pending) } else { controls(state) }
                        if !state.canManage { Text("You can view this schedule, but you cannot change it.") }
                    }
                    Button("Reload repeat settings") { Task { await model.load() } }
                        .disabled(model.busy || model.loading).accessibilityIdentifier("homeTaskRecurrence.reload")
                }
            }
            .navigationTitle("Repeat schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        model.suspend()
                        dismiss()
                    }.accessibilityIdentifier("homeTaskRecurrence.close")
                }
            }
            .accessibilityIdentifier("homeTaskRecurrence")
            .onAppear { isVisible = true }
            .task { await model.activate(ifCurrent: model.activationRevision) }
            .onDisappear { isVisible = false
                model.suspend()
            }
            .onChange(of: scenePhase) { _, phase in
                guard isVisible else { return }
                if phase == .active { activate() } else { model.suspend()
                    showTimezone = false
                }
            }
            .onChange(of: model.isCurrent) { _, current in
                if !current { model.retire()
                    showTimezone = false
                }
            }
            .sheet(isPresented: $showTimezone) {
                TimezoneSelectorSheet(
                    selectedIdentifier: model.timezone,
                    onSelect: { zone in
                        guard model.canChange else { return }
                        model.timezone = zone
                        showTimezone = false
                    },
                    onDone: { showTimezone = false }
                )
            }
        }
    }

    private func controls(_ state: HomeTaskRecurrenceState) -> some View {
        Section("Repeat every") {
            TextField("Interval from 1 to 365", text: $model.interval)
                .keyboardType(.numberPad)
                .disabled(!model.canChange)
                .accessibilityIdentifier("homeTaskRecurrence.interval")
            Picker("Period", selection: $model.frequency) {
                ForEach(HomeTaskRecurrenceFrequency.allCases, id: \.self) { frequency in
                    Text("\(frequency.period.capitalized)s").tag(frequency)
                }
            }.disabled(!model.canChange).accessibilityIdentifier("homeTaskRecurrence.period")
            Button { showTimezone = true } label: { LabeledContent("Time zone", value: model.timezone) }
                .disabled(!model.canChange).accessibilityIdentifier("homeTaskRecurrence.timezone")
            if model.frequency == .monthly { Text("Months without this calendar day are skipped.").font(.caption) }
            DisclosureGroup("How repeats work") {
                Text("""
                Each scheduled date creates a new task. After missed dates, only the latest due task is created.
                Completing the original task does not stop repeats. Pause stops future tasks and keeps existing tasks.
                Attachments are not copied. Local clock changes may adjust an occurrence.
                """)
            }
            Button(state.configuration?.state == "active" ? "Save repeat changes" : "Start repeating") {
                Task { await model.start() }
            }.disabled(!model.canStart).accessibilityIdentifier("homeTaskRecurrence.start")
            if let config = state.configuration, config.state != "paused" {
                Button("Pause repeats") { Task { await model.pause() } }
                    .disabled(!model.canChange).accessibilityIdentifier("homeTaskRecurrence.pause")
            }
        }
    }

    private func recovery(_ pending: HomeTaskRecurrenceDraft) -> some View {
        Section("Saved change") {
            if let frequency = pending.command.frequency, let interval = pending.command.interval, let timezone = pending.command.timezone {
                Text("Saved change: repeat every \(interval) \(frequency.period)\(interval == 1 ? "" : "s") in \(timezone).")
            }
            Text(pending.confirmed != nil
                ? "Your saved schedule change is confirmed. The current schedule is shown above."
                : "Your previous \(pending.command.action) change has not been confirmed. Retry that saved change.")
            if pending.confirmed != nil || model.canDismiss {
                Button(pending.confirmed != nil ? "Done reviewing saved change" : "Dismiss rejected change") {
                    Task { await model.acknowledge() }
                }.disabled(model.busy).accessibilityIdentifier("homeTaskRecurrence.acknowledge")
            } else {
                Button("Retry saved change") { Task { await model.retry() } }
                    .disabled(model.busy || model.state?.canManage != true).accessibilityIdentifier("homeTaskRecurrence.retry")
            }
        }
    }

    private func status(_ config: HomeTaskRecurrenceConfiguration?) -> String {
        guard let config else { return "Automatic repeats are off." }
        if config.state == "paused" { return "Repeats are paused." }
        if config.state == "needs_review" { return "Repeats need review because the task or access changed." }
        guard let due = config.nextDueAt else { return "Next date unavailable. Reload repeat settings." }
        return "Repeating · next occurrence \(HomeTaskRecurrenceDate.label(due, timezone: config.timezone))"
    }

    private func activate() {
        let revision = model.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await model.activate(ifCurrent: revision)
        }
    }
}
