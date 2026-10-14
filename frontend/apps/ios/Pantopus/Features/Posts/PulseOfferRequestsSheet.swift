import SwiftUI

struct PulseOfferRequestsSheet: View {
    @Bindable var viewModel: PulsePostDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var pendingChoice: PulseOfferClaimDTO?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    switch viewModel.offerRequestsState {
                    case .loading:
                        ForEach(0..<3, id: \.self) { _ in FeedSkeletonCard() }
                    case let .error(message):
                        Text(message).pulseFont(.body)
                        Button("Retry") { Task { await viewModel.loadOfferRequests() } }
                            .pulseFont(.button).frame(minHeight: 44)
                    case let .loaded(response):
                        if response.claims.isEmpty {
                            Text("No requests yet.").pulseFont(.body)
                        }
                        ForEach(response.claims) { claim in
                            requestRow(claim, offer: response.offer)
                            Divider()
                        }
                    }
                }
                .padding(Spacing.s4)
            }
            .foregroundStyle(Theme.Color.appText)
            .background(Theme.Color.appBg)
            .navigationTitle("Requests")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.pulseFont(.button)
                }
            }
            .refreshable { await viewModel.loadOfferRequests() }
            .task { await viewModel.loadOfferRequests() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .alert("Choose this requester?", isPresented: Binding(
                get: { pendingChoice != nil },
                set: { if !$0 { pendingChoice = nil } }
            )) {
                Button("Choose") {
                    if let claim = pendingChoice {
                        pendingChoice = nil
                        Task { await viewModel.chooseConversationOffer(claim) }
                    }
                }
                Button("Cancel", role: .cancel) { pendingChoice = nil }
            } message: {
                Text("The other requesters will be told someone else got this one.")
            }
        }
        .accessibilityIdentifier("pulseOfferRequests")
    }

    private func requestRow(_ claim: PulseOfferClaimDTO, offer: PulseOfferDTO?) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(claim.author?.displayName ?? "A neighbor").pulseFont(.button)
            if let label = claim.author?.label.flatMap(PulseAuthorLabel.init(rawValue:)) {
                Text(label.text).pulseFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
            }
            if let note = claim.note, !note.isEmpty {
                Text(note).pulseFont(.body).fixedSize(horizontal: false, vertical: true)
            }
            if claim.status == "requested", offer?.gone == false, offer?.claimMode == "choose" {
                Button("Choose") { pendingChoice = claim }
                    .pulseFont(.button)
                    .frame(minHeight: 44)
                    .disabled(!viewModel.pendingConversationActions.isEmpty)
                    .accessibilityLabel("Choose \(claim.author?.displayName ?? "this requester")")
                    .accessibilityIdentifier("pulseOfferChoose_\(claim.id)")
            } else {
                Text(statusLabel(claim.status)).pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func statusLabel(_ status: String?) -> String {
        switch status {
        case "chosen": "Chosen"
        case "gone": "Someone else got this one."
        case "declined": "Declined"
        case "requested": "Requested"
        default: "Request"
        }
    }
}
