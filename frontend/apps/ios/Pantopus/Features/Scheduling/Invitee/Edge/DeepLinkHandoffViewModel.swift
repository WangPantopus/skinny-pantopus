//
//  DeepLinkHandoffViewModel.swift
//  Pantopus
//
//  D9 Open-in-App / Deep-Link Hand-off (Stream I7). The interstitial an invitee
//  hits when a booking link resolves: it loads the booking by manage token
//  (`GET /api/public/booking/:token`), then offers "Continue in app" (push the
//  manage surface) vs "Stay on web" (open the public page). The inbound deep-link
//  seam is `Core/Routing/DeepLinkRouter` (consumed READ-ONLY). Tokens only.
//

import SwiftUI

@Observable
@MainActor
final class DeepLinkHandoffViewModel {
    enum State: Equatable {
        case resolving
        case resolved(ManageBookingResponse)
        case failed(message: String)
    }

    let token: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .resolving
    private var didLoad = false
    private var isFetching = false

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.token = token
        self.push = push
        self.client = client
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func retry() async {
        await fetch()
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .resolving
        do {
            let response: ManageBookingResponse = try await client.request(
                SchedulingPublicEndpoints.manage(token: token)
            )
            state = .resolved(response)
        } catch let error as SchedulingError {
            state = .failed(message: error.userMessage ?? "We couldn't open this booking.")
        } catch {
            state = .failed(message: "We couldn't open this booking.")
        }
    }

    // MARK: - Hand-off actions

    /// Continue inside the app: push the Foundation-routed manage surface (D4).
    /// The inbound `pantopus://` seam lives in `DeepLinkRouter`; an in-app
    /// hand-off pushes directly so the invitee keeps their tz + details.
    func continueInApp() {
        push(.inviteeManageBooking(token: token))
    }

    /// The public web page for this booking (the "stay on web" / "continue on
    /// the web" target).
    var webURL: URL? {
        URL(string: "https://pantopus.com/booking/\(token)")
    }

    // MARK: - Presentation helpers

    func tz(_ response: ManageBookingResponse) -> String {
        response.booking.inviteeTimezone
            ?? response.page?.timezone
            ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    func hostName(_ response: ManageBookingResponse) -> String? {
        response.page?.title
    }
}

#if DEBUG
extension DeepLinkHandoffViewModel {
    static func previewResolved() -> DeepLinkHandoffViewModel {
        let viewModel = DeepLinkHandoffViewModel(token: "tok", push: { _ in }, client: .shared)
        let json = #"""
        {
          "booking": {"id":"b1","status":"confirmed",
            "start_at":"2026-06-17T16:30:00Z","end_at":"2026-06-17T17:00:00Z",
            "invitee_name":"Maya Chen","invitee_timezone":"America/Los_Angeles","location_mode":"video"},
          "actions": {"can_cancel":true,"can_reschedule":true},
          "eventType": {"id":"et1","name":"Consultation","default_duration":30,"price_cents":12000,"currency":"usd"},
          "page": {"slug":"dr-lee","title":"Dr. Lee","owner_type":"user","timezone":"America/Los_Angeles"}
        }
        """#
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(ManageBookingResponse.self, from: data) {
            viewModel.state = .resolved(response)
        }
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
