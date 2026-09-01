//
//  WaitlistJoinViewModel.swift
//  Pantopus
//
//  Stream I9 — E13 Waitlist (invitee join surface). An invitee joins a full
//  event type's waitlist via the public `POST /book/:slug/:eventTypeSlug/
//  waitlist`. Design (Frame 1) collects a MOBILE / phone number and notifies
//  by text/SMS. The backend DTO field is named `email` (backend gap — the
//  field name does not yet reflect the SMS intent); we pass the phone value
//  there until the backend renames the field. The API returns no queue position
//  and offers no "leave" endpoint (backend gaps — the UI reflects what the API
//  supports). A 409 `ALREADY_ON_WAITLIST` response sets `alreadyJoined` so the
//  sheet renders Frame 3 rather than an error.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class WaitlistJoinViewModel {
    let slug: String
    let eventTypeSlug: String
    let windowLabel: String
    let timeZoneLabel: String

    var name = ""
    /// Phone/mobile number collected for SMS notification. Passed as the `email`
    /// field in `WaitlistJoinRequest` because the backend DTO hasn't been renamed
    /// yet to match the SMS-notification intent.
    var phone = ""
    var preferredTime = ""

    private(set) var isJoining = false
    private(set) var didJoin = false
    /// Set when the backend returns 409 ALREADY_ON_WAITLIST. The sheet shows
    /// Frame 3 ("You're already waiting") rather than an error strip.
    private(set) var alreadyJoined = false
    /// ISO-8601 join date returned by the backend when alreadyJoined is true.
    /// Nil when the backend omits it; the sheet omits the date from the subtitle
    /// in that case.
    private(set) var joinedAt: String?
    var errorMessage: String?

    private let client: SchedulingClient

    init(
        slug: String,
        eventTypeSlug: String,
        windowLabel: String,
        timeZoneLabel: String,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.windowLabel = windowLabel
        self.timeZoneLabel = timeZoneLabel
        self.client = client
    }

    var canJoin: Bool {
        !phone.trimmingCharacters(in: .whitespaces).isEmpty && !isJoining
    }

    func join() async {
        guard canJoin else { return }
        isJoining = true
        errorMessage = nil
        defer { isJoining = false }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let _: WaitlistJoinResponse = try await client.request(
                SchedulingPublicEndpoints.joinWaitlist(
                    slug: slug,
                    eventTypeSlug: eventTypeSlug,
                    WaitlistJoinRequest(
                        // Backend DTO field is named `email`; we pass the phone
                        // value here until the backend renames it.
                        email: phone.trimmingCharacters(in: .whitespaces),
                        name: trimmedName.isEmpty ? nil : trimmedName
                    )
                )
            )
            didJoin = true
        } catch let error as SchedulingError {
            // 409 ALREADY_ON_WAITLIST → show Frame 3 instead of an error strip.
            if case let .conflict(code, _) = error, code == "ALREADY_ON_WAITLIST" {
                alreadyJoined = true
            } else {
                errorMessage = error.userMessage ?? "Couldn't join the waitlist — try again"
            }
        } catch {
            errorMessage = "Couldn't join the waitlist — try again"
        }
    }
}
