import SwiftUI

struct GigStopView: View {
    @State var model: GigStopViewModel
    @State private var reason = GigStopReason.changedPlans
    @State private var confirming = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                if model.isCurrent {
                    content
                } else {
                    Text(model.message).accessibilityIdentifier("gigStop.sessionChanged")
                }
            }
            .navigationTitle(model.displayedAction.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(model.completed ? "Done" : "Close") { model.retire()
                        dismiss()
                    }
                }
            }
            .task { await model.checkStatus() }
            .onDisappear { model.retire() }
            .onChange(of: model.maySubmit) { _, allowed in if !allowed { confirming = false } }
            .confirmationDialog(model.displayedAction.label + "?", isPresented: $confirming, titleVisibility: .visible) {
                Button(model.displayedAction.label, role: .destructive) { Task { await model.submit(reason: reason) } }
                Button("Keep task", role: .cancel) {}
            } message: { Text(model.message) }
        }
    }

    @ViewBuilder private var content: some View {
        if let terms = model.terms {
            Section("Task details") {
                LabeledContent("Task amount", value: PaymentRefundRequestDTO.money(terms.amountCents))
                if model.maySubmit {
                    LabeledContent("Cancellation fee", value: PaymentRefundRequestDTO.money(terms.policyFeeCents))
                }
            }
        }
        Section {
            Text(model.message).accessibilityIdentifier(model.completed ? "gigStop.completed" : "gigStop.status")
            if let error = model.error { Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("gigStop.error") }
            if !model.completed {
                Button(model.busy ? "Checking…" : "Check status") { Task { await model.checkStatus() } }
                    .disabled(model.busy)
                    .accessibilityIdentifier("gigStop.checkStatus")
            }
            if model.mayRetry {
                Button("Retry this request") { Task { await model.retry() } }
                    .accessibilityIdentifier("gigStop.retry")
            }
        }
        if model.maySubmit {
            Section {
                Picker("Reason", selection: $reason) {
                    ForEach(GigStopReason.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                Button(model.displayedAction.label, role: .destructive) { confirming = true }
                    .accessibilityIdentifier("gigStop.submit")
            }
        }
    }
}
