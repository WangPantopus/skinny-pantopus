import SwiftUI

struct GigAssignedAuthorizationView: View {
    @State var model: GigAssignedAuthorizationViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if model.isCurrent { Text("Task amount: \(PaymentRefundRequestDTO.money(model.amount)) USD.") }
                    Text(model.message).accessibilityIdentifier("gigAuthorization.status")
                    if let error = model.error { Text(error).foregroundStyle(Theme.Color.error) }
                }
                if model.isCurrent {
                    Section {
                        Button(model.busy ? "Checking…" : "Check payment status") { Task { await model.checkStatus() } }
                            .disabled(model.busy).accessibilityIdentifier("gigAuthorization.checkStatus")
                        if model.mayContinue {
                            Button("Continue authorization") { Task { await model.continueAuthorization() } }
                                .accessibilityIdentifier("gigAuthorization.continue")
                        }
                    }
                }
            }
            .navigationTitle("Payment authorization")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        model.retire()
                        dismiss()
                    }
                    .disabled(model.busy)
                }
            }
            .interactiveDismissDisabled(model.busy)
            .task { await model.checkStatus() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
    }
}
