import SwiftUI

/// Reopen only an exact claim found in this account's authenticated claim list.
struct ClaimEvidenceDestinationView: View {
    let claimId: String
    @State private var client = PrivateClaimEvidenceClient()
    @State private var evidence: PrivateClaimEvidenceViewModel?
    @State private var error: String?

    var body: some View {
        Group {
            if let evidence { PrivateClaimEvidenceView(model: evidence) } else if let error {
                VStack(spacing: 16) {
                    Text(error)
                    Button("Retry") { Task { await load() } }
                }.padding()
            } else { ProgressView() }
        }
        .navigationTitle("Claim documents")
        .task { await load() }
        .onDisappear { client.retire() }
    }

    private func load() async {
        do {
            let response = try await client.claims()
            guard let claim = response.claims.first(where: { $0.id == claimId }) else { throw APIError.notFound }
            try client.requireCurrent()
            let type: ClaimVerificationType? = claim.status == "under_review"
                ? (claim.claimType == "resident" ? .residency : .owner) : nil
            evidence = PrivateClaimEvidenceViewModel(
                homeId: claim.homeId,
                claimId: claim.id,
                claimant: true,
                uploadType: type,
                client: client
            )
            error = nil
        } catch { self.error = HomeClaimReviewError.message(for: error) }
    }
}
