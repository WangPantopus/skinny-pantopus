//
//  BookingPageSampleData.swift
//  Pantopus
//
//  Decoded JSON fixtures for SwiftUI previews of the I4 Booking-page screens.
//  The Scheduling DTOs are Decodable-only (no memberwise init), so fixtures
//  round-trip through the same shapes the backend returns. Not used in
//  production code paths.
//

import Foundation

#if DEBUG
enum BookingPageSampleData {
    private static let decoder = JSONDecoder()

    private static func decode<T: Decodable>(_: T.Type, _ json: String) -> T {
        // swiftlint:disable:next force_try
        try! decoder.decode(T.self, from: Data(json.utf8))
    }

    static let livePage: BookingPageDTO = decode(
        BookingPageDTO.self,
        #"""
        {
          "id": "page_1",
          "owner_type": "user",
          "owner_id": null,
          "slug": "maria-k",
          "is_live": true,
          "is_paused": false,
          "title": "Maria Kassulke",
          "tagline": "Product coach · book a slot",
          "avatar_url": null,
          "intro": "Pick a time that works and I'll send a calendar invite.",
          "confirmation_message": "See you then! I'll email a video link.",
          "timezone": "America/New_York",
          "reminder_minutes": [1440, 60],
          "visibility": "listed",
          "created_at": "2026-01-04T12:00:00Z",
          "updated_at": "2026-06-01T12:00:00Z"
        }
        """#
    )

    static let eventTypes: [EventTypeDTO] = decode(
        EventTypesResponse.self,
        #"""
        {
          "eventTypes": [
            {"id":"et_1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,
             "location_mode":"video","visibility":"public","is_active":true},
            {"id":"et_2","name":"Deep-dive session","slug":"deep-dive","durations":[60],"default_duration":60,
             "location_mode":"phone","visibility":"public","is_active":true},
            {"id":"et_3","name":"Quick question","slug":"quick","durations":[15],"default_duration":15,
             "location_mode":"video","visibility":"secret","is_active":true}
          ]
        }
        """#
    ).eventTypes

    static let publicView: PublicBookView = decode(
        PublicBookView.self,
        #"""
        {
          "page": {
            "slug": "maria-k", "title": "Maria Kassulke", "tagline": "Product coach · book a slot",
            "avatar_url": null, "intro": "Pick a time that works and I'll send a calendar invite.",
            "timezone": "America/New_York", "owner_type": "user"
          },
          "status": "active",
          "eventTypes": [
            {"id":"et_1","name":"Intro call","slug":"intro","description":"A quick hello.","durations":[30],
             "default_duration":30,"location_mode":"video"},
            {"id":"et_2","name":"Deep-dive session","slug":"deep-dive","durations":[60],"default_duration":60,
             "location_mode":"phone"}
          ]
        }
        """#
    )

    static let pausedPublicView: PublicBookView = decode(
        PublicBookView.self,
        #"""
        {
          "page": {"slug":"maria-k","title":"Maria Kassulke","tagline":"Product coach","timezone":"America/New_York","owner_type":"user"},
          "status": "paused",
          "eventTypes": []
        }
        """#
    )

    static let emptyPublicView: PublicBookView = decode(
        PublicBookView.self,
        #"""
        {
          "page": {"slug":"maria-k","title":"Maria Kassulke","tagline":"Product coach","timezone":"America/New_York","owner_type":"user"},
          "status": "active",
          "eventTypes": []
        }
        """#
    )
}
#endif
