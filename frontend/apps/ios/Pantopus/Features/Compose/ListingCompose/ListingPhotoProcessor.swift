//
//  ListingPhotoProcessor.swift
//  Pantopus
//
//  Normalizes captured / picked listing photos: downscales to a sane
//  pixel budget and re-encodes as JPEG. Re-encoding also strips EXIF
//  (incl. GPS) before bytes leave the device — the iOS counterpart of
//  the RN app's `mediaFirewall.prepareForUpload`.
//

import UIKit

enum ListingPhotoProcessor {
    /// Longest edge after downscale. 1600px keeps tag text legible for
    /// the vision model while holding a 4-photo base64 payload well
    /// under the backend's 20 MB JSON body limit.
    static let maxPixelDimension: CGFloat = 1600
    static let jpegQuality: CGFloat = 0.8

    /// Camera-capture path: UIImage → normalized JPEG bytes.
    static func uploadData(from image: UIImage) -> Data? {
        let pixelWidth = image.size.width * image.scale
        let pixelHeight = image.size.height * image.scale
        let longestEdge = max(pixelWidth, pixelHeight)
        guard longestEdge > 0 else { return nil }
        let ratio = min(1, maxPixelDimension / longestEdge)
        let target = CGSize(width: pixelWidth * ratio, height: pixelHeight * ratio)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: jpegQuality)
    }

    /// Library-pick path: raw picked bytes (HEIC/PNG/JPEG) → normalized
    /// JPEG bytes. Returns nil when the data isn't a decodable image.
    static func uploadData(from rawData: Data) -> Data? {
        guard let image = UIImage(data: rawData) else { return nil }
        return uploadData(from: image)
    }
}
