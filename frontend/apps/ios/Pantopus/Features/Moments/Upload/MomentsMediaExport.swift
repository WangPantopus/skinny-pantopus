//
//  MomentsMediaExport.swift
//  Pantopus
//
//  A photo or video made ready to post (Moments brief, "Posting"): a photo
//  becomes an upright JPEG no larger than 2048 px with no metadata; a video
//  becomes an MP4 at about 720p (H.264, with its sound, no metadata), at most
//  30 seconds, with a poster frame and two more frames for the server's
//  picture check. The files sit in the Moment's own outbox folder until the
//  upload is done.
//

import AVFoundation
import Foundation
import UIKit

/// What an upload sends, as file names inside the Moment's outbox folder.
struct MomentPreparedMedia: Codable, Hashable {
    let kind: MomentKind
    let file: String
    let mimeType: String
    let poster: String?
    let frames: [String]
    let durationMs: Double?
}

enum MomentsMediaExport {
    /// The longest a video may be.
    static let maxVideoSeconds = 30.0
    /// A little over, for a clip the camera stopped at 30 s.
    static let videoSecondsTolerance = 0.6
    private static let maxPhotoPixels: CGFloat = 2048

    // MARK: - Photo

    /// A photo from its bytes (the camera's, or the library's).
    static func photo(data: Data, into folder: URL) throws -> MomentPreparedMedia {
        guard let image = UIImage(data: data) else { throw MomentsFailure.mediaRejected }
        return try photo(image, into: folder)
    }

    /// An upright JPEG at most 2048 px on its longest side. Drawing it again
    /// leaves the camera's details (and any location) behind.
    static func photo(_ image: UIImage, into folder: URL) throws -> MomentPreparedMedia {
        let jpeg = try jpegData(image, maxPixels: maxPhotoPixels, quality: 0.85)
        let name = "photo.jpg"
        try jpeg.write(to: folder.appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        return MomentPreparedMedia(kind: .photo, file: name, mimeType: "image/jpeg", poster: nil, frames: [], durationMs: nil)
    }

    // MARK: - Video

    /// How long a video is, in seconds.
    static func duration(of url: URL) async -> Double {
        guard let time = try? await AVURLAsset(url: url).load(.duration) else { return 0 }
        return time.seconds.isFinite ? time.seconds : 0
    }

    /// An MP4 at about 720p with its sound, its poster and two frames.
    static func video(at source: URL, into folder: URL) async throws -> MomentPreparedMedia {
        let asset = AVURLAsset(url: source)
        let seconds = await duration(of: source)
        guard seconds > 0 else { throw MomentsFailure.mediaRejected }
        guard seconds <= maxVideoSeconds + videoSecondsTolerance else { throw MomentsFailure.mediaTooLong }
        let name = "video.mp4"
        let output = folder.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: output)
        guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
            throw MomentsFailure.mediaRejected
        }
        exporter.outputURL = output
        exporter.outputFileType = .mp4
        // No location, no camera details.
        exporter.metadata = []
        exporter.shouldOptimizeForNetworkUse = true
        if seconds > maxVideoSeconds {
            exporter.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: maxVideoSeconds, preferredTimescale: 600))
        }
        await exporter.export()
        guard exporter.status == .completed else { throw MomentsFailure.mediaRejected }
        let frames = try await stills(of: AVURLAsset(url: output), seconds: min(seconds, maxVideoSeconds), into: folder)
        return MomentPreparedMedia(
            kind: .video,
            file: name,
            mimeType: "video/mp4",
            poster: frames.first,
            frames: Array(frames.dropFirst()),
            durationMs: min(seconds, maxVideoSeconds) * 1000
        )
    }

    /// The poster (near the start) and frames a third and two thirds in.
    private static func stills(of asset: AVURLAsset, seconds: Double, into folder: URL) async throws -> [String] {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1280, height: 1280)
        generator.requestedTimeToleranceBefore = CMTime(seconds: 0.2, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.2, preferredTimescale: 600)
        let times = [min(0.1, seconds / 10), seconds / 3, seconds * 2 / 3]
        var names: [String] = []
        for (index, time) in times.enumerated() {
            let image = try await generator.image(at: CMTime(seconds: time, preferredTimescale: 600)).image
            let name = index == 0 ? "poster.jpg" : "frame\(index).jpg"
            let data = try jpegData(UIImage(cgImage: image), maxPixels: 1280, quality: 0.8)
            try data.write(to: folder.appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            names.append(name)
        }
        return names
    }

    // MARK: - Helpers

    private static func jpegData(_ image: UIImage, maxPixels: CGFloat, quality: CGFloat) throws -> Data {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let longest = max(pixels.width, pixels.height)
        guard longest > 0 else { throw MomentsFailure.mediaRejected }
        let scale = min(1, maxPixels / longest)
        let target = CGSize(width: (pixels.width * scale).rounded(), height: (pixels.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let upright = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        guard let data = upright.jpegData(compressionQuality: quality) else { throw MomentsFailure.mediaRejected }
        return data
    }
}

/// The multipart body for `POST /api/moments/:id/media`, written to a file so
/// a large video is never held in memory twice.
enum MomentsUploadBody {
    static func write(media: MomentPreparedMedia, folder: URL, boundary: String) throws -> URL {
        let url = folder.appendingPathComponent("upload-body")
        FileManager.default.createFile(
            atPath: url.path,
            contents: nil,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try part(handle, boundary: boundary, field: "file", file: folder.appendingPathComponent(media.file), mimeType: media.mimeType)
        if let poster = media.poster {
            try part(handle, boundary: boundary, field: "poster", file: folder.appendingPathComponent(poster), mimeType: "image/jpeg")
        }
        for frame in media.frames {
            try part(handle, boundary: boundary, field: "frames", file: folder.appendingPathComponent(frame), mimeType: "image/jpeg")
        }
        try handle.write(contentsOf: Data("--\(boundary)--\r\n".utf8))
        return url
    }

    private static func part(_ handle: FileHandle, boundary: String, field: String, file: URL, mimeType: String) throws {
        let header = "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(field)\"; filename=\"\(file.lastPathComponent)\"\r\n"
            + "Content-Type: \(mimeType)\r\n\r\n"
        try handle.write(contentsOf: Data(header.utf8))
        let input = try FileHandle(forReadingFrom: file)
        defer { try? input.close() }
        while let chunk = try input.read(upToCount: 1 << 20), !chunk.isEmpty {
            try handle.write(contentsOf: chunk)
        }
        try handle.write(contentsOf: Data("\r\n".utf8))
    }
}
