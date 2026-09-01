//
//  ProfileTabsViewModelTests.swift
//  PantopusTests
//
//  Projections behind the three public-profile tabs now mounted on
//  `PublicProfileView` — Portfolio, Gigs and (gig) Reviews.
//
//    GET /api/files/portfolio        backend/routes/files.js:489
//    GET /api/files/portfolio/:id    backend/routes/files.js:526
//    GET /api/gigs?user_id=…         backend/routes/gigs.js:2089
//    GET /api/reviews/user/:userId   backend/routes/reviews.js:149
//
//  Mirrored on Android by `ProfileTabsViewModelTest.kt`.
//

import XCTest
@testable import Pantopus

@MainActor
final class ProfileTabsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> APIClient {
        APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    // MARK: - Portfolio

    func testPortfolioLoadsSomeoneElsesPublicRouteAndProjectsCards() async {
        SequencedURLProtocol.routeResponses["/api/files/portfolio/u2"] = [
            .status(200, body: """
            {"files":[
              {"id":"f1","file_url":"https://cdn.test/a.jpg","original_filename":"a.jpg",
               "file_type":"portfolio_image","visibility":"public",
               "metadata":{"title":"Deck rebuild","description":"Two weekends",
                           "thumbnails":{"medium":"https://cdn.test/a-m.webp"}}},
              {"id":"f2","file_url":"https://cdn.test/b.mp4","original_filename":"b.mp4",
               "file_type":"portfolio_video","visibility":"public"}
            ]}
            """)
        ]

        let vm = ProfilePortfolioViewModel(userId: "u2", isOwnProfile: false, client: makeClient())
        await vm.load()

        guard case let .loaded(items) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].title, "Deck rebuild")
        XCTAssertEqual(items[0].subtitle, "Two weekends")
        XCTAssertEqual(items[0].kind, .photo)
        // The medium thumbnail drives the grid; the raw file drives the viewer.
        XCTAssertEqual(items[0].imageURL?.absoluteString, "https://cdn.test/a-m.webp")
        XCTAssertEqual(items[0].fullURL?.absoluteString, "https://cdn.test/a.jpg")
        // No metadata title → the original filename stands in.
        XCTAssertEqual(items[1].title, "b.mp4")
        XCTAssertEqual(items[1].kind, .video)

        XCTAssertFalse(vm.canEdit, "Someone else's portfolio is read-only")
        XCTAssertEqual(vm.availableFilters, [.photo, .video])
        XCTAssertEqual(vm.count(of: .photo), 1)
        XCTAssertEqual(vm.totalCount, 2)
    }

    func testPortfolioOwnProfileReadsAuthenticatedRouteAndUnlocksEditing() async {
        SequencedURLProtocol.routeResponses["/api/files/portfolio"] = [
            .status(200, body: """
            {"files":[{"id":"f9","file_url":"https://cdn.test/cv.pdf",
                       "original_filename":"cv.pdf","file_type":"resume"}]}
            """)
        ]

        let vm = ProfilePortfolioViewModel(userId: "me", isOwnProfile: true, client: makeClient())
        await vm.load()

        guard case let .loaded(items) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(items.first?.kind, .article, "resume buckets into Article")
        XCTAssertTrue(vm.canEdit, "Your own portfolio exposes add + delete")
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.last?.url?.path,
            "/api/files/portfolio",
            "Own profile must read the authenticated list route"
        )
    }

    func testPortfolioFilterNarrowsToOneKind() async {
        SequencedURLProtocol.routeResponses["/api/files/portfolio/u2"] = [
            .status(200, body: """
            {"files":[
              {"id":"f1","file_type":"portfolio_image","original_filename":"a.jpg"},
              {"id":"f2","file_type":"certification","original_filename":"cert.pdf"}
            ]}
            """)
        ]

        let vm = ProfilePortfolioViewModel(userId: "u2", isOwnProfile: false, client: makeClient())
        await vm.load()

        XCTAssertEqual(vm.filteredItems.count, 2)
        vm.activeFilter = .certificate
        XCTAssertEqual(vm.filteredItems.map(\.id), ["f2"])
    }

    func testPortfolioEmptyAndErrorStates() async {
        SequencedURLProtocol.routeResponses["/api/files/portfolio/u2"] = [
            .status(200, body: #"{"files":[]}"#)
        ]
        let empty = ProfilePortfolioViewModel(userId: "u2", isOwnProfile: false, client: makeClient())
        await empty.load()
        XCTAssertEqual(empty.state, .empty)

        SequencedURLProtocol.routeResponses["/api/files/portfolio/u3"] = [
            .status(403, body: #"{"error":"Forbidden"}"#)
        ]
        let denied = ProfilePortfolioViewModel(userId: "u3", isOwnProfile: false, client: makeClient())
        await denied.load()
        XCTAssertEqual(denied.state, .error(message: "This portfolio is private."))
    }

    func testPortfolioDeleteRefetchesAndLeavesGridUntouchedOn403() async {
        SequencedURLProtocol.routeResponses["/api/files/portfolio"] = [
            .status(200, body: """
            {"files":[{"id":"f1","file_type":"portfolio_image","original_filename":"a.jpg"}]}
            """)
        ]
        SequencedURLProtocol.routeResponses["/api/files/f1"] = [
            .status(403, body: #"{"error":"Not authorized"}"#)
        ]

        let vm = ProfilePortfolioViewModel(userId: "me", isOwnProfile: true, client: makeClient())
        await vm.load()
        vm.pendingDelete = vm.filteredItems.first
        await vm.confirmDelete()

        guard case let .loaded(items) = vm.state else {
            XCTFail("A refused delete must leave the grid loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(items.map(\.id), ["f1"], "403 must not drop the row")
        XCTAssertNotNil(vm.toastMessage)
        XCTAssertNil(vm.pendingDelete)
    }

    // MARK: - Gigs

    func testGigsProjectRowsAndPriceFormatting() async {
        SequencedURLProtocol.routeResponses["/api/gigs"] = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Move a couch","description":"Third floor walk-up",
               "price":120,"category":"moving","status":"open"},
              {"id":"g2","title":"Fix a faucet","price":45.5,"status":"completed"}
            ],"total":2}
            """)
        ]

        let vm = ProfileGigsViewModel(userId: "u2", client: makeClient())
        await vm.load()

        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.map(\.id), ["g1", "g2"])
        XCTAssertEqual(rows[0].price, "$120")
        XCTAssertEqual(rows[0].category, "moving")
        XCTAssertTrue(rows[0].isOpen)
        XCTAssertEqual(rows[1].price, "$45.50")
        XCTAssertNil(rows[1].summary, "An absent description must not render an empty line")
        XCTAssertFalse(rows[1].isOpen, "Only `open` gets the green badge")
    }

    func testGigsRequestFiltersToThePoster() async {
        SequencedURLProtocol.routeResponses["/api/gigs"] = [
            .status(200, body: #"{"gigs":[],"total":0}"#)
        ]

        let vm = ProfileGigsViewModel(userId: "u2", client: makeClient())
        await vm.load()

        XCTAssertEqual(vm.state, .empty)
        let query = SequencedURLProtocol.capturedRequests.last?.url?.query ?? ""
        XCTAssertTrue(query.contains("user_id=u2"), "Feed must be scoped to the poster, got \(query)")
        XCTAssertTrue(query.contains("limit=20"))
    }

    func testGigsErrorState() async {
        SequencedURLProtocol.routeResponses["/api/gigs"] = [
            .status(500, body: #"{"error":"Failed to fetch gigs"}"#)
        ]

        let vm = ProfileGigsViewModel(userId: "u2", client: makeClient())
        await vm.load()

        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    // MARK: - Gig reviews

    func testReviewsProjectSummaryRoleLabelsAndDistribution() async {
        SequencedURLProtocol.routeResponses["/api/reviews/user/u2"] = [
            .status(200, body: """
            {"reviews":[
              {"id":"r1","rating":5,"comment":"On time","received_as":"worker",
               "reviewer_name":"Sam Lee","reviewer_avatar":"https://cdn.test/s.png",
               "media_urls":["https://cdn.test/r1.jpg"]},
              {"id":"r2","rating":3,"comment":"Fine","received_as":"poster",
               "reviewer":{"id":"u9","username":"dana","name":"Dana Ray"}},
              {"id":"r3","rating":4,"received_as":"unknown"}
            ],"total":7,"average_rating":4.25,
             "counts":{"worker":4,"poster":2,"unknown":1}}
            """)
        ]

        let vm = ProfileGigReviewsViewModel(userId: "u2", client: makeClient())
        await vm.load()

        guard case let .loaded(summary, reviews) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // The header reads the server's totals, not the page size.
        XCTAssertEqual(summary.total, 7)
        XCTAssertEqual(summary.average, 4.25)
        XCTAssertEqual(summary.workerCount, 4)
        XCTAssertEqual(summary.posterCount, 2)
        XCTAssertEqual(vm.totalCount, 7)
        XCTAssertEqual(summary.distribution[5], 1)
        XCTAssertEqual(summary.distribution[4], 1)
        XCTAssertEqual(summary.distribution[1], 0)

        XCTAssertEqual(reviews[0].reviewerName, "Sam Lee")
        XCTAssertEqual(reviews[0].receivedAs, .worker)
        XCTAssertEqual(reviews[0].roleLabel, "Review as worker")
        XCTAssertEqual(reviews[0].mediaURLs.count, 1)
        XCTAssertEqual(reviews[1].reviewerName, "Dana Ray")
        XCTAssertEqual(reviews[1].reviewerId, "u9")
        XCTAssertEqual(reviews[1].roleLabel, "Review as gig poster")
        // `unknown` carries no role chip and belongs to neither filter.
        XCTAssertNil(reviews[2].receivedAs)
        XCTAssertNil(reviews[2].roleLabel)
        XCTAssertEqual(reviews[2].reviewerName, "Anonymous")
    }

    func testReviewsFilterSplitsByReceivedAs() async {
        SequencedURLProtocol.routeResponses["/api/reviews/user/u2"] = [
            .status(200, body: """
            {"reviews":[
              {"id":"r1","rating":5,"received_as":"worker"},
              {"id":"r2","rating":4,"received_as":"poster"},
              {"id":"r3","rating":3,"received_as":"worker"}
            ],"total":3,"average_rating":4,"counts":{"worker":2,"poster":1,"unknown":0}}
            """)
        ]

        let vm = ProfileGigReviewsViewModel(userId: "u2", client: makeClient())
        await vm.load()

        XCTAssertEqual(vm.filteredReviews.count, 3, "All is the default")
        vm.activeFilter = .worker
        XCTAssertEqual(vm.filteredReviews.map(\.id), ["r1", "r3"])
        vm.activeFilter = .poster
        XCTAssertEqual(vm.filteredReviews.map(\.id), ["r2"])
    }

    func testReviewsEmptyAndErrorStates() async {
        SequencedURLProtocol.routeResponses["/api/reviews/user/u2"] = [
            .status(200, body: #"{"reviews":[],"total":0,"average_rating":0}"#)
        ]
        let empty = ProfileGigReviewsViewModel(userId: "u2", client: makeClient())
        await empty.load()
        XCTAssertEqual(empty.state, .empty)

        SequencedURLProtocol.routeResponses["/api/reviews/user/u3"] = [
            .status(500, body: #"{"error":"Failed to fetch reviews"}"#)
        ]
        let failed = ProfileGigReviewsViewModel(userId: "u3", client: makeClient())
        await failed.load()
        guard case .error = failed.state else {
            XCTFail("Expected .error, got \(failed.state)")
            return
        }
    }

    // MARK: - Endpoints

    func testEndpointsMatchTheMountedRoutes() {
        XCTAssertEqual(ProfileTabsEndpoints.myPortfolio().path, "/api/files/portfolio")
        XCTAssertEqual(ProfileTabsEndpoints.portfolio(userId: "u2").path, "/api/files/portfolio/u2")
        XCTAssertEqual(ProfileTabsEndpoints.deleteFile(id: "f1").path, "/api/files/f1")
        XCTAssertEqual(ProfileTabsEndpoints.userGigs(userId: "u2").query["user_id"], "u2")
        XCTAssertEqual(ProfileTabsEndpoints.userReviews(userId: "u2").path, "/api/reviews/user/u2")
    }

    // MARK: - Tab strip

    func testProfileTabStripCarriesPortfolio() {
        XCTAssertEqual(ProfileTab.allCases, [.about, .reviews, .gigs, .portfolio])
        XCTAssertEqual(ProfileTab.portfolio.label, "Portfolio")
        XCTAssertEqual(
            LocalProfileTab.allCases,
            [.posts, .about, .portfolio, .gigs, .reviews]
        )
    }
}
