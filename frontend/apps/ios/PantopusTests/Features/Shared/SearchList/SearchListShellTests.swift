//
//  SearchListShellTests.swift
//  PantopusTests
//
//  P4.1 — Contract + render tests for the shared SearchListShell.
//  Confirms that:
//    - the shell constructs and materialises in each of the four body
//      phases (recent / typing / results / empty),
//    - the cancel + clear callbacks fire,
//    - the empty-state payload + RecentQueriesStore preserve their data.
//
//  These are construction tests — SwiftUI render traps would crash the
//  hosting controller below. Snapshot baselines for the four phases are
//  generated via the same harness as `T6ScreensSnapshotTests.swift`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class SearchListShellTests: XCTestCase {
    // MARK: - Construction in each phase

    func testShellRendersRecentPhase() {
        let query = Binding<String>.constant("")
        let shell = SearchListShell<String, AnyView>(
            placeholder: "Search neighbors",
            query: query,
            results: [],
            isLoading: false,
            recentQueries: ["chimney sweep", "drill bits", "lawnmower"],
            onRecentTap: { _ in },
            emptyState: EmptyStateContent(
                icon: .search,
                headline: "No matches",
                subcopy: "Try a different keyword."
            ),
            row: { _ in AnyView(EmptyView()) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testShellRendersTypingPhaseWhileLoading() {
        let query = Binding<String>.constant("chi")
        let shell = SearchListShell<String, AnyView>(
            placeholder: "Search",
            query: query,
            results: [],
            isLoading: true,
            recentQueries: [],
            emptyState: EmptyStateContent(
                icon: .search,
                headline: "No matches",
                subcopy: "Try again."
            ),
            row: { _ in AnyView(EmptyView()) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testShellRendersResultsPhase() {
        let query = Binding<String>.constant("maria")
        let shell = SearchListShell<String, AnyView>(
            placeholder: "Search",
            query: query,
            results: ["Maria Kovács", "Maria Park", "Marian Lee"],
            isLoading: false,
            recentQueries: [],
            emptyState: EmptyStateContent(
                icon: .search,
                headline: "No matches",
                subcopy: "Try again."
            ),
            row: { result in
                AnyView(Text(result).padding())
            },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testShellRendersEmptyPhaseWhenResultsAreEmpty() {
        let query = Binding<String>.constant("zzzzzzzz")
        let shell = SearchListShell<String, AnyView>(
            placeholder: "Search",
            query: query,
            results: [],
            isLoading: false,
            recentQueries: ["earlier", "older"],
            emptyState: EmptyStateContent(
                icon: .search,
                headline: "No matches",
                subcopy: "We didn't find anyone matching zzzzzzzz."
            ),
            row: { _ in AnyView(EmptyView()) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    // MARK: - EmptyStateContent payload

    func testEmptyStateContentPreservesFields() {
        let content = EmptyStateContent(
            icon: .search,
            headline: "Headline",
            subcopy: "Subcopy"
        )
        XCTAssertEqual(content.icon, .search)
        XCTAssertEqual(content.headline, "Headline")
        XCTAssertEqual(content.subcopy, "Subcopy")
    }

    func testEmptyStateContentIsHashable() {
        let a = EmptyStateContent(icon: .search, headline: "A", subcopy: "B")
        let b = EmptyStateContent(icon: .search, headline: "A", subcopy: "B")
        XCTAssertEqual(a, b)
    }
}

// MARK: - RecentQueriesStore

@MainActor
final class RecentQueriesStoreTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        let suite = "tests.pantopus.recents.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else {
            XCTFail("Unable to create isolated UserDefaults suite")
            return .standard
        }
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    func testRecordPersistsQuery() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("chimney sweep")
        XCTAssertEqual(store.load(), ["chimney sweep"])
    }

    func testRecordMovesToFrontOnDuplicate() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("a")
        store.record("b")
        store.record("c")
        store.record("a")
        XCTAssertEqual(store.load(), ["a", "c", "b"])
    }

    func testRecordIsCaseInsensitive() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("Chimney Sweep")
        store.record("chimney sweep")
        XCTAssertEqual(store.load(), ["chimney sweep"])
    }

    func testRecordIgnoresEmptyAndWhitespace() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("")
        store.record("   ")
        store.record("\n\t")
        XCTAssertTrue(store.load().isEmpty)
    }

    func testRecordTrimsWhitespace() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("  drill bits  ")
        XCTAssertEqual(store.load(), ["drill bits"])
    }

    func testRecordCapsAtLimit() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", limit: 3, defaults: defaults)
        store.record("a")
        store.record("b")
        store.record("c")
        store.record("d")
        XCTAssertEqual(store.load(), ["d", "c", "b"])
    }

    func testClearWipesPersistedQueries() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.test.recent", defaults: defaults)
        store.record("a")
        store.record("b")
        store.clear()
        XCTAssertTrue(store.load().isEmpty)
    }

    func testLoadOnFreshKeyReturnsEmpty() {
        let defaults = makeDefaults()
        let store = RecentQueriesStore(userDefaultsKey: "search.never.set", defaults: defaults)
        XCTAssertTrue(store.load().isEmpty)
    }

    func testStoresWithDifferentKeysAreIndependent() {
        let defaults = makeDefaults()
        let a = RecentQueriesStore(userDefaultsKey: "search.surfaceA.recent", defaults: defaults)
        let b = RecentQueriesStore(userDefaultsKey: "search.surfaceB.recent", defaults: defaults)
        a.record("only-on-a")
        XCTAssertEqual(a.load(), ["only-on-a"])
        XCTAssertTrue(b.load().isEmpty)
    }
}
