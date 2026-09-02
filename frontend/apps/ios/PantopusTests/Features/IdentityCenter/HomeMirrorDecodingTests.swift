//
//  HomeMirrorDecodingTests.swift
//  PantopusTests
//
//  The privacy mirror: a member's home as a neighbor sees it — street and
//  first name only — and the list of what is never shown.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeMirrorDecodingTests: XCTestCase {
    func testDecodesTheOutsiderProjectionAndBuildsTheAddressLine() throws {
        let json = """
        {"surface":"home","viewer":"neighbor","viewer_label":"A neighbor who is not in your household","discoverable":true,
         "home":{"id":"h1","name":"Home","address":"NW Lacamas Dr","address_redacted":true,"city":"Camas","state":"WA","zipcode":null,
                 "home_type":"house","visibility":"public_preview","description":null,"created_at":null},
         "owner":{"id":"u1","username":"yp","name":"Yingpeng","profile_picture_url":null},
         "hidden":[{"key":"house_number","label":"Your house number and unit"},{"key":"zipcode","label":"Your zip code"}]}
        """
        let mirror = try JSONDecoder().decode(HomeMirrorDTO.self, from: Data(json.utf8))
        XCTAssertEqual(mirror.addressLine, "NW Lacamas Dr · Camas, WA")
        XCTAssertTrue(mirror.home.addressRedacted)
        XCTAssertNil(mirror.home.zipcode)
        XCTAssertEqual(mirror.owner?.name, "Yingpeng")
        XCTAssertEqual(mirror.hidden.map(\.key), ["house_number", "zipcode"])
        XCTAssertTrue(mirror.discoverable)
        XCTAssertFalse(json.contains("2518"))
    }

    func testAddressLineToleratesMissingParts() throws {
        let raw = """
        {"surface":"home","viewer":"neighbor","viewer_label":"x","discoverable":false,
         "home":{"id":"h","name":null,"address":"Main St","address_redacted":true,
                 "city":null,"state":null,"zipcode":null,"visibility":null},
         "owner":null,"hidden":[]}
        """
        let mirror = try JSONDecoder().decode(HomeMirrorDTO.self, from: Data(raw.utf8))
        XCTAssertEqual(mirror.addressLine, "Main St")
        XCTAssertNil(mirror.owner)
    }
}
