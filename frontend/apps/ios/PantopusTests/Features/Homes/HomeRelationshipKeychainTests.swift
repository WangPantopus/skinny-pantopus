import CryptoKit
import KeychainAccess
import XCTest
@testable import Pantopus

@MainActor
final class HomeRelationshipKeychainTests: XCTestCase {
    /// Real simulator Keychain, including fresh store instances and damaged bytes.
    func testOriginalSurvivesReopenAndCompetingWriterCannotReplaceOrClearCorruptBytes() throws {
        let service = "app.pantopus.tests.relationship.\(UUID().uuidString)"
        let keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
        defer { try? keychain.removeAll() }
        let scope = "isolated-origin|actor|home"
        let key = SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
        let draft = HomeRelationshipDraft(
            version: 1,
            origin: "https://example.invalid",
            actorId: UUID().uuidString.lowercased(),
            homeId: UUID().uuidString.lowercased(),
            claimId: UUID().uuidString.lowercased(),
            command: HomeRelationshipCommand(
                action: .decline,
                note: "Original private note",
                requestId: UUID().uuidString.lowercased(),
                reviewToken: String(repeating: "a", count: 64)
            )
        )
        let first = PendingHomeRelationshipStore(service: service)
        try first.save(draft, scope: scope, matching: nil)
        let reopened = PendingHomeRelationshipStore(service: service)
        XCTAssertEqual(try reopened.load(scope: scope), draft)
        XCTAssertNil(try reopened.load(scope: scope + "other-account"))
        XCTAssertThrowsError(try reopened.save(draft, scope: scope, matching: nil))
        XCTAssertEqual(try first.load(scope: scope), draft)
        let original = try XCTUnwrap(keychain.getData(key))
        let corrupt = Data("{damaged-original".utf8)
        try keychain.set(corrupt, key: key)
        XCTAssertThrowsError(try reopened.load(scope: scope))
        XCTAssertThrowsError(try reopened.save(draft, scope: scope, matching: nil))
        XCTAssertThrowsError(try reopened.clear(scope: scope, matching: draft))
        XCTAssertEqual(try keychain.getData(key), corrupt)
        try keychain.set(original, key: key)
        XCTAssertEqual(try first.load(scope: scope), draft)
        try reopened.clear(scope: scope, matching: draft)
        XCTAssertNil(try first.load(scope: scope))
    }
}
