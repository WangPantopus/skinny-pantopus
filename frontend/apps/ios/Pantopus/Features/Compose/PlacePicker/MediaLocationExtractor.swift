//
//  MediaLocationExtractor.swift
//  Pantopus
//
//  Capture-location extraction for picked media — the "photo was taken
//  in Chicago, user is in Austin" anchor for `PlacePickerSheet`. Stills
//  are read via ImageIO straight off the in-memory picked bytes;
//  videos go through a scoped temp file because AVAsset cannot read
//  `Data` (the file is deleted as soon as the metadata loads).
//
//  PRIVACY RULE: media GPS is used ONLY as a local picker anchor to
//  suggest places around where the media was captured. It is NEVER
//  auto-attached to the outgoing post / broadcast body — the post
//  carries only the venue the user explicitly picks, same as before.
//

import AVFoundation
import Foundation
import ImageIO

/// Where an attached photo / video was captured. A local picker-anchor
/// hint only — this value never rides an outgoing request.
public struct MediaCaptureLocation: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// Failure-silent GPS readers for picked media bytes. Every entry point
/// is a nonisolated async function, so main-actor callers hop off the
/// main thread for the decode work; any parse / IO failure returns nil
/// (no location → the picker simply renders no anchor chips).
public enum MediaLocationExtractor {
    // MARK: - Stills (ImageIO)

    /// EXIF GPS from in-memory image bytes. Live Photos are flattened
    /// to stills by `loadTransferable(Data.self)`, so this covers them
    /// too. The EXIF dictionary stores unsigned degrees plus an N/S or
    /// E/W ref — southern / western refs negate.
    public static func imageLocation(from data: Data) async -> MediaCaptureLocation? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let gps = properties[kCGImagePropertyGPSDictionary] as? [CFString: Any],
              let rawLatitude = gps[kCGImagePropertyGPSLatitude] as? Double,
              let rawLongitude = gps[kCGImagePropertyGPSLongitude] as? Double
        else { return nil }
        let latitudeRef = gps[kCGImagePropertyGPSLatitudeRef] as? String
        let longitudeRef = gps[kCGImagePropertyGPSLongitudeRef] as? String
        return validated(
            latitude: latitudeRef == "S" ? -abs(rawLatitude) : rawLatitude,
            longitude: longitudeRef == "W" ? -abs(rawLongitude) : rawLongitude
        )
    }

    // MARK: - Videos (AVFoundation)

    /// Common-identifier location from video bytes. AVAsset cannot read
    /// `Data`, so the bytes are staged in a scoped temp file (deleted on
    /// exit) and the ISO-6709 location string is parsed off the asset's
    /// metadata.
    public static func videoLocation(from data: Data) async -> MediaCaptureLocation? {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-location-\(UUID().uuidString)")
            .appendingPathExtension(videoFileExtension(for: data))
        guard (try? data.write(to: url, options: [.atomic])) != nil else { return nil }
        defer { try? FileManager.default.removeItem(at: url) }
        let asset = AVURLAsset(url: url)
        guard let metadata = try? await asset.load(.metadata) else { return nil }
        let items = AVMetadataItem.metadataItems(
            from: metadata,
            filteredByIdentifier: .commonIdentifierLocation
        )
        guard let item = items.first,
              let iso6709 = try? await item.load(.stringValue)
        else { return nil }
        return parseISO6709(iso6709)
    }

    // MARK: - ISO-6709

    /// Parse the two leading sign-prefixed groups of an ISO-6709 string
    /// ("+41.8781-087.6298+000.000/" → lat 41.8781, lng -87.6298). Any
    /// altitude / CRS suffix is ignored; a string without exactly two
    /// leading signed groups is rejected.
    static func parseISO6709(_ raw: String) -> MediaCaptureLocation? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        var values: [Double] = []
        var index = trimmed.startIndex
        while values.count < 2, index < trimmed.endIndex,
              trimmed[index] == "+" || trimmed[index] == "-" {
            var end = trimmed.index(after: index)
            while end < trimmed.endIndex, trimmed[end].isNumber || trimmed[end] == "." {
                end = trimmed.index(after: end)
            }
            guard let value = Double(trimmed[index..<end]) else { return nil }
            values.append(value)
            index = end
        }
        guard values.count == 2 else { return nil }
        return validated(latitude: values[0], longitude: values[1])
    }

    // MARK: - Helpers

    private static func validated(latitude: Double, longitude: Double) -> MediaCaptureLocation? {
        guard latitude.isFinite, longitude.isFinite,
              abs(latitude) <= 90, abs(longitude) <= 180
        else { return nil }
        return MediaCaptureLocation(latitude: latitude, longitude: longitude)
    }

    /// AVURLAsset type-sniffs by file extension — pick .mov for a
    /// QuickTime `ftyp` major brand, .mp4 otherwise.
    private static func videoFileExtension(for data: Data) -> String {
        guard data.count >= 12 else { return "mp4" }
        let brand = data.subdata(in: 8..<12)
        return brand.elementsEqual("qt  ".utf8) ? "mov" : "mp4"
    }
}
