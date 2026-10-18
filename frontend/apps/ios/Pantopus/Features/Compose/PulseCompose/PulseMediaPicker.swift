import AVFoundation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The system picker grants access only to the selected assets. Loading a
/// PHLivePhoto preserves its paired resources without asking for library access.
struct PulseMediaPicker: UIViewControllerRepresentable {
    let limit: Int
    let onPicked: ([PulseComposePhoto], String?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onPicked: onPicked)
    }

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = max(1, limit)
        config.filter = .any(of: [.images, .videos, .livePhotos])
        config.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: PHPickerViewController, context _: Context) {}

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPicked: ([PulseComposePhoto], String?) -> Void

        init(onPicked: @escaping ([PulseComposePhoto], String?) -> Void) {
            self.onPicked = onPicked
        }

        func picker(_: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            Task { @MainActor in
                var media: [PulseComposePhoto] = []
                var failed = false
                for result in results {
                    do {
                        try await media.append(PulsePickedMedia.load(result.itemProvider))
                    } catch {
                        failed = true
                    }
                }
                onPicked(
                    media,
                    failed ?
                        "Couldn't load some attachments. Choose photos under 10 MB or videos under 100 MB, then try again." :
                        nil
                )
            }
        }
    }
}

private enum PulsePickedMedia {
    static func load(_ provider: NSItemProvider) async throws -> PulseComposePhoto {
        if provider.canLoadObject(ofClass: PHLivePhoto.self) {
            let live: PHLivePhoto = try await withCheckedThrowingContinuation { continuation in
                provider.loadObject(ofClass: PHLivePhoto.self) { object, error in
                    if let live = object as? PHLivePhoto {
                        continuation.resume(returning: live)
                    } else {
                        continuation.resume(throwing: error ?? URLError(.cannotDecodeContentData))
                    }
                }
            }
            let resources = PHAssetResource.assetResources(for: live)
            guard let still = resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto }),
                  let clip = resources.first(where: { $0.type == .pairedVideo || $0.type == .fullSizePairedVideo }) else {
                throw URLError(.cannotDecodeContentData)
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: directory) }
            let stillURL = directory.appendingPathComponent("still")
            let clipURL = directory.appendingPathComponent("clip.mov")
            try await write(still, to: stillURL)
            try await write(clip, to: clipURL)
            let bytes = try imageData(at: stillURL)
            let motion = try await videoData(at: clipURL)
            let location = try await MediaLocationExtractor.imageLocation(from: boundedData(at: stillURL, megabytes: 30))
            return PulseComposePhoto(
                data: bytes,
                capturedLatitude: location?.latitude,
                capturedLongitude: location?.longitude,
                mimeType: "image/jpeg",
                filename: "live-photo.jpg",
                liveVideo: motion
            )
        }
        let isVideo = provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier)
        let type = isVideo ? UTType.movie.identifier : UTType.image.identifier
        let url: URL = try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: type) { original, error in
                do {
                    guard let original else { throw error ?? URLError(.fileDoesNotExist) }
                    let copy = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString).appendingPathExtension(original.pathExtension)
                    try FileManager.default.copyItem(at: original, to: copy)
                    continuation.resume(returning: copy)
                } catch { continuation.resume(throwing: error) }
            }
        }
        defer { try? FileManager.default.removeItem(at: url) }
        if isVideo {
            return try await PulseComposePhoto(data: videoData(at: url), mimeType: "video/mp4", filename: "video.mp4")
        }
        let original = try boundedData(at: url, megabytes: 30)
        let location = await MediaLocationExtractor.imageLocation(from: original)
        // Preserve transparency; the server removes image metadata before storage.
        if original.starts(with: [0x89, 0x50, 0x4E, 0x47]) {
            guard original.count <= 10 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            return PulseComposePhoto(
                data: original,
                capturedLatitude: location?.latitude,
                capturedLongitude: location?.longitude,
                mimeType: "image/png",
                filename: "photo.png"
            )
        }
        // Keep animated formats; HEIC stills become JPEG for all clients.
        if original.starts(with: [0x47, 0x49, 0x46]) {
            guard original.count <= 10 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            return PulseComposePhoto(data: original, mimeType: "image/gif", filename: "photo.gif")
        }
        return try PulseComposePhoto(
            data: imageData(at: url),
            capturedLatitude: location?.latitude,
            capturedLongitude: location?.longitude,
            mimeType: "image/jpeg",
            filename: "photo.jpg"
        )
    }

    private static func write(_ resource: PHAssetResource, to url: URL) async throws {
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHAssetResourceManager.default().writeData(for: resource, toFile: url, options: options) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    static func boundedData(at url: URL, megabytes: Int) throws -> Data {
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0, size <= megabytes * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
        return try Data(contentsOf: url)
    }

    private static func imageData(at url: URL) throws -> Data {
        let original = try boundedData(at: url, megabytes: 30)
        guard let image = UIImage(data: original), let jpeg = image.jpegData(compressionQuality: 0.9),
              jpeg.count <= 10 * 1024 * 1024 else { throw URLError(.cannotDecodeContentData) }
        return jpeg
    }

    private static func videoData(at url: URL) async throws -> Data {
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0, size <= 100 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
        let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
        defer { try? FileManager.default.removeItem(at: output) }
        guard let exporter = AVAssetExportSession(asset: AVURLAsset(url: url), presetName: AVAssetExportPreset1920x1080) else {
            throw URLError(.cannotDecodeContentData)
        }
        exporter.outputURL = output
        exporter.outputFileType = .mp4
        exporter.metadata = []
        exporter.shouldOptimizeForNetworkUse = true
        await exporter.export()
        guard exporter.status == .completed else { throw exporter.error ?? URLError(.cannotDecodeContentData) }
        return try boundedData(at: output, megabytes: 100)
    }
}
