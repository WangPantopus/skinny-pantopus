//
//  MediaLocationExtractor.swift
//  Pantopus
//
//  Capture-location extraction for picked media — the "photo was taken
//  in Chicago, user is in Austin" anchor for `PlacePickerSheet`. Stills
//  are read via ImageIO straight off the in-memory picked bytes;
//  videos are read from a file because AVAsset cannot read `Data`
//  (bytes are staged in a scoped temp file that is deleted as soon as
//  the metadata loads).
//
//  PRIVACY RULE (founder decision, 2026-11-05): where an attachment was
//  taken anchors the picker's "Photo location" suggestions, and it is
//  sent with a Place post (`mediaLocations`) as evidence that the
//  author was at the place, the way a fresh GPS fix is. The backend
//  uses it for the Place check and for the post's pin (the tagged
//  venue or address, or the capture point for a town tag or no tag).
//  It keeps no other copy of the points, and uploads are re-encoded
//  without the files' metadata.
//

import AVFoundation
import Foundation
import ImageIO

/// Where (and, when the metadata says, when) an attached photo / video
/// was captured.
public struct MediaCaptureLocation: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    /// When it was taken, from the GPS time stamp or the camera's own
    /// capture time; nil when the file carries neither.
    public let capturedAt: Date?

    public init(latitude: Double, longitude: Double, capturedAt: Date? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.capturedAt = capturedAt
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
            longitude: longitudeRef == "W" ? -abs(rawLongitude) : rawLongitude,
            capturedAt: gpsTime(gps) ?? exifTime(properties[kCGImagePropertyExifDictionary] as? [CFString: Any])
        )
    }

    // MARK: - Videos (AVFoundation)

    /// Common-identifier location from video bytes. AVAsset cannot read
    /// `Data`, so the bytes are staged in a scoped temp file (deleted on
    /// exit).
    public static func videoLocation(from data: Data) async -> MediaCaptureLocation? {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-location-\(UUID().uuidString)")
            .appendingPathExtension(videoFileExtension(for: data))
        guard (try? data.write(to: url, options: [.atomic])) != nil else { return nil }
        defer { try? FileManager.default.removeItem(at: url) }
        return await videoLocation(at: url)
    }

    /// The ISO-6709 location string (and the creation date) off a video
    /// file's metadata.
    public static func videoLocation(at url: URL) async -> MediaCaptureLocation? {
        let asset = AVURLAsset(url: url)
        guard let metadata = try? await asset.load(.metadata) else { return nil }
        let items = AVMetadataItem.metadataItems(
            from: metadata,
            filteredByIdentifier: .commonIdentifierLocation
        )
        guard let item = items.first,
              let iso6709 = try? await item.load(.stringValue),
              let point = parseISO6709(iso6709)
        else { return nil }
        var created: Date?
        if let creation = try? await asset.load(.creationDate) {
            created = try? await creation.load(.dateValue)
        }
        return MediaCaptureLocation(latitude: point.latitude, longitude: point.longitude, capturedAt: created)
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

    // MARK: - Capture time

    /// The GPS block's own UTC time ("2026:11:02" + "18:04:31.00").
    private static func gpsTime(_ gps: [CFString: Any]) -> Date? {
        guard let day = gps[kCGImagePropertyGPSDateStamp] as? String,
              let time = gps[kCGImagePropertyGPSTimeStamp] as? String
        else { return nil }
        let wholeSeconds = time.split(separator: ".").first.map(String.init) ?? time
        return exifFormatter(timeZone: TimeZone(identifier: "UTC")).date(from: "\(day) \(wholeSeconds)")
    }

    /// The camera's capture time ("2026:11:02 11:04:31"), in its recorded
    /// offset ("-07:00") when there is one, else the phone's time zone.
    private static func exifTime(_ exif: [CFString: Any]?) -> Date? {
        guard let raw = exif?[kCGImagePropertyExifDateTimeOriginal] as? String else { return nil }
        let zone = (exif?[kCGImagePropertyExifOffsetTimeOriginal] as? String).flatMap(timeZone(fromOffset:))
        return exifFormatter(timeZone: zone ?? .current).date(from: raw)
    }

    private static func timeZone(fromOffset offset: String) -> TimeZone? {
        let parts = offset.dropFirst().split(separator: ":")
        guard let sign = offset.first, sign == "+" || sign == "-", parts.count == 2,
              let hours = Int(parts[0]), let minutes = Int(parts[1])
        else { return nil }
        let seconds = (hours * 3600 + minutes * 60) * (sign == "-" ? -1 : 1)
        return TimeZone(secondsFromGMT: seconds)
    }

    private static func exifFormatter(timeZone: TimeZone?) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
        return formatter
    }

    // MARK: - Helpers

    private static func validated(latitude: Double, longitude: Double, capturedAt: Date? = nil) -> MediaCaptureLocation? {
        guard latitude.isFinite, longitude.isFinite,
              abs(latitude) <= 90, abs(longitude) <= 180,
              // 0, 0 is where a missing fix lands, not a photo from the Gulf of Guinea.
              latitude != 0 || longitude != 0
        else { return nil }
        return MediaCaptureLocation(latitude: latitude, longitude: longitude, capturedAt: capturedAt)
    }

    /// AVURLAsset type-sniffs by file extension — pick .mov for a
    /// QuickTime `ftyp` major brand, .mp4 otherwise.
    private static func videoFileExtension(for data: Data) -> String {
        guard data.count >= 12 else { return "mp4" }
        let brand = data.subdata(in: 8..<12)
        return brand.elementsEqual("qt  ".utf8) ? "mov" : "mp4"
    }
}
