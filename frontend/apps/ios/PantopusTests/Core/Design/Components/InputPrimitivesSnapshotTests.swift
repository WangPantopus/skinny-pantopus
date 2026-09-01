//
//  InputPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  Coverage for the P1.2 input + indicator primitives:
//  CodeInput, StrengthMeter, ChannelChip / ChannelTriad, EnvelopeOcrBox.
//
//  * `StrengthMeter` ships a pure-function rule evaluator — tests exhaust
//    all 16 combinations of the four rule flags × 2 breached states (32
//    cases) to lock the contract.
//  * `CodeInput` is exercised through its `Binding<String>` so we can
//    verify auto-advance, backspace, capping, and that `onComplete` fires
//    exactly once on the <6 → 6 transition.
//  * `ChannelChip` locked state must swallow taps even when an `onTap`
//    closure is supplied.
//  * Each primitive also has a render smoke test that hosts the view in
//    a `UIHostingController` and asserts it builds.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class InputPrimitivesSnapshotTests: XCTestCase {
    // MARK: - Render smoke tests

    private func assertRenders(
        _ label: String,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 375, height: 800)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    func testCodeInputRendersAcrossStates() {
        assertRenders("CodeInput empty") {
            CodeInput(value: .constant(""))
        }
        assertRenders("CodeInput partial") {
            CodeInput(value: .constant("4Q2"))
        }
        assertRenders("CodeInput filled") {
            CodeInput(value: .constant("4Q2K7B"))
        }
        assertRenders("CodeInput disabled") {
            CodeInput(value: .constant(""), isDisabled: true)
        }
    }

    func testStrengthMeterRendersAcrossStates() {
        let cases: [PasswordStrength] = [
            .evaluate(""),
            .evaluate("abcdefg"),
            .evaluate("abcDefghijkl"),
            .evaluate("abcDefghi123"),
            .evaluate("abcDef123!@#x"),
            .evaluate("password1234", breached: true)
        ]
        for (i, strength) in cases.enumerated() {
            assertRenders("StrengthMeter[\(i)]") { StrengthMeter(strength) }
        }
    }

    func testChannelChipRendersAcrossStates() {
        let states: [ChannelState] = [.on, .off, .locked]
        for state in states {
            for glyph in ChannelGlyph.allCases {
                assertRenders("ChannelChip \(glyph)/\(state)") {
                    ChannelChip(glyph: glyph, state: state)
                }
            }
        }
        assertRenders("ChannelTriad bools") { ChannelTriad(p: true, e: false, s: true) }
        assertRenders("ChannelTriad locked") {
            ChannelTriad(p: .locked, e: .on, s: .off)
        }
    }

    func testEnvelopeOcrBoxRendersAcrossTones() {
        let rect = CGRect(x: 16, y: 60, width: 120, height: 22)
        assertRenders("EnvelopeOcrBox clean") {
            EnvelopeOcrBox(rect: rect, tone: .clean, label: "name · 97%")
        }
        assertRenders("EnvelopeOcrBox unclear") {
            EnvelopeOcrBox(rect: rect, tone: .unclear, label: "name · 31%")
        }
        assertRenders("EnvelopeOcrBox no label") {
            EnvelopeOcrBox(rect: rect, tone: .clean)
        }
    }

    // MARK: - StrengthMeter rule matrix

    /// Exhaust all 16 combinations of the four rule pass/fail flags and
    /// both breach states (= 32 cases). Locks the contract that the
    /// pure-function evaluator + `rulesMet` count + `isStrong` flag
    /// behave as the design pack documents.
    func testStrengthMeterAllCombinations() {
        // Build inputs that toggle each rule independently. Using literal
        // strings rather than synthesised ones keeps the test data
        // inspectable and immune to evaluator drift.
        for mask in 0..<16 {
            let wantMin = (mask & 0b0001) != 0
            let wantCase = (mask & 0b0010) != 0
            let wantNumber = (mask & 0b0100) != 0
            let wantSymbol = (mask & 0b1000) != 0

            let password = buildPassword(
                hasMinLength: wantMin,
                hasMixedCase: wantCase,
                hasNumber: wantNumber,
                hasSymbol: wantSymbol
            )
            for breached in [false, true] {
                let strength = PasswordStrength.evaluate(password, breached: breached)

                XCTAssertEqual(
                    strength.hasMinLength,
                    wantMin,
                    "mask=\(mask) breached=\(breached) min-length"
                )
                XCTAssertEqual(
                    strength.hasMixedCase,
                    wantCase,
                    "mask=\(mask) breached=\(breached) mixed-case"
                )
                XCTAssertEqual(
                    strength.hasNumber,
                    wantNumber,
                    "mask=\(mask) breached=\(breached) number"
                )
                XCTAssertEqual(
                    strength.hasSymbol,
                    wantSymbol,
                    "mask=\(mask) breached=\(breached) symbol"
                )
                XCTAssertEqual(
                    strength.breached,
                    breached,
                    "mask=\(mask) breached=\(breached) breach passthrough"
                )

                let expectedCount =
                    (wantMin ? 1 : 0) + (wantCase ? 1 : 0) +
                    (wantNumber ? 1 : 0) + (wantSymbol ? 1 : 0)
                XCTAssertEqual(strength.rulesMet, expectedCount)

                let expectedStrong = expectedCount == 4 && !breached
                XCTAssertEqual(strength.isStrong, expectedStrong)

                // Render smoke: every combination must still build.
                assertRenders("StrengthMeter mask=\(mask) breached=\(breached)") {
                    StrengthMeter(strength)
                }
            }
        }
    }

    private func buildPassword(
        hasMinLength: Bool,
        hasMixedCase: Bool,
        hasNumber: Bool,
        hasSymbol: Bool
    ) -> String {
        var s = hasMixedCase ? "aB" : "ab"
        if hasNumber { s.append("3") }
        if hasSymbol { s.append("!") }
        // Pad to >= 12 only when the min-length rule should pass.
        if hasMinLength {
            while s.count < 12 {
                s.append("x")
            }
        } else {
            // Force length < 12 — trim only if we accidentally crossed it
            // (we can't from the seeds above, but defensive).
            s = String(s.prefix(11))
        }
        return s
    }

    // MARK: - CodeInput binding behavior

    private func makeCodeInput(
        initial: String = "",
        onComplete: ((String) -> Void)? = nil
    ) -> (CodeInput, () -> String) {
        var storage = initial
        let binding = Binding<String>(get: { storage }, set: { storage = $0 })
        let input = CodeInput(value: binding, onComplete: onComplete)
        return (input, { storage })
    }

    func testCodeInputAutoAdvancesAndUppercases() {
        let (input, read) = makeCodeInput()
        input.applyInput("a")
        XCTAssertEqual(read(), "A")

        input.applyInput("A4")
        XCTAssertEqual(read(), "A4")

        input.applyInput("A4Q2K")
        XCTAssertEqual(read(), "A4Q2K")
    }

    func testCodeInputBackspaceClearsPriorBox() {
        let (input, read) = makeCodeInput(initial: "ABC")
        input.applyInput("AB")
        XCTAssertEqual(read(), "AB")

        input.applyInput("")
        XCTAssertEqual(read(), "")
    }

    func testCodeInputCapsAtSixChars() {
        let (input, read) = makeCodeInput()
        input.applyInput("ABCDEFGHIJ")
        XCTAssertEqual(read(), "ABCDEF")
    }

    func testCodeInputCompletionFiresOnceOnFill() {
        var completionCalls: [String] = []
        let (input, read) = makeCodeInput { completionCalls.append($0) }

        input.applyInput("AB")
        XCTAssertTrue(completionCalls.isEmpty)

        input.applyInput("ABCDEF")
        XCTAssertEqual(completionCalls, ["ABCDEF"])
        XCTAssertEqual(read(), "ABCDEF")

        // Once at 6 chars, further (no-op) set with same value must not refire.
        input.applyInput("ABCDEF")
        XCTAssertEqual(completionCalls, ["ABCDEF"])

        // Trim → re-fill must fire again on the <6 → 6 transition.
        input.applyInput("ABCDE")
        input.applyInput("ABCDEX")
        XCTAssertEqual(completionCalls, ["ABCDEF", "ABCDEX"])
    }

    // MARK: - ChannelChip tap contract

    func testChannelChipLockedSwallowsTap() {
        var taps = 0
        let locked = ChannelChip(glyph: .p, state: .locked) { taps += 1 }
        locked.handleTap()
        locked.handleTap()
        XCTAssertEqual(taps, 0, "Locked chip must not fire onTap")
    }

    func testChannelChipOnOffFiresTap() {
        var taps = 0
        let off = ChannelChip(glyph: .p, state: .off) { taps += 1 }
        let on = ChannelChip(glyph: .e, state: .on) { taps += 1 }
        off.handleTap()
        on.handleTap()
        XCTAssertEqual(taps, 2)
    }

    func testChannelChipNoTapClosureNoOp() {
        // No closure means handleTap is a no-op — the chip is still rendered
        // but cannot fire any callback. This documents the contract for
        // read-only / preview usages.
        let chip = ChannelChip(glyph: .s, state: .on)
        chip.handleTap()
        // Reaching this line without crashing is the assertion.
        XCTAssertNotNil(chip)
    }
}
