import SwiftUI

struct HomeRelationshipView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var model: HomeRelationshipViewModel
    @State private var isVisible = false
    @FocusState private var noteFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                if !model.isCurrent {
                    Text("Your session changed. Reopen claim review to continue.")
                } else if !model.isActive {
                    Text("Claim content is hidden.")
                } else {
                    if model.loading || model.busy { ProgressView("Checking claim…") }
                    if let error = model.error {
                        Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeRelationship.error")
                    }
                    if let review = model.review {
                        currentClaim(review.claim)
                        if let pending = model.pending { recovery(pending) } else if model.canEdit { controls } else {
                            Text("This claim is no longer available for a household response. Use its current review or dispute process.")
                        }
                    } else if model.empty {
                        Text("No saved relationship decision on this device. Choose a claim from the review queue to begin.")
                            .accessibilityIdentifier("homeRelationship.empty")
                    }
                    Button("Reload current claim") { Task { await model.load() } }
                        .disabled(model.busy || model.loading).accessibilityIdentifier("homeRelationship.reload")
                }
            }
            .navigationTitle("Household response")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { model.suspend()
                        dismiss()
                    }.accessibilityIdentifier("homeRelationship.close")
                }
                ToolbarItem(placement: .confirmationAction) {
                    if noteFocused {
                        Button("Done") { noteFocused = false }.accessibilityIdentifier("homeRelationship.keyboardDone")
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("homeRelationship")
            .onAppear { isVisible = true }
            .task { await model.activate(ifCurrent: model.activationRevision) }
            .onDisappear { isVisible = false
                model.suspend()
            }
            .onChange(of: scenePhase) { _, phase in
                guard isVisible else { return }
                if phase == .active { activate() } else { model.suspend()
                    noteFocused = false
                }
            }
            .onChange(of: model.isCurrent) { _, current in
                if !current { model.retire()
                    noteFocused = false
                }
            }
        }
    }

    private func currentClaim(_ claim: HomeRelationshipReview.Claim) -> some View {
        Section("Current claim") {
            Text("\(claim.claimType.capitalized) claim · \((claim.claimPhaseV2 ?? claim.state).replacingOccurrences(of: "_", with: " "))")
                .font(.headline).accessibilityIdentifier("homeRelationship.current")
            Text("\(claim.evidence.filter(\.eligibleForReview).count) of \(claim.evidence.count) evidence items eligible for review.")
                .accessibilityIdentifier("homeRelationship.evidence")
            ForEach(claim.evidence) { evidence in
                Text("\(evidence.evidenceType.replacingOccurrences(of: "_", with: " ")) · "
                    + (evidence.eligibleForReview ? "Eligible for review" : "Not yet eligible for review"))
                    .font(.caption)
            }
            Text("A filename or pending document does not establish ownership or a qualifying dispute.").font(.caption)
        }
    }

    private var controls: some View {
        Section("Review your response") {
            Picker("Response", selection: $model.action) {
                ForEach(HomeRelationshipAction.allCases, id: \.self) { action in Text(action.label).tag(action) }
            }.accessibilityIdentifier("homeRelationship.action")
            Text(model.action.explanation).font(.caption)
            TextField("Optional private note", text: $model.note, axis: .vertical)
                .lineLimit(3...8).focused($noteFocused).accessibilityIdentifier("homeRelationship.note")
            Text("\(model.note.utf16.count)/1000").font(.caption)
            Toggle("I reviewed the current claim, evidence eligibility and this response.", isOn: $model.reviewed)
                .accessibilityIdentifier("homeRelationship.reviewed")
            Button(model.action.label) { noteFocused = false
                Task { await model.submit() }
            }.disabled(!model.canSubmit).accessibilityIdentifier("homeRelationship.submit")
        }.disabled(!model.canEdit)
    }

    private func recovery(_ pending: HomeRelationshipDraft) -> some View {
        Section(pending.confirmed == nil ? "Decision needs confirmation" : "Original decision confirmed") {
            if model.recoveringAnotherClaim {
                Text("Finish this saved decision before reviewing another claim.")
                    .accessibilityIdentifier("homeRelationship.otherClaim")
            }
            Text(pending.command.action.label).font(.headline).accessibilityIdentifier("homeRelationship.savedAction")
            if !pending.command.note.isEmpty {
                Text(pending.command.note).accessibilityIdentifier("homeRelationship.savedNote")
            }
            if let receipt = pending.confirmed {
                Text("Recorded outcome: \((receipt.result.claimPhaseV2 ?? receipt.result.state).replacingOccurrences(of: "_", with: " "))")
                    .accessibilityIdentifier("homeRelationship.receipt")
                if receipt.action == .flag {
                    Text(receipt.result.qualifiesForDispute
                        ? "Qualified for dispute review."
                        : "Sent for admin review. This response did not establish a qualifying dispute.")
                        .accessibilityIdentifier("homeRelationship.routing")
                }
                Text("This receipt records your original response. The current claim above may have changed since then.").font(.caption)
            } else {
                Text("Your original response is saved on this device. Retry to confirm its outcome without recording a second decision.")
                    .font(.caption)
                Button("Retry original decision") { Task { await model.retry() } }
                    .disabled(model.busy || model.loading).accessibilityIdentifier("homeRelationship.retry")
            }
            if pending.confirmed != nil || model.canDismiss {
                Button(pending.confirmed != nil ? "I reviewed this confirmation" : "Review current claim again") {
                    Task { await model.acknowledge() }
                }.disabled(model.busy || model.loading).accessibilityIdentifier("homeRelationship.acknowledge")
            }
        }
    }

    private func activate() {
        let revision = model.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await model.activate(ifCurrent: revision)
        }
    }
}
