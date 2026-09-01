//
//  BookingFollowUpViewModel.swift
//  Pantopus
//
//  Stream I9 — E7 Post-Meeting Follow-up. After a past booking, send a
//  thank-you / rebook nudge via `POST /bookings/:id/nudge`. Outcome chips swap
//  a smart-default template; "Send rebook link" mints a one-off link
//  (`POST /booking-page/one-off-links`) and appends it. A private host-only note
//  has no persistence endpoint yet (backend gap) so "Save note only" keeps it
//  on-device and dismisses.
//

import Observation
import SwiftUI

enum FollowUpOutcome: String, CaseIterable, Identifiable {
    case completed, noShow, rebookNeeded
    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .completed: "Completed"
        case .noShow: "No-show"
        case .rebookNeeded: "Rebook needed"
        }
    }

    var template: String {
        switch self {
        case .completed: "Thanks for the time today — good to connect. Want to book again?"
        case .noShow: "Sorry we missed each other today. Here's a link to grab another time."
        case .rebookNeeded: "Let's find another time that works for you — here's my booking link to grab a slot."
        }
    }
}

@Observable
@MainActor
final class BookingFollowUpViewModel {
    let owner: SchedulingOwner
    let bookingId: String
    let eventTypeId: String?
    let inviteeName: String
    let headerSubtitle: String

    var outcome: FollowUpOutcome?
    var message: String = ""
    var privateNote: String = ""
    var pushOn = true

    private(set) var isSending = false
    private(set) var isAppendingLink = false
    private(set) var didSend = false
    var errorMessage: String?

    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        bookingId: String,
        eventTypeId: String?,
        inviteeName: String,
        headerSubtitle: String,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.bookingId = bookingId
        self.eventTypeId = eventTypeId
        self.inviteeName = inviteeName
        self.headerSubtitle = headerSubtitle
        self.client = client
    }

    private var trimmedMessage: String {
        message.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedNote: String {
        privateNote.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// True when there is no outcome selected and no message typed — the CTA
    /// becomes the calm ghost "Save note only". Matches Frame 1 (blank open)
    /// and also covers the case where the user has typed a private note but
    /// has not composed a send message yet. The ghost CTA dismisses the sheet
    /// and keeps any private note on-device (no network call needed).
    var isSaveNoteOnly: Bool {
        trimmedMessage.isEmpty && outcome == nil
    }

    var canSubmit: Bool {
        isSaveNoteOnly ? true : !trimmedMessage.isEmpty
    }

    var canAppendRebookLink: Bool {
        eventTypeId != nil && !isAppendingLink
    }

    var primaryTitle: String {
        if errorMessage != nil, !isSaveNoteOnly { return "Try again" }
        return isSaveNoteOnly ? "Save note only" : "Send follow-up"
    }

    var primaryIcon: PantopusIcon {
        // JSX error frame CTA uses lucide `rotate-cw` (not `refresh-cw`).
        if errorMessage != nil, !isSaveNoteOnly { return .rotateCw }
        return isSaveNoteOnly ? .lock : .send
    }

    var primaryIsGhost: Bool {
        isSaveNoteOnly && errorMessage == nil
    }

    func select(_ outcome: FollowUpOutcome) {
        if self.outcome == outcome {
            self.outcome = nil
        } else {
            self.outcome = outcome
            message = outcome.template
        }
    }

    func appendRebookLink() async {
        guard let eventTypeId, !isAppendingLink else { return }
        isAppendingLink = true
        errorMessage = nil
        defer { isAppendingLink = false }
        do {
            let response: OneOffLinkResponse = try await client.request(
                SchedulingEndpoints.createOneOffLink(owner: owner, OneOffLinkRequest(eventTypeId: eventTypeId))
            )
            if trimmedMessage.isEmpty {
                message = "Here's a link to grab another time: \(response.path)"
            } else {
                message += "\n\n\(response.path)"
            }
        } catch let error as SchedulingError {
            errorMessage = error.userMessage ?? "Couldn't create a rebook link."
        } catch {
            errorMessage = "Couldn't create a rebook link."
        }
    }

    /// Sends the follow-up message. No-op for the save-note-only case (the
    /// private note is not persisted server-side — see header).
    func send() async {
        guard !isSending, !isSaveNoteOnly, !trimmedMessage.isEmpty else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let _: SchedulingOkResponse = try await client.request(
                SchedulingEndpoints.nudgeBooking(owner: owner, id: bookingId, NudgeRequest(message: message))
            )
            didSend = true
        } catch let error as SchedulingError {
            errorMessage = error.userMessage ?? "Couldn't send — try again"
        } catch {
            errorMessage = "Couldn't send — try again"
        }
    }
}
