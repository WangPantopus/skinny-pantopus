import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeResidencyReviewStoring {
    func load(scope: HomeResidencyReviewScope) throws -> PendingHomeResidencyReview?
    func replace(scope: HomeResidencyReviewScope, expected: PendingHomeResidencyReview?, next: PendingHomeResidencyReview?) throws
}

/// Synchronous MainActor compare/write prevents two scenes replacing an
/// original decision. Device-only Keychain storage never syncs or backs up.
@MainActor
struct PendingHomeResidencyReviewStore: PendingHomeResidencyReviewStoring {
    private let keychain: Keychain

    init(service: String = "app.pantopus.ios.pending-home-residency-review") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomeResidencyReviewScope) throws -> PendingHomeResidencyReview? {
        guard scope.isValid else { throw HomeResidencyReviewError.sessionChanged }
        do {
            guard let bytes = try keychain.getData(key(scope)) else { return nil }
            let draft = try JSONDecoder().decode(PendingHomeResidencyReview.self, from: bytes)
            guard draft.matches(scope) else { throw HomeResidencyReviewError.storage }
            return draft
        } catch { throw HomeResidencyReviewError.storage }
    }

    func replace(scope: HomeResidencyReviewScope, expected: PendingHomeResidencyReview?, next: PendingHomeResidencyReview?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomeResidencyReviewError.storage }
        guard try load(scope: scope) == expected else { throw HomeResidencyReviewError.changed }
        do {
            if let next {
                try keychain.set(JSONEncoder().encode(next), key: key(scope))
            } else {
                try keychain.remove(key(scope))
            }
        } catch { throw HomeResidencyReviewError.storage }
    }

    private func key(_ scope: HomeResidencyReviewScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId):\(scope.homeId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
