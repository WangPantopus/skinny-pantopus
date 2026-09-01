//
//  BookingsPreviewData.swift
//  Pantopus
//
//  Stream I8 — DEBUG-only fixture factories. The booking DTOs are `Decodable`
//  only (no memberwise init), so previews/tests build them by decoding JSON.
//

#if DEBUG
import Foundation

extension BookingDTO {
    /// A decoded fixture booking for `#Preview` and view-model seeding.
    static func preview(
        id: String = "bk_preview",
        status: String = "confirmed",
        ownerType: String = "user",
        invitee: String = "Dana Whitfield",
        start: String = "2030-06-18T21:00:00Z",
        end: String = "2030-06-18T21:30:00Z",
        eventTypeId: String? = "et1",
        paymentId: String? = nil,
        hostUserId: String? = nil,
        refundIssued: Bool? = nil
    ) -> BookingDTO {
        let json = """
        {
          "id": "\(id)",
          "owner_type": "\(ownerType)",
          "event_type_id": \(eventTypeId.map { "\"\($0)\"" } ?? "null"),
          "status": "\(status)",
          "start_at": "\(start)",
          "end_at": "\(end)",
          "invitee_name": "\(invitee)",
          "invitee_email": "guest@example.com",
          "invitee_timezone": "America/Los_Angeles",
          "host_user_id": \(hostUserId.map { "\"\($0)\"" } ?? "null"),
          "payment_id": \(paymentId.map { "\"\($0)\"" } ?? "null"),
          "refund_issued": \(refundIssued.map { String($0) } ?? "null"),
          "intake_answers": {"What's this about?": "Quick intro", "Phone": "555-0100"},
          "created_at": "2030-06-12T16:04:00Z"
        }
        """
        // Force-unwrap is acceptable in DEBUG-only fixture code.
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(BookingDTO.self, from: Data(json.utf8))
    }
}

extension BookingDetailResponse {
    static func preview(
        status: String = "confirmed",
        ownerType: String = "user",
        eventName: String = "30-min intro call",
        locationMode: String = "video",
        paymentId: String? = nil
    ) -> BookingDetailResponse {
        let booking = BookingDTO.preview(status: status, ownerType: ownerType, paymentId: paymentId)
        let json = """
        {
          "booking": {
            "id": "\(booking.id)", "owner_type": "\(ownerType)", "event_type_id": "et1",
            "status": "\(status)", "start_at": "\(booking.startAt ?? "")", "end_at": "\(booking.endAt ?? "")",
            "invitee_name": "Dana Whitfield", "invitee_email": "guest@example.com",
            "invitee_timezone": "America/Los_Angeles",
            "payment_id": \(paymentId.map { "\"\($0)\"" } ?? "null"),
            "intake_answers": {"What's this about?": "Quick intro", "Phone": "555-0100", "Budget": "Flexible"},
            "created_at": "2030-06-12T16:04:00Z"
          },
          "attendees": [
            {"id": "a1", "name": "Dana Whitfield", "email": "guest@example.com", "rsvp_status": "going"}
          ],
          "eventType": {"id": "et1", "name": "\(eventName)", "location_mode": "\(locationMode)"}
        }
        """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(BookingDetailResponse.self, from: Data(json.utf8))
    }
}
#endif
