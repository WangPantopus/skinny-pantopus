import XCTest
import SwiftUI
@testable import Pantopus

final class AddressCalendarContractTests: XCTestCase {
    @MainActor
    func testCalendarFormRendersAtPhoneWidth() throws {
        let json = #"""
        {"upcoming":[],"next":null,"needs_pickup_day":true,"window_days":14,"rule_count":2,"today":"2026-09-03",
         "pickup_schedule":{"weekday":"TH","recycling_frequency":"biweekly","recycling_next_date":"2026-09-11"}}
        """#
        let data = try JSONDecoder().decode(PlaceAddressCalendarData.self, from: Data(json.utf8))
        let controller = UIHostingController(rootView: AddressCalendarCard(homeId: "calendar-test", data: data) {}.padding(16))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = controller
        window.makeKeyAndVisible()
        controller.view.frame = window.bounds
        controller.view.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(size: window.bounds.size).image { _ in
            controller.view.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
        let attachment = XCTAttachment(image: image)
        attachment.name = "calendar-form-phone"
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertEqual(image.size.width, 390)
        window.isHidden = true
    }

    func testExplicitRecyclingDateIsEncodedWithoutLegacyGuess() throws {
        let request = SetPickupDayRequest(weekday: "TH", recyclingFrequency: "biweekly", recyclingNextDate: "2026-09-11")
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: String])
        XCTAssertEqual(json, ["weekday": "TH", "recycling_frequency": "biweekly", "recycling_next_date": "2026-09-11"])
    }

    func testUnknownRecyclingOmitsTheDate() throws {
        let json = try XCTUnwrap(JSONSerialization
            .jsonObject(with: JSONEncoder().encode(SetPickupDayRequest(weekday: "TH"))) as? [String: String])
        XCTAssertEqual(json, ["weekday": "TH", "recycling_frequency": "not_set"])
    }

    func testReadsSavedScheduleAndRemainsCompatibleWithOlderCalendarResponses() throws {
        let base = #"{"upcoming":[],"next":null,"needs_pickup_day":false,"window_days":14,"rule_count":2,"today":"2026-09-03"}"#
        let legacy = try JSONDecoder().decode(PlaceAddressCalendarData.self, from: Data(base.utf8))
        XCTAssertNil(legacy.pickupSchedule)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(base.utf8)) as? [String: Any])
        json["pickup_schedule"] = ["weekday": "TH", "recycling_frequency": "biweekly", "recycling_next_date": "2026-09-11"]
        let current = try JSONDecoder().decode(PlaceAddressCalendarData.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertEqual(current.pickupSchedule?.weekday, "TH")
        XCTAssertEqual(current.pickupSchedule?.recyclingNextDate, "2026-09-11")
    }
}
