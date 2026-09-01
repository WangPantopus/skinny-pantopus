//
//  BusinessServiceAreaDTOTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

final class BusinessServiceAreaDTOTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testDecodesLegacyString() throws {
        let json = #""Serves Cambridge & Somerville""#
        let dto = try decoder.decode(BusinessServiceAreaDTO.self, from: Data(json.utf8))
        XCTAssertEqual(dto.displayText, "Serves Cambridge & Somerville")
    }

    func testDecodesStructuredObject() throws {
        let json = """
        {"city":"Cambridge","state":"MA","radius_miles":25,"center_lat":42.37,"center_lng":-71.11}
        """
        let dto = try decoder.decode(BusinessServiceAreaDTO.self, from: Data(json.utf8))
        XCTAssertEqual(dto.displayText, "Cambridge, MA — within 25 mi")
        XCTAssertEqual(dto.centerLat, 42.37)
    }

    func testDecodesEmptyObjectAsNilDisplayText() throws {
        let json = "{}"
        let dto = try decoder.decode(BusinessServiceAreaDTO.self, from: Data(json.utf8))
        XCTAssertNil(dto.displayText)
    }

    func testBusinessDetailResponseDecodesObjectServiceArea() throws {
        let json = """
        {
          "business": {
            "id": "biz-1",
            "username": "test-biz",
            "name": "Test Biz",
            "account_type": "business"
          },
          "profile": {
            "business_user_id": "biz-1",
            "service_area": {
              "radius_miles": 25,
              "center_lat": 42.37,
              "center_lng": -71.11
            }
          },
          "locations": [
            {
              "id": "loc-1",
              "is_primary": true,
              "city": "Cambridge",
              "state": "MA",
              "location": { "lat": 42.37, "lng": -71.11 }
            }
          ]
        }
        """
        let response = try decoder.decode(BusinessDetailResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.profile?.serviceArea?.displayText, "within 25 mi")
        XCTAssertEqual(response.locations.first?.location?.lat, 42.37)
    }
}
