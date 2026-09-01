//
//  EmergencyCardPDFTests.swift
//  PantopusTests
//
//  Covers the "Print emergency card" projection + render (P6.6):
//    - rows group by category in canonical order, pinned leads
//    - empty input → empty content → nil PDF
//    - non-empty input renders a PDF file
//

import XCTest
@testable import Pantopus

@MainActor
final class EmergencyCardPDFTests: XCTestCase {
    private func dto(
        id: String,
        type: String,
        label: String,
        pinned: Bool = false,
        detail: String = "info"
    ) -> HomeEmergencyDTO {
        var details = ["detail": detail]
        if pinned { details["pinned"] = "1" }
        return HomeEmergencyDTO(
            id: id, homeId: "h", type: type, label: label, location: nil, details: details
        )
    }

    func testContentGroupsByCategoryInOrder() {
        let emergencies = [
            dto(id: "m", type: "first_aid", label: "Allergies"),
            dto(id: "s", type: "shutoff_water", label: "Water shutoff"),
            dto(id: "c", type: "emergency_contacts", label: "Dr. Lin")
        ]
        let content = EmergencyCardPDF.content(from: emergencies, homeLabel: "412 Elm St")
        XCTAssertEqual(content.sections.map(\.heading), ["Shutoffs", "Contacts", "Medical"])
        XCTAssertEqual(content.homeLabel, "412 Elm St")
        XCTAssertFalse(content.isEmpty)
        XCTAssertEqual(content.sections.first?.items.first?.title, "Water shutoff")
    }

    func testPinnedSectionLeads() {
        let emergencies = [
            dto(id: "s", type: "shutoff_water", label: "Water shutoff"),
            dto(id: "p", type: "emergency_contacts", label: "911", pinned: true)
        ]
        let content = EmergencyCardPDF.content(from: emergencies, homeLabel: "Home")
        XCTAssertEqual(content.sections.first?.heading, "Pinned · Quick access")
    }

    func testEmptyInputRendersNilPDF() {
        let content = EmergencyCardPDF.content(from: [], homeLabel: "Home")
        XCTAssertTrue(content.isEmpty)
        XCTAssertNil(EmergencyCardPDF.render(content))
    }

    func testRenderProducesPDFFile() {
        let content = EmergencyCardPDF.content(
            from: [dto(id: "s", type: "shutoff_water", label: "Water")],
            homeLabel: "Home"
        )
        let url = EmergencyCardPDF.render(content)
        XCTAssertNotNil(url)
        if let url {
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
            XCTAssertEqual(url.pathExtension, "pdf")
        }
    }
}
