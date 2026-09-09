import XCTest
@testable import Pantopus

final class HomeDocumentEntryTests: XCTestCase {
    func testDocumentsEntryRequiresConfirmedReadAccess() {
        let cases: [(HomeAccessDTO?, Bool)] = [
            (nil, false),
            (HomeAccessDTO(hasAccess: true), false),
            (HomeAccessDTO(hasAccess: false, permissions: ["docs.view"]), false),
            (HomeAccessDTO(hasAccess: true, permissions: ["docs.upload"]), false),
            (HomeAccessDTO(hasAccess: true, permissions: ["docs.view"]), true),
            (HomeAccessDTO(hasAccess: true, isOwner: true), true)
        ]
        for (access, expected) in cases {
            let tiles = HomeDashboardProjection.quickActions(
                counts: HomeDashboardCountsDTO(documents: 2), access: access
            )
            let tile = tiles.first { $0.id == "view_docs" }
            XCTAssertEqual(tile != nil, expected)
            if expected { XCTAssertEqual(tile?.badge, "2") }
        }
    }
}
