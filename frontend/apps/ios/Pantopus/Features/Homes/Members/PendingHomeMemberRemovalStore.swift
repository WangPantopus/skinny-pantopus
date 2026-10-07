import CryptoKit
import Foundation
import KeychainAccess

@MainActor
protocol PendingHomeMemberRemovalStoring {
    func load(scope: HomeCreationScope) throws -> PendingHomeMemberRemoval?
    func replace(scope: HomeCreationScope, expected: PendingHomeMemberRemoval?, next: PendingHomeMemberRemoval?) throws
}

/// One device-only original per account/origin, including after logout.
@MainActor
struct PendingHomeMemberRemovalStore: PendingHomeMemberRemovalStoring {
    private let keychain: Keychain
    init(service: String = "app.pantopus.ios.pending-home-member-removal") {
        keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
    }

    func load(scope: HomeCreationScope) throws -> PendingHomeMemberRemoval? {
        guard scope.isValid else { throw HomeMemberRemovalError.sessionChanged }
        do {
            guard let bytes = try keychain.getData(Self.key(scope)) else { return nil }
            let original = try JSONDecoder().decode(PendingHomeMemberRemoval.self, from: bytes)
            guard original.matches(scope) else { throw HomeMemberRemovalError.storage }
            return original
        } catch { throw HomeMemberRemovalError.storage }
    }

    func replace(scope: HomeCreationScope, expected: PendingHomeMemberRemoval?, next: PendingHomeMemberRemoval?) throws {
        guard scope.isValid, next == nil || next?.matches(scope) == true else { throw HomeMemberRemovalError.storage }
        guard try load(scope: scope) == expected else { throw HomeMemberRemovalError.changed }
        do {
            if let next {
                try keychain.set(JSONEncoder().encode(next), key: Self.key(scope))
            } else {
                try keychain.remove(Self.key(scope))
            }
        } catch { throw HomeMemberRemovalError.storage }
    }

    static func key(_ scope: HomeCreationScope) -> String {
        let identity = "\(scope.origin.utf8.count):\(scope.origin):\(scope.actorId)"
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Whether this account has an unfinished invitation or member removal saved on this device. Household
/// screens show their recovery links only then, or when the saved attempt can't be read, so the recovery
/// screen can say why.
@MainActor
struct SavedHouseholdAttempts: Equatable {
    var invitation = false
    var removal = false

    static func current(api: APIClient = .shared) -> Self {
        let scope = HomeInvitationDecisionViewModel.scope(api: api)
        return Self(
            invitation: saved { try PendingHomeInvitationSenderStore().load(scope: scope) != nil },
            removal: saved { try PendingHomeMemberRemovalStore().load(scope: scope) != nil }
        )
    }

    private static func saved(_ check: () throws -> Bool) -> Bool {
        (try? check()) ?? true
    }
}
