//
//  AccountHintTests.swift
//  PantopusTests
//
//  Remembered-account hints: masking, JSON shape (CONTRACT "Client storage
//  keys"), most-recent-first ordering and the max-3 cap.
//

import XCTest
@testable import Pantopus

final class AccountHintTests: XCTestCase {
    private func hint(_ userId: String, seenAt: Date = Date()) -> AccountHint {
        AccountHint(
            userId: userId,
            displayName: "User \(userId)",
            avatarUrl: URL(string: "https://cdn.example.com/\(userId).png"),
            maskedEmail: "u•••@example.com",
            lastMethod: .password,
            lastSeenAt: seenAt
        )
    }

    func testMaskKeepsFirstCharacterAndDomain() {
        XCTAssertEqual(AccountHint.mask(email: "alice@example.com"), "a•••@example.com")
        XCTAssertEqual(AccountHint.mask(email: "  Y.wang@gmail.com "), "Y•••@gmail.com")
        XCTAssertEqual(AccountHint.mask(email: "@nolocal.com"), "•••")
        XCTAssertNil(AccountHint.mask(email: ""))
    }

    func testHintFromUserMasksTheEmail() {
        let user = UserDTO(id: "u_1", email: "alice@example.com", displayName: "Alice", avatarURL: nil)
        let hint = AccountHint(user: user, lastMethod: .google, lastSeenAt: Date(timeIntervalSince1970: 1))
        XCTAssertEqual(hint.userId, "u_1")
        XCTAssertEqual(hint.maskedEmail, "a•••@example.com")
        XCTAssertEqual(hint.lastMethod, .google)
        XCTAssertEqual(hint.displayName, "Alice")
    }

    func testStoredJSONUsesContractFieldNames() throws {
        let store = InMemorySecureStore()
        AccountHintStore.remember(hint("u_1", seenAt: Date(timeIntervalSince1970: 1_700_000_000)), in: store)
        let json = try XCTUnwrap(store.get(SecureStoreKey.accountHints))
        let array = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [[String: Any]])
        XCTAssertEqual(array.count, 1)
        XCTAssertEqual(Set(array[0].keys), ["userId", "displayName", "avatarUrl", "maskedEmail", "lastMethod", "lastSeenAt"])
        XCTAssertEqual(array[0]["lastMethod"] as? String, "password")
        XCTAssertEqual(array[0]["lastSeenAt"] as? String, "2023-11-14T22:13:20Z")
    }

    func testRememberIsMostRecentFirstAndCappedAtThree() {
        let store = InMemorySecureStore()
        for id in ["a", "b", "c", "d"] {
            AccountHintStore.remember(hint(id), in: store)
        }
        XCTAssertEqual(AccountHintStore.load(from: store).map(\.userId), ["d", "c", "b"])

        // Re-remembering an existing account moves it to the front.
        AccountHintStore.remember(hint("b"), in: store)
        XCTAssertEqual(AccountHintStore.load(from: store).map(\.userId), ["b", "d", "c"])
        XCTAssertEqual(AccountHintStore.mostRecent(in: store)?.userId, "b")
    }

    func testRemoveAndClear() {
        let store = InMemorySecureStore()
        AccountHintStore.remember(hint("a"), in: store)
        AccountHintStore.remember(hint("b"), in: store)
        AccountHintStore.remove(userId: "b", from: store)
        XCTAssertEqual(AccountHintStore.load(from: store).map(\.userId), ["a"])
        AccountHintStore.remove(userId: "a", from: store)
        XCTAssertNil(store.get(SecureStoreKey.accountHints), "an empty list deletes the item")
        AccountHintStore.remember(hint("c"), in: store)
        AccountHintStore.clear(store)
        XCTAssertTrue(AccountHintStore.load(from: store).isEmpty)
    }

    func testMalformedStorageReadsAsEmpty() throws {
        let store = InMemorySecureStore()
        try store.set("not json", for: SecureStoreKey.accountHints)
        XCTAssertTrue(AccountHintStore.load(from: store).isEmpty)
    }

    func testTouchedUpdatesSeenAtAndOptionallyMethod() {
        let original = hint("a", seenAt: Date(timeIntervalSince1970: 0))
        let touched = original.touched(at: Date(timeIntervalSince1970: 10))
        XCTAssertEqual(touched.lastSeenAt, Date(timeIntervalSince1970: 10))
        XCTAssertEqual(touched.lastMethod, .password)
        XCTAssertEqual(touched.touched(at: Date(), method: .apple).lastMethod, .apple)
    }
}
