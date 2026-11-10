//
//  MomentsSaveToPhotos.swift
//  Pantopus
//
//  Board V5's Save to Photos: your own Moment into your photo library: the
//  photo, the video, or the text card drawn as a picture. It asks only to
//  add to the library, never to read it.
//

import Photos
import UIKit

enum MomentsSaveToPhotos {
    @MainActor
    static func save(moment: MomentDTO, picture: UIImage?, session: URLSession) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw MomentsFailure.other("Allow Pantopus to add to Photos in Settings, then try again.")
        }
        switch moment.kind {
        case .photo, .text:
            guard let picture else { throw MomentsFailure.other("Couldn't save to Photos.") }
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: picture)
            }
        case .video:
            guard let url = moment.media else { throw MomentsFailure.notFound }
            let (download, _) = try await session.download(from: url)
            let file = FileManager.default.temporaryDirectory.appendingPathComponent("moment-\(UUID().uuidString).mp4")
            try FileManager.default.moveItem(at: download, to: file)
            defer { try? FileManager.default.removeItem(at: file) }
            try await PHPhotoLibrary.shared().performChanges {
                _ = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: file)
            }
        }
    }
}
