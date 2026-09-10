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
            (HomeAccessDTO(hasAccess: true, isOwner: true), false),
            (HomeAccessDTO(hasAccess: true, isOwner: true, permissions: ["docs.view"]), true)
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

    func testMissingAccessAndRecordedRolesDoNotGrantActions() {
        let cases: [HomeAccessDTO?] = [
            nil,
            HomeAccessDTO(hasAccess: true),
            HomeAccessDTO(hasAccess: true, isOwner: true, roleBase: "owner"),
            HomeAccessDTO(hasAccess: true, roleBase: "admin"),
            HomeAccessDTO(hasAccess: false, permissions: ["finance.view", "members.manage"])
        ]
        for access in cases {
            XCTAssertEqual(HomeDashboardProjection.gatedTabs(access: access).map(\.id), ["overview"])
            XCTAssertTrue(HomeDashboardProjection.quickActions(counts: nil, access: access).isEmpty)
            XCTAssertFalse(access?.canManageMembers ?? false)
        }
    }

    func testFinanceViewerCanOpenBillsWithoutMutationRights() {
        let access = HomeAccessDTO(hasAccess: true, permissions: ["finance.view"])
        XCTAssertEqual(HomeDashboardProjection.gatedTabs(access: access).map(\.id), ["overview", "bills"])
        XCTAssertEqual(HomeDashboardProjection.quickActions(counts: nil, access: access).map(\.id), ["view_bills"])
        XCTAssertFalse(access.can("finance.manage"))
    }

    func testPackageNavigationRequiresPackageReadNotMailboxRead() {
        let mailbox = HomeAccessDTO(hasAccess: true, permissions: ["mailbox.view"])
        XCTAssertTrue(HomeDashboardProjection.quickActions(counts: nil, access: mailbox).isEmpty)
        let packages = HomeAccessDTO(hasAccess: true, permissions: ["packages.view"])
        XCTAssertEqual(HomeDashboardProjection.quickActions(counts: nil, access: packages).map(\.id), ["view_packages"])
    }

    func testMemberViewingAndManagementRemainSeparate() {
        let viewer = HomeAccessDTO(hasAccess: true, permissions: ["members.view"])
        XCTAssertFalse(viewer.canManageMembers)
        XCTAssertEqual(HomeDashboardProjection.quickActions(counts: nil, access: viewer).map(\.id), ["add_member"])
        XCTAssertTrue(HomeAccessDTO(hasAccess: true, permissions: ["members.manage"]).canManageMembers)
    }
}
