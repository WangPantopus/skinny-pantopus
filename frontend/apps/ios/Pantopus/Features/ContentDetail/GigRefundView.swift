import SwiftUI

struct GigRefundView: View {
    @State var model: GigRefundViewModel
    @State private var editing = false
    @State private var amount = ""
    @State private var reason = PaymentRefundReason.requestedByCustomer
    @State private var confirming = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                if model.isCurrent {
                    content
                } else {
                    Text("Your session or connection changed. Reopen this payment to continue.")
                        .accessibilityIdentifier("gigRefund.sessionChanged")
                }
            }
            .navigationTitle("Refunds and hold releases")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .task { await model.checkStatus() }
            .onChange(of: model.mayRequest) { _, available in
                if !available { editing = false
                    confirming = false
                }
            }
            .confirmationDialog(
                model.isRelease ? "Release this authorization hold?" : "Submit this refund request?",
                isPresented: $confirming,
                titleVisibility: .visible
            ) {
                Button(model.isRelease ? "Release hold" : "Request refund", role: .destructive) {
                    Task { await model.submit(amountText: amount, reason: reason) }
                }
                Button("Keep payment", role: .cancel) {}
            } message: {
                Text(model.isRelease
                    ? "Release the \(PaymentRefundRequestDTO.money(model.remaining)) hold. "
                    + "No captured charge will be refunded. This does not cancel the task."
                    : "Request \(requestedAmount) back to the original payment method. This does not cancel the task.")
            }
        }
    }

    @ViewBuilder private var content: some View {
        if let message = model.releaseMessage { Section { Text(message) } }
        if !model.requests.isEmpty {
            Section("History") {
                ForEach(model.requests) { receipt in Text(receipt.message) }
            }
        }
        Section {
            if let error = model.error { Text(error).foregroundStyle(Theme.Color.error) }
            if model.hasUnconfirmedRequest { Text("This request has not been confirmed yet.") }
            Button(model.busy ? "Checking…" : "Check status") { Task { await model.checkStatus() } }
                .disabled(model.busy)
                .accessibilityIdentifier("gigRefund.checkStatus")
            if model.mayRetry {
                Button("Retry this request") { Task { await model.retry() } }
                    .accessibilityIdentifier("gigRefund.retry")
            }
        }
        if model.mayRequest {
            if editing {
                requestForm
            } else {
                Section {
                    Button(model.isRelease ? "Release authorization hold" : "Request a refund") { editing = true }
                        .accessibilityIdentifier("gigRefund.newRequest")
                }
            }
        }
    }

    private var requestForm: some View {
        Section {
            if !model.isRelease {
                TextField("Amount in USD (blank for remaining amount)", text: $amount)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("gigRefund.amount")
                Text("Up to \(PaymentRefundRequestDTO.money(model.remaining)) is available to request.")
            }
            Picker("Reason", selection: $reason) {
                ForEach(PaymentRefundReason.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            Button("Continue") { confirming = true }
                .disabled(!validAmount)
            Button("Cancel", role: .cancel) { editing = false }
        }
    }

    private var validAmount: Bool {
        if model.isRelease || amount.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        guard let cents = GigRefundViewModel.cents(amount.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
        return cents >= 50 && cents <= model.remaining
    }

    private var requestedAmount: String {
        PaymentRefundRequestDTO.money(GigRefundViewModel.cents(amount.trimmingCharacters(in: .whitespacesAndNewlines)) ?? model.remaining)
    }
}
