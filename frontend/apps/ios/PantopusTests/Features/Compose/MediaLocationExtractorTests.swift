//
//  MediaLocationExtractorTests.swift
//  PantopusTests
//
//  Media capture-location extraction (ADDENDUM 2a). Stills: a JPEG is
//  synthesized in-test with a GPS EXIF dictionary via
//  CGImageDestination, then extracted — including the S/W ref
//  negation. Videos ride the shared ISO-6709 parser, unit-tested
//  directly; the temp-file leg is covered by its failure-silent path.
//

import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import Pantopus

final class MediaLocationExtractorTests: XCTestCase {
    // MARK: - Fixtures

    /// Synthesize an 8×8 JPEG, optionally stamped with a GPS dictionary.
    private func makeJPEG(gps: [CFString: Any]?) throws -> Data {
        let side = 8
        let context = try XCTUnwrap(CGContext(
            data: nil,
            width: side,
            height: side,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.setFillColor(CGColor(red: 0.2, green: 0.4, blue: 0.6, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: side, height: side))
        let image = try XCTUnwrap(context.makeImage())

        let output = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(
            output, UTType.jpeg.identifier as CFString, 1, nil
        ))
        var properties: [CFString: Any] = [:]
        if let gps {
            properties[kCGImagePropertyGPSDictionary] = gps
        }
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return output as Data
    }

    // MARK: - Stills

    func testExtractsNorthEastCoordinates() async throws {
        let data = try makeJPEG(gps: [
            kCGImagePropertyGPSLatitude: 41.8781,
            kCGImagePropertyGPSLatitudeRef: "N",
            kCGImagePropertyGPSLongitude: 87.6298,
            kCGImagePropertyGPSLongitudeRef: "E"
        ])
        let extracted = await MediaLocationExtractor.imageLocation(from: data)
        let location = try XCTUnwrap(extracted)
        XCTAssertEqual(location.latitude, 41.8781, accuracy: 0.001)
        XCTAssertEqual(location.longitude, 87.6298, accuracy: 0.001)
    }

    func testNegatesSouthAndWestRefs() async throws {
        let data = try makeJPEG(gps: [
            kCGImagePropertyGPSLatitude: 33.86,
            kCGImagePropertyGPSLatitudeRef: "S",
            kCGImagePropertyGPSLongitude: 151.21,
            kCGImagePropertyGPSLongitudeRef: "W"
        ])
        let extracted = await MediaLocationExtractor.imageLocation(from: data)
        let location = try XCTUnwrap(extracted)
        XCTAssertEqual(location.latitude, -33.86, accuracy: 0.001)
        XCTAssertEqual(location.longitude, -151.21, accuracy: 0.001)
    }

    func testImageWithoutGPSReturnsNil() async throws {
        let data = try makeJPEG(gps: nil)
        let extracted = await MediaLocationExtractor.imageLocation(from: data)
        XCTAssertNil(extracted)
    }

    func testGarbageImageBytesReturnNil() async {
        let extracted = await MediaLocationExtractor.imageLocation(from: Data([0x00, 0x01, 0x02]))
        XCTAssertNil(extracted)
    }

    // MARK: - Videos

    /// Garbage bytes exercise the temp-file leg end to end — stage,
    /// fail to load metadata, clean up, return nil (failure-silent).
    func testGarbageVideoBytesReturnNil() async {
        let extracted = await MediaLocationExtractor.videoLocation(from: Data([0xDE, 0xAD, 0xBE, 0xEF]))
        XCTAssertNil(extracted)
    }

    // MARK: - ISO-6709 parser

    func testParsesLatLngIgnoringAltitudeSuffix() throws {
        let location = try XCTUnwrap(MediaLocationExtractor.parseISO6709("+41.8781-087.6298+000.000/"))
        XCTAssertEqual(location.latitude, 41.8781, accuracy: 0.0001)
        XCTAssertEqual(location.longitude, -87.6298, accuracy: 0.0001)
    }

    func testParsesBareLatLngPair() throws {
        let location = try XCTUnwrap(MediaLocationExtractor.parseISO6709("+41.8781-087.6298/"))
        XCTAssertEqual(location.latitude, 41.8781, accuracy: 0.0001)
        XCTAssertEqual(location.longitude, -87.6298, accuracy: 0.0001)
    }

    func testParsesSouthernAndEasternHemispheres() throws {
        let location = try XCTUnwrap(MediaLocationExtractor.parseISO6709("-33.8600+151.2100/"))
        XCTAssertEqual(location.latitude, -33.86, accuracy: 0.0001)
        XCTAssertEqual(location.longitude, 151.21, accuracy: 0.0001)
    }

    func testRejectsMalformedStrings() {
        XCTAssertNil(MediaLocationExtractor.parseISO6709(""))
        XCTAssertNil(MediaLocationExtractor.parseISO6709("garbage"))
        XCTAssertNil(MediaLocationExtractor.parseISO6709("+41.8781/"), "a single group is not a fix")
        XCTAssertNil(MediaLocationExtractor.parseISO6709("41.8781-087.6298/"), "groups must be sign-prefixed")
    }

    func testRejectsOutOfRangeCoordinates() {
        XCTAssertNil(MediaLocationExtractor.parseISO6709("+91.0000-087.6298/"))
        XCTAssertNil(MediaLocationExtractor.parseISO6709("+41.8781-187.6298/"))
    }
}
