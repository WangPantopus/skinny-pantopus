import SwiftUI

@MainActor
struct HomeResidencyQueueView: View {
    let model: HomeResidencyQueueViewModel
    let onReview: (String, HomeResidencyDecision) -> Void

    var body: some View {
        Group {
            if case let .ready(page) = model.state, page.claims.isEmpty {
                VStack {
                    content
                    reloadButton
                }
            } else {
                ScrollView {
                    VStack(spacing: Spacing.s3) {
                        content
                        reloadButton
                    }.padding(Spacing.s4).frame(maxWidth: .infinity, alignment: .leading)
                }
                .refreshable { await model.refresh() }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeResidencyQueue")
    }

    @ViewBuilder private var reloadButton: some View {
        if model.isCurrent {
            Button("Reload current requests") { Task { await model.refresh() } }
                .frame(minHeight: 44).accessibilityIdentifier("homeResidencyQueue.reload")
        }
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            ProgressView("Checking current requests…").accessibilityIdentifier("homeResidencyQueue.loading")
        case let .failure(error):
            Text(error.localizedDescription).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeResidencyQueue.error")
        case let .ready(page):
            if page.claims.isEmpty {
                EmptyState(
                    icon: .checkCheck,
                    headline: "No pending residency claims",
                    subcopy: "Neighbors asking to join this household will show up here "
                        + "with the role they requested.",
                    tint: Theme.Color.successBg,
                    accent: Theme.Color.success
                )
                .accessibilityIdentifier("homeClaimReview_residencyEmpty")
            } else {
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
