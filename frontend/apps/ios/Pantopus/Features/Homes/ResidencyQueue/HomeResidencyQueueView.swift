import SwiftUI

@MainActor
struct HomeResidencyQueueView: View {
    let model: HomeResidencyQueueViewModel
    let onReview: (String, HomeResidencyDecision) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text("Current pending requests").font(.headline)
                Text(
                    "These are request references. Open a review to check the applicant, current authority, "
                        + "and requested relationship before deciding."
                )
                .pantopusTextStyle(.caption)
                content
                if model.isCurrent {
                    Button("Reload current requests") { Task { await model.refresh() } }
                        .frame(minHeight: 44).accessibilityIdentifier("homeResidencyQueue.reload")
                }
            }.padding(Spacing.s4).frame(maxWidth: .infinity, alignment: .leading)
        }
        .refreshable { await model.refresh() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeResidencyQueue")
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            ProgressView("Checking current requests…").accessibilityIdentifier("homeResidencyQueue.loading")
        case let .failure(error):
            Text(error.localizedDescription).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeResidencyQueue.error")
        case let .ready(page):
            if page.claims.isEmpty {
                Text("No pending residency claims.").accessibilityIdentifier("homeClaimReview_residencyEmpty")
            } else {
                Text("\(page.claims.count) pending requests").accessibilityIdentifier("homeResidencyQueue.count")
                ForEach(page.claims) { claim in
                    HomeClaimResidencyCard(
                        item: claim,
                        isBusy: false,
                        onApprove: { review(claim.id, action: .approve) },
                        onReject: { review(claim.id, action: .reject) }
                    )
                }
            }
        }
    }

    private func review(_ claimId: String, action: HomeResidencyDecision) {
        if model.beginReview(claimId: claimId) { onReview(claimId, action) }
    }
}
