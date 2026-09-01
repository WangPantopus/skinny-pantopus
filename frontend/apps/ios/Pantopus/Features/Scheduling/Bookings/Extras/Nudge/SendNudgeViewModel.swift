//
//  SendNudgeViewModel.swift
//  Pantopus
//
//  Stream I9 — E11 Send a Nudge / Manual Follow-up. A one-off message to a
//  booking's attendees via `POST /bookings/:id/nudge { message }`. Audience
//  chips + recipient counts are caller-supplied (the roster knows the
//  confirmed/no-show split); the backend nudge targets the booking's invitees.
//  "Use a template" reads `GET /message-templates` (read-only — authoring lives
//  in I16).
//

import Observation
import SwiftUI

enum NudgeAudience: String, CaseIterable, Identifiable {
    case all, confirmed, noShows
    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .all: "All attendees"
        case .confirmed: "Confirmed only"
        case .noShows: "No-shows"
        }
    }
}

/// Recipient counts per audience, supplied by the presenting screen.
struct NudgeAudienceCounts: Equatable {
    var all: Int
    var confirmed: Int
    var noShows: Int

    func count(for audience: NudgeAudience) -> Int {
        switch audience {
        case .all: all
        case .confirmed: confirmed
        case .noShows: noShows
        }
    }
}

@Observable
@MainActor
final class SendNudgeViewModel {
    let owner: SchedulingOwner
    let bookingId: String
    let eventTitle: String
    let eventSubtitle: String
    let counts: NudgeAudienceCounts

    let characterLimit = 280

    var message: String = ""
    var audience: NudgeAudience = .all
    var pushOn = true
    var emailOn = false

    private(set) var isSending = false
    private(set) var didSend = false
    /// Recipient count captured at send time, for the sent-confirmation toast.
    private(set) var sentCount = 0
    var errorMessage: String?

    private(set) var templates: [MessageTemplateDTO] = []
    var isTemplatePickerPresented = false

    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        bookingId: String,
        eventTitle: String,
        eventSubtitle: String,
        counts: NudgeAudienceCounts,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.bookingId = bookingId
        self.eventTitle = eventTitle
        self.eventSubtitle = eventSubtitle
        self.counts = counts
        self.client = client
    }

    var recipientCount: Int {
        counts.count(for: audience)
    }

    var isOverLimit: Bool {
        message.count > characterLimit
    }

    var hasRecipients: Bool {
        recipientCount > 0
    }

    var canSend: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isOverLimit
            && hasRecipients
            && !isSending
    }

    var ctaTitle: String {
        hasRecipients ? "Send to \(recipientCount)" : "Send"
    }

    /// Dark-toast confirmation copy shown after a successful send,
    /// e.g. "Update sent to 12 attendees".
    var sentConfirmation: String {
        "Update sent to \(sentCount) attendee\(sentCount == 1 ? "" : "s")"
    }

    func select(_ audience: NudgeAudience) {
        self.audience = audience
    }

    func presentTemplatePicker() async {
        if templates.isEmpty {
            templates = await (try? loadTemplates()) ?? []
        }
        isTemplatePickerPresented = true
    }

    private func loadTemplates() async throws -> [MessageTemplateDTO] {
        let response: MessageTemplatesResponse = try await client.request(
            SchedulingEndpoints.getMessageTemplates(owner: owner)
        )
        return response.templates
    }

    func apply(_ template: MessageTemplateDTO) {
        message = template.body
    }

    func send() async {
        guard canSend else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let _: SchedulingOkResponse = try await client.request(
                SchedulingEndpoints.nudgeBooking(owner: owner, id: bookingId, NudgeRequest(message: message))
            )
            sentCount = recipientCount
            didSend = true
        } catch let error as SchedulingError {
            errorMessage = error.userMessage ?? "Couldn't send — try again"
        } catch {
            errorMessage = "Couldn't send — try again"
        }
    }
}
