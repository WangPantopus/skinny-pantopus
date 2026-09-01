//
//  ListingOffersViewModelTestCase.swift
//  PantopusTests
//
//  Shared fixtures for listing-offers view model tests.
//

import XCTest
@testable import Pantopus

@MainActor
class ListingOffersViewModelTestCase: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    /// 2026-05-15 12:00:00 UTC — Friday. Fixed so age-in-days reads
    /// deterministically.
    static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    func makeVM(
        api: APIClient? = nil,
        checkout: CheckoutCoordinator = CheckoutCoordinator(),
        currentUserId: @escaping @MainActor () -> String? = { nil }
    ) -> ListingOffersViewModel {
        ListingOffersViewModel(
            listingId: "listing-1",
            listingTitleHint: "Mid-century walnut credenza",
            api: api ?? makeAPI(),
            currentUserId: currentUserId,
            checkout: checkout
        ) {
            Self.fixedNow
        }
    }

    static let listingJSON = """
    {"listing":{
      "id":"listing-1","user_id":"u_me","title":"Mid-century walnut credenza",
      "price":250,"is_free":false,"category":"furniture","status":"active",
      "media_urls":[],"first_image":null,"layer":"goods",
      "created_at":"2026-05-11T12:00:00Z"
    }}
    """

    /// Three offers: $240 pending (leading), $225 countered, $200
    /// declined. Buyers in three different name shapes to exercise the
    /// `displayName` fallback chain.
    static let threeOffersJSON = """
    {"offers":[
      {"id":"o-anika","listing_id":"listing-1","buyer_id":"u_anika",
       "seller_id":"u_me","amount":240,"message":"Love the dovetail joinery.",
       "status":"pending","counter_amount":null,
       "created_at":"2026-05-15T11:48:00Z",
       "buyer":{"id":"u_anika","first_name":"Anika","last_name":"Reyes",
                "username":"anika"},
       "seller":{"id":"u_me","first_name":"Me","last_name":"Seller"}},
      {"id":"o-marcus","listing_id":"listing-1","buyer_id":"u_marcus",
       "seller_id":"u_me","amount":225,"message":null,
       "status":"countered","counter_amount":235,
       "created_at":"2026-05-13T12:00:00Z",
       "buyer":{"id":"u_marcus","first_name":"Marcus","last_name":"Tate",
                "username":"marcus_t"},
       "seller":{"id":"u_me"}},
      {"id":"o-daniel","listing_id":"listing-1","buyer_id":"u_daniel",
       "seller_id":"u_me","amount":175,"message":null,
       "status":"declined","counter_amount":null,
       "created_at":"2026-05-12T12:00:00Z",
       "buyer":{"id":"u_daniel","username":"dan_k"},
       "seller":{"id":"u_me"}}
    ]}
    """

    static let oneAcceptedJSON = """
    {"offers":[
      {"id":"o-anika","listing_id":"listing-1","buyer_id":"u_anika",
       "seller_id":"u_me","amount":240,"message":null,
       "status":"accepted","counter_amount":null,
       "created_at":"2026-05-15T11:48:00Z",
       "buyer":{"id":"u_anika","first_name":"Anika","last_name":"Reyes"},
       "seller":{"id":"u_me"}}
    ]}
    """

    static let emptyOffersJSON = "{\"offers\":[]}"

    static let intentJSON = """
    {"clientSecret":"pi_secret_1","paymentIntentId":"pi_1","customer":"cus_1",\
    "ephemeralKey":"ek_1","publishableKey":"pk_test"}
    """

    /// Three pending offers with amount and recency deliberately crossed
    /// so every sort yields a distinct order:
    ///   - o-low-new : $100, newest (05-15)
    ///   - o-mid-old : $200, oldest (05-10)
    ///   - o-high-mid: $300, middle (05-13) — top offer, wins LEADING
    static let sortFixtureJSON = """
    {"offers":[
      {"id":"o-low-new","listing_id":"listing-1","buyer_id":"u_low",
       "seller_id":"u_me","amount":100,"status":"pending",
       "created_at":"2026-05-15T10:00:00Z",
       "buyer":{"id":"u_low","first_name":"Lena","last_name":"New"}},
      {"id":"o-mid-old","listing_id":"listing-1","buyer_id":"u_mid",
       "seller_id":"u_me","amount":200,"status":"pending",
       "created_at":"2026-05-10T10:00:00Z",
       "buyer":{"id":"u_mid","first_name":"Milo","last_name":"Old"}},
      {"id":"o-high-mid","listing_id":"listing-1","buyer_id":"u_high",
       "seller_id":"u_me","amount":300,"status":"pending",
       "created_at":"2026-05-13T10:00:00Z",
       "buyer":{"id":"u_high","first_name":"Hana","last_name":"Mid"}}
    ]}
    """

    func loadedRowIDs(_ vm: ListingOffersViewModel) -> [String] {
        guard case let .loaded(sections, _) = vm.state else { return [] }
        return sections.first?.rows.map(\.id) ?? []
    }
}
