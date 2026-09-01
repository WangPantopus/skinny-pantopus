//
//  MemoryBodySnapshotTests.swift
//  PantopusTests
//
//  A.12 (A17.7) — structural render snapshots for the Memory mail body
//  across both designed states: fresh arrival (facts grid + "Save to
//  Vault") and saved-to-vault (vault-location card + saved banner). Same
//  pattern as the other screen snapshot suites: until
//  `swift-snapshot-testing` ships in `project.yml`, each fixture asserts a
//  valid hosting hierarchy with non-zero geometry, backed by invariant
//  checks on the sample keepsake.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class MemoryBodySnapshotTests: XCTestCase {
    /// Named so the interactive renders avoid a trailing-closure literal as
    /// the final argument (two optional closure params make the trailing
    /// form ambiguous).
    private let noop: @MainActor () -> Void = {}

    // MARK: - Render states

    func test_memory_fresh_renders() {
        assertRenders(
            MemoryBody(memory: MemorySampleData.memory, isSaved: false, onOpenThread: noop)
        )
    }

    func test_memory_saved_renders() {
        assertRenders(
            MemoryBody(memory: MemorySampleData.savedMemory, isSaved: true, onOpenVault: noop)
        )
    }

    func test_memory_fresh_nonInteractive_renders() {
        // Production dispatch passes nil nav closures — the pulse row is
        // non-tappable and the vault open-link is absent; still must render.
        assertRenders(MemoryBody(memory: MemorySampleData.memory, isSaved: false))
    }

    func test_memory_components_render() {
        assertRenders(
            PolaroidFrame(imageURL: nil, caption: "Pepper, May 19 2025", label: "1 of 1 · sent by Mei")
        )
        assertRenders(
            StationeryCard(
                eyebrow: "The note",
                paragraphs: MemorySampleData.memory.note,
                signature: MemorySampleData.memory.noteSignature
            )
        )
    }

    // MARK: - Sample-data invariants

    func test_freshFixture_shape() {
        let memory = MemorySampleData.memory
        XCTAssertFalse(memory.isSaved)
        XCTAssertEqual(memory.note.count, 3, "Note is three handwritten paragraphs")
        XCTAssertEqual(memory.facts.count, 4)
        XCTAssertEqual(memory.elfFresh.bullets.count, 3)
        // The originating Pulse post is the lone tappable fact.
        let tappable = memory.facts.filter { $0.linkHint != nil }
        XCTAssertEqual(tappable.count, 1)
        XCTAssertEqual(tappable.first?.kind, .pulseThread)
    }

    func test_savedFixture_swapsToVault() {
        let saved = MemorySampleData.savedMemory
        XCTAssertTrue(saved.isSaved)
        XCTAssertEqual(saved.elfSaved.bullets.count, 3)
        XCTAssertEqual(saved.vault.trail.count, 4)
        XCTAssertEqual(saved.vault.stats.count, 3)
        // The breadcrumb terminates on the current folder.
        XCTAssertEqual(saved.vault.trail.last?.isCurrent, true)
        XCTAssertEqual(saved.vault.trail.filter(\.isCurrent).count, 1)
    }

    func test_withSaved_flipsOnlySavedFlag() {
        let fresh = MemorySampleData.memory
        let saved = fresh.withSaved(true)
        XCTAssertNotEqual(fresh.isSaved, saved.isSaved)
        // Everything else is untouched.
        XCTAssertEqual(saved.title, fresh.title)
        XCTAssertEqual(saved.note, fresh.note)
        XCTAssertEqual(saved.facts, fresh.facts)
        XCTAssertEqual(saved.vault, fresh.vault)
    }

    // MARK: - Render helper

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 1400))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1400)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
