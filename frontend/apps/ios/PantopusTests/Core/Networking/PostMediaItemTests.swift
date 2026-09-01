//
//  PostMediaItemTests.swift
//  PantopusTests
//
//  Resolves the backend's parallel media arrays into typed attachments.
//  Every post surface (Pulse feed, post detail, Beacon profile, broadcast
//  detail) funnels through `PostMediaItem.items`, and all three of its
//  branches — index-aligned clips, the cursor walk over a compacted
//  `media_live_urls`, and the live_photo-without-clip downgrade — decide
//  whether a tile gets the LIVE dot and long-press playback.
//

import XCTest
@testable import Pantopus

final class PostMediaItemTests: XCTestCase {
    // MARK: - Aligned arrays

    func testAlignedArraysResolveKindsAndThumbnails() {
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.mp4"],
            types: ["image", "video"],
            thumbnails: ["https://cdn.example.com/a-thumb.jpg", "https://cdn.example.com/b-poster.jpg"],
            liveURLs: ["", ""]
        )
        XCTAssertEqual(items.map(\.kind), [.image, .video])
        XCTAssertEqual(items[0].thumbnailURL?.absoluteString, "https://cdn.example.com/a-thumb.jpg")
        XCTAssertEqual(items[1].thumbnailURL?.absoluteString, "https://cdn.example.com/b-poster.jpg")
        XCTAssertTrue(items.allSatisfy { $0.liveVideoURL == nil })
    }

    func testAlignedLiveURLsAttachByIndex() {
        // media_live_urls.count == media_urls.count → straight index lookup,
        // and the "" padding on the non-live slot stays unattached.
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/still0.jpg", "https://cdn.example.com/still1.jpg"],
            types: ["image", "live_photo"],
            thumbnails: ["", "https://cdn.example.com/thumb1.jpg"],
            liveURLs: ["", "https://cdn.example.com/clip1.mov"]
        )
        XCTAssertEqual(items.map(\.kind), [.image, .livePhoto])
        XCTAssertNil(items[0].liveVideoURL)
        XCTAssertEqual(items[1].liveVideoURL?.absoluteString, "https://cdn.example.com/clip1.mov")
        // A blank thumbnail slot is "no value", not a URL of "".
        XCTAssertNil(items[0].thumbnailURL)
    }

    func testThumbnailsOfMismatchedLengthAreIgnoredWholesale() {
        // A short media_thumbnails can't be trusted to describe slot i, so
        // the resolver drops the whole array rather than mis-pairing it.
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
            types: ["image", "image"],
            thumbnails: ["https://cdn.example.com/a-thumb.jpg"],
            liveURLs: []
        )
        XCTAssertEqual(items.count, 2)
        XCTAssertTrue(items.allSatisfy { $0.thumbnailURL == nil })
    }

    // MARK: - Cursor walk over a compacted media_live_urls

    func testCompactedLiveURLsAreConsumedByCursorNotIndex() {
        // Older serializers filtered the "" padding out, so media_live_urls
        // arrives shorter than media_urls: the k-th live_photo slot takes the
        // k-th surviving clip. An index lookup would hand slot 3 nothing and
        // silently downgrade a Live Photo to a still.
        let items = PostMediaItem.items(
            urls: [
                "https://cdn.example.com/a.jpg",
                "https://cdn.example.com/b.jpg",
                "https://cdn.example.com/c.jpg",
                "https://cdn.example.com/d.jpg"
            ],
            types: ["image", "live_photo", "image", "live_photo"],
            thumbnails: nil,
            liveURLs: ["https://cdn.example.com/clipB.mov", "https://cdn.example.com/clipD.mov"]
        )
        XCTAssertEqual(items.map(\.kind), [.image, .livePhoto, .image, .livePhoto])
        XCTAssertEqual(items[1].liveVideoURL?.absoluteString, "https://cdn.example.com/clipB.mov")
        XCTAssertEqual(items[3].liveVideoURL?.absoluteString, "https://cdn.example.com/clipD.mov")
    }

    func testCursorRunsOutAndTheRemainingLivePhotoDowngrades() {
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
            types: ["live_photo", "live_photo"],
            thumbnails: nil,
            liveURLs: ["https://cdn.example.com/clipA.mov"]
        )
        XCTAssertEqual(items.map(\.kind), [.livePhoto, .image])
        XCTAssertEqual(items[0].liveVideoURL?.absoluteString, "https://cdn.example.com/clipA.mov")
        XCTAssertNil(items[1].liveVideoURL)
    }

    // MARK: - Downgrades and rejects

    func testLivePhotoWithoutClipDowngradesToImage() {
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/still.jpg"],
            types: ["live_photo"],
            thumbnails: ["https://cdn.example.com/thumb.jpg"],
            liveURLs: ["   "]
        )
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].kind, .image, "Whitespace is blank — there is no clip to play")
        XCTAssertNil(items[0].liveVideoURL)
        // The still and its thumbnail survive the downgrade.
        XCTAssertEqual(items[0].url.absoluteString, "https://cdn.example.com/still.jpg")
        XCTAssertEqual(items[0].thumbnailURL?.absoluteString, "https://cdn.example.com/thumb.jpg")
    }

    func testMissingTypesArrayLeavesEverySlotAnImage() {
        let items = PostMediaItem.items(urls: ["https://cdn.example.com/a.jpg"])
        XCTAssertEqual(items.map(\.kind), [.image])
        XCTAssertNil(items[0].thumbnailURL)
        XCTAssertNil(items[0].liveVideoURL)
    }

    func testUnknownTypeFallsBackToImageAndTypeCaseIsIgnored() {
        let items = PostMediaItem.items(
            urls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
            types: ["audio", "LIVE_PHOTO"],
            thumbnails: nil,
            liveURLs: ["", "https://cdn.example.com/clip.mov"]
        )
        XCTAssertEqual(items.map(\.kind), [.image, .livePhoto])
    }

    func testBlankURLSlotsAreDroppedEntirely() {
        // A dropped slot shifts nothing: the ids stay index-derived, so the
        // caller can still tell two identical stills apart.
        let items = PostMediaItem.items(
            urls: ["", "https://cdn.example.com/b.jpg"],
            types: ["image", "image"],
            thumbnails: nil,
            liveURLs: nil
        )
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].url.absoluteString, "https://cdn.example.com/b.jpg")
        XCTAssertEqual(items[0].id, "1-https://cdn.example.com/b.jpg")
    }

    func testEmptyInputProducesNoItems() {
        XCTAssertTrue(PostMediaItem.items(urls: []).isEmpty)
    }
}
