//
//  ListingComposeWizardViewModelTestCase.swift
//  PantopusTests
//
//  Shared fixtures for listing-compose wizard view model tests.
//

import XCTest
@testable import Pantopus

@MainActor
class ListingComposeWizardViewModelTestCase: XCTestCase {
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

    func makeUploader() -> MultipartUploader {
        MultipartUploader(
            environment: .current,
            session: SequencedURLProtocol.makeSession()
        )
    }

    func makeVM(initialState: ListingComposeFormState = .empty) -> ListingComposeWizardViewModel {
        ListingComposeWizardViewModel(
            api: makeAPI(),
            uploader: makeUploader(),
            initialState: initialState
        ) { true }
    }

    func makeEditVM(
        listingId: String = "listing_42",
        jumpToStep: ListingComposeStep? = nil,
        initialState: ListingComposeFormState = .empty
    ) -> ListingComposeWizardViewModel {
        ListingComposeWizardViewModel(
            mode: .edit(listingId: listingId, jumpToStep: jumpToStep),
            api: makeAPI(),
            uploader: makeUploader(),
            initialState: initialState
        ) { true }
    }

    /// Tiny stand-in for processed JPEG bytes — the VM only base64s
    /// whatever the photo step hands it.
    static let fakeJPEG = Data([0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02, 0x03])

    /// Detail-fetch payload used by the edit-prefill tests. Mirrors the
    /// `GET /api/listings/:id` envelope returned by
    /// `backend/routes/listings.js:1375`.
    static let editListingDetailJSON = """
    {"listing":{
      "id":"listing_42",
      "user_id":"user_seller",
      "title":"Mid-century walnut credenza",
      "description":"Solid walnut, four sliding doors, dovetail joinery.",
      "price":420,
      "is_free":false,
      "category":"furniture",
      "condition":"like_new",
      "media_urls":["https://example.com/a.jpg","https://example.com/b.jpg"],
      "first_image":"https://example.com/a.jpg",
      "layer":"goods",
      "listing_type":"sell_item",
      "location_name":"Lincoln Park bandshell",
      "status":"active"
    }}
    """

    static let updateListingJSON = """
    {"message":"Listing updated successfully","listing":{
      "id":"listing_42",
      "title":"Mid-century walnut credenza",
      "is_free":false,
      "price":399,
      "category":"furniture",
      "layer":"goods",
      "listing_type":"sell_item",
      "status":"active"
    }}
    """

    static let createListingJSON = """
    {"message":"Listing created successfully","listing":{
      "id":"listing_42",
      "title":"Moving boxes — bundle of 18",
      "is_free":false,
      "price":25,
      "category":"other",
      "layer":"goods",
      "listing_type":"sell_item",
      "status":"active"
    }}
    """

    /// `POST /api/ai/draft/listing-vision` envelope
    /// (`backend/routes/ai.js:199`) — the Snap & Sell draft + comp
    /// range used by the camera-entry tests.
    static let visionDraftJSON = """
    {"draft":{
      "title":"Sage green velvet sofa",
      "description":"Comfortable three-seat velvet sofa with light wear on one cushion and minor sun fade.",
      "price":260,
      "isFree":false,
      "category":"furniture",
      "condition":"good",
      "tags":["sofa","velvet"],
      "listingType":"sell_item",
      "deliveryAvailable":true,
      "meetupPreference":"public_meetup"
    },
    "confidence":0.85,
    "priceSuggestion":{"low":180,"median":280,"high":420,"basis":"47 similar items in your area","comparable_count":47}}
    """

    /// `POST /api/upload/listing-media/:id` envelope
    /// (`backend/routes/upload.js:1049`).
    static let listingMediaUploadJSON = """
    {"message":"Media uploaded","media_urls":["https://example.com/u1.jpg"],"media_types":["image"]}
    """

    func readyToSubmit() -> ListingComposeFormState {
        ListingComposeFormState(
            step: ListingComposeStep.review.rawValue,
            photos: [
                ListingComposePhoto(token: "photo_1"),
                ListingComposePhoto(token: "photo_2")
            ],
            title: "Moving boxes — bundle of 18",
            category: .goods,
            condition: .likeNew,
            bodyText: "Lightly used, perfect for a one-bedroom move across town.",
            priceKind: .fixed,
            priceAmount: "25",
            fulfillment: .pickup,
            locationKind: .savedAddress,
            locationLabel: ""
        )
    }
}
