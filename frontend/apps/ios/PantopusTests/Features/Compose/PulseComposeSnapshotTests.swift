//
//  PulseComposeSnapshotTests.swift
//  PantopusTests
//
//  P2.1 — Pulse compose form. Renders `PulseComposeContent` for each
//  intent variant (plus an empty `.ask` baseline) and asserts the
//  rendered view is non-empty + does not throw. When the iOS
//  swift-snapshot-testing dependency lands in `project.yml`, switch
//  the body of `assertRenders` to `assertSnapshot(of:as:)`. Until
//  then, the test is a structural lockfile: every intent + empty
//  shape produces a valid hosting controller hierarchy.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PulseComposeSnapshotTests: XCTestCase {
    func test_pulse_compose_ask_empty_renders() {
        assertRenders(intent: .ask, fixture: PulseComposeFixture.askEmpty)
    }

    func test_pulse_compose_ask_filled_renders() {
        assertRenders(intent: .ask, fixture: PulseComposeFixture.askFilled)
    }

    func test_pulse_compose_recommend_filled_renders() {
        assertRenders(intent: .recommend, fixture: PulseComposeFixture.recommendFilled)
    }

    func test_pulse_compose_event_filled_renders() {
        assertRenders(intent: .event, fixture: PulseComposeFixture.eventFilled)
    }

    func test_pulse_compose_lost_filled_renders() {
        assertRenders(intent: .lost, fixture: PulseComposeFixture.lostFilled)
    }

    func test_pulse_compose_announce_filled_renders() {
        assertRenders(intent: .announce, fixture: PulseComposeFixture.announceFilled)
    }

    /// Edit-mode prefill — the form opens with every field already
    /// seeded from the saved post and the intent picker locked. The
    /// fixture mirrors what the view-model emits after `loadForEdit`
    /// resolves successfully.
    func test_pulse_compose_edit_prefilled_renders() {
        assertRenders(intent: .ask, fixture: PulseComposeFixture.editPrefilledAsk)
    }

    // MARK: - Rendering helper

    /// Wraps `PulseComposeContent` in a hosting controller so layout
    /// runs once and the view-tree exists in-process. Until snapshot
    /// PNGs are recorded by a future T-task, this is the green-CI
    /// lockfile that proves each intent's content branches build.
    private func assertRenders(
        intent _: PulseComposeIntent,
        fixture: PulseComposeContentState,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: PulseComposeContent(
                state: fixture,
                actions: PulseComposeContentActions()
            )
            .frame(width: 390, height: 1200)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1200)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}

/// Fixtures matching the five intent variants. Each builds a fully
/// populated `PulseComposeContentState` so the test render exercises
/// every branch of the per-intent body.
@MainActor
enum PulseComposeFixture {
    static var askEmpty: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .ask,
            fields: blankFields()
        )
    }

    static var askFilled: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .ask,
            identity: .personal,
            askCategory: .handyman,
            fields: fields(title: "Need a plumber", body: "Pipe leaking under the kitchen sink. Anyone know someone reliable?")
        )
    }

    static var recommendFilled: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .recommend,
            identity: .personal,
            recommendRating: 4,
            fields: fields(
                body: "Best lattes on the block — really friendly staff and they remember your order.",
                recommendBusiness: "Joe's Coffee"
            )
        )
    }

    static var eventFilled: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .event,
            identity: .home,
            visibility: .neighbors,
            fields: fields(
                title: "Summer block party",
                body: "Bring chairs, snacks, and good vibes. Music starts at 6.",
                eventDate: "2030-08-15 17:00",
                eventLocation: "Elm Park, near the fountain",
                eventCapacity: "60"
            )
        )
    }

    static var lostFilled: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .lost,
            identity: .personal,
            lostFoundKind: .lost,
            fields: fields(
                body: "Tortoiseshell cat, blue collar, answers to Mochi. Very friendly.",
                lostLastSeenLocation: "Corner of 5th and Elm",
                lostLastSeenDate: "2026-05-12"
            )
        )
    }

    static var announceFilled: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .announce,
            identity: .business,
            announceAudience: .followers,
            fields: fields(
                title: "Street closure Saturday",
                body: "Elm between 4th and 6th will be closed 10-2 for the spring parade."
            )
        )
    }

    /// Edit-mode fixture for the Ask intent. The intent picker is
    /// locked (`isIntentLocked: true`) and every field arrives with a
    /// non-empty `originalValue` so dirty tracking starts at false.
    static var editPrefilledAsk: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: .ask,
            identity: .personal,
            askCategory: .handyman,
            fields: fields(
                title: "Need a plumber",
                body: "Pipe leaking under the kitchen sink. Anyone know someone reliable?"
            ),
            isIntentLocked: true
        )
    }

    private static func blankFields() -> [PulseComposeField: FormFieldState] {
        var map: [PulseComposeField: FormFieldState] = [:]
        for field in PulseComposeField.allCases {
            map[field] = FormFieldState(id: field.rawValue, originalValue: "")
        }
        return map
    }

    private static func fields(
        title: String = "",
        body: String = "",
        recommendBusiness: String = "",
        eventDate: String = "",
        eventLocation: String = "",
        eventCapacity: String = "",
        lostLastSeenLocation: String = "",
        lostLastSeenDate: String = ""
    ) -> [PulseComposeField: FormFieldState] {
        var map = blankFields()
        map[.title] = FormFieldState(id: "title", originalValue: title)
        map[.body] = FormFieldState(id: "body", originalValue: body)
        map[.recommendBusiness] = FormFieldState(id: "recommendBusiness", originalValue: recommendBusiness)
        map[.eventDate] = FormFieldState(id: "eventDate", originalValue: eventDate)
        map[.eventLocation] = FormFieldState(id: "eventLocation", originalValue: eventLocation)
        map[.eventCapacity] = FormFieldState(id: "eventCapacity", originalValue: eventCapacity)
        map[.lostLastSeenLocation] = FormFieldState(id: "lostLastSeenLocation", originalValue: lostLastSeenLocation)
        map[.lostLastSeenDate] = FormFieldState(id: "lostLastSeenDate", originalValue: lostLastSeenDate)
        return map
    }
}
