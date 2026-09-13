import SwiftUI

struct HomeTaskGigView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var model: HomeTaskGigViewModel
    @State private var isVisible = false
    @FocusState private var fieldFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                if !model.isCurrent {
                    Text("Your session changed. Reopen the task to continue.")
                } else if !model.isActive {
                    Text("Publication content is hidden.")
                } else {
                    if model.loading || model.busy { ProgressView("Checking publication…") }
                    if let error = model
                        .error { Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeTaskGig.error") }
                    if let task = model.task, let state = model.state {
                        Section("Private household task") {
                            Text(task.title).font(.headline).accessibilityIdentifier("homeTaskGig.source")
                            Text("Review what helpers will see. Private mail, files and household access details stay private.")
                                .font(.caption)
                        }
                        if let pending = model.pending {
                            recovery(pending)
                        } else if state.gigId != nil {
                            Section {
                                Text("This household task already has a published Gig.")
                                openGigButton
                            }
                        } else if !state.canPublish {
                            Text("Use an open, unassigned household task and pause automatic repeats before publishing.")
                        } else { controls(task) }
                    }
                    Button("Reload publication") { Task { await model.load() } }
                        .disabled(model.busy || model.loading).accessibilityIdentifier("homeTaskGig.reload")
                }
            }
            .navigationTitle("Find help for this task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { model.suspend()
                        dismiss()
                    }.accessibilityIdentifier("homeTaskGig.close")
                }
                ToolbarItem(placement: .confirmationAction) {
                    if fieldFocused {
                        Button("Done") { fieldFocused = false }.accessibilityIdentifier("homeTaskGig.keyboardDone")
                    }
                }
            }
            .accessibilityIdentifier("homeTaskGig")
            .onAppear { isVisible = true }
            .task { await model.activate(ifCurrent: model.activationRevision) }
            .onDisappear { isVisible = false
                model.suspend()
            }
            .onChange(of: scenePhase) { _, phase in
                guard isVisible else { return }
                if phase == .active { activate() } else { model.suspend()
                    fieldFocused = false
                }
            }
            .onChange(of: model.isCurrent) { _, current in
                if !current { model.retire()
                    fieldFocused = false
                }
            }
        }
    }

    private func controls(_ task: HomeTaskDTO) -> some View {
        Group {
            Section("Public details") {
                TextField("Public title", text: $model.title, axis: .vertical)
                    .focused($fieldFocused).accessibilityIdentifier("homeTaskGig.title")
                Button("Use household task title") { model.title = task.title }
                TextField("Public description", text: $model.description, axis: .vertical)
                    .lineLimit(3...8).focused($fieldFocused).accessibilityIdentifier("homeTaskGig.description")
                TextField("Budget (USD)", text: $model.budget)
                    .keyboardType(.decimalPad)
                    .focused($fieldFocused)
                    .accessibilityIdentifier("homeTaskGig.budget")
                Picker("Category", selection: $model.category) {
                    Text("General").tag("General")
                    ForEach(GigComposeCategory.allCases, id: \.self) { category in Text(category.label).tag(category.backendLabel) }
                }.accessibilityIdentifier("homeTaskGig.category")
            }.disabled(!model.canEdit)
            Section("Work location") {
                TextField("Search an address", text: $model.addressText).focused($fieldFocused)
                    .accessibilityIdentifier("homeTaskGig.address")
                Button(model.findingAddress ? "Finding locations…" : "Find location") {
                    fieldFocused = false
                    Task { await model.searchAddress() }
                }.disabled(model.findingAddress || model.addressText.count < 3).accessibilityIdentifier("homeTaskGig.search")
                ForEach(model.suggestions) { suggestion in
                    Button(suggestion.label) { Task { await model.chooseAddress(suggestion) } }
                        .disabled(model.findingAddress).accessibilityIdentifier("homeTaskGig.suggestion")
                }
                if let location = model.location {
                    Text("Selected: \(location.address)").accessibilityIdentifier("homeTaskGig.selectedLocation")
                }
                Text("City visibility. Exact address is shared after assignment.").font(.caption)
            }.disabled(!model.canEdit)
            Section("Cancellation policy") {
                Picker("Policy", selection: $model.policy) {
                    Text("Flexible").tag("flexible")
                    Text("Standard").tag("standard")
                    Text("Strict").tag("strict")
                }.accessibilityIdentifier("homeTaskGig.policy")
                Text(model.policy == "flexible" ? "Free cancellation before work starts." : model.policy == "standard"
                    ? "A grace window applies after acceptance; cancellation fees may apply afterward."
                    : "Cancellation fees may apply after acceptance.").font(.caption)
            }.disabled(!model.canEdit)
            Section {
                Toggle("I reviewed the public details, location, budget and cancellation policy.", isOn: $model.reviewed)
                    .disabled(!model.canEdit).accessibilityIdentifier("homeTaskGig.reviewed")
                Button("Publish Gig") { fieldFocused = false
                    Task { await model.publish() }
                }
                .disabled(!model.canPublish).accessibilityIdentifier("homeTaskGig.publish")
                Text("Publishing does not charge a card, assign a helper or complete your household task.").font(.caption)
            }
        }
    }

    private func recovery(_ pending: HomeTaskGigDraft) -> some View {
        Section(pending.confirmed != nil ? "Original publication confirmed" : "Publication needs confirmation") {
            Text(pending.fields.title).accessibilityIdentifier("homeTaskGig.savedTitle")
            Text(pending.fields.description)
            Text("Original budget: \(pending.fields.price.formatted(.currency(code: "USD")))")
            Text(pending.confirmed != nil
                ? confirmationMessage
                : "The original request is saved on this device. Retry it to confirm the outcome; retrying will not create a second Gig.")
                .font(.caption)
            if pending.confirmed != nil {
                openGigButton
            } else {
                Button("Retry original publication") { Task { await model.retry() } }
                    .disabled(model.busy).accessibilityIdentifier("homeTaskGig.retry")
            }
            if pending.confirmed != nil || model.canDismiss {
                Button(pending.confirmed != nil ? "I reviewed this confirmation" : "Review current task again") {
                    Task { await model.acknowledge() }
                }
                .disabled(model.busy).accessibilityIdentifier("homeTaskGig.acknowledge")
            }
        }
    }

    private var confirmationMessage: String {
        "This receipt records the original publication. Open the Gig to see its current status. "
            + "Your household task is still separate."
    }

    private var openGigButton: some View {
        Button("Open Gig") {
            Task {
                guard let gig = await model.openGig(), model.isActive, isVisible, scenePhase == .active else { return }
                model.suspend()
                dismiss()
                DeepLinkRouter.shared.handle(path: "/gigs/\(gig)")
            }
        }.disabled(model.busy).accessibilityIdentifier("homeTaskGig.open")
    }

    private func activate() {
        let revision = model.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await model.activate(ifCurrent: revision)
        }
    }
}
