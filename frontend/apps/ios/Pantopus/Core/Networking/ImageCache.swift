//
//  ImageCache.swift
//  Pantopus
//
//  Small in-memory `NSCache` for avatars and other small images. Keyed
//  by `URL`. Used by the avatar pipeline to avoid re-decoding images on
//  every scroll frame (P13 list-scroll budget).
//

import Foundation
import UIKit

/// Memory-budgeted image cache for avatars and other small artwork.
///
/// Sized to hold ~200 cached images at a 50 MB ceiling — well under the
/// device's foreground RAM budget. Keys are `URL`s; values are `UIImage`s.
public final class PantopusImageCache: @unchecked Sendable {
    /// Process-wide singleton. Feature code accesses this directly; tests
    /// can construct their own instance.
    public static let shared = PantopusImageCache()

    private let cache: NSCache<NSURL, UIImage>

    /// Default count + cost limits drawn from the P13 budget.
    public init(countLimit: Int = 200, totalCostBytes: Int = 50 * 1024 * 1024) {
        let cache = NSCache<NSURL, UIImage>()
        cache.countLimit = countLimit
        cache.totalCostLimit = totalCostBytes
        self.cache = cache
    }

    /// Read a cached image. Returns nil on miss.
    public func image(for url: URL) -> UIImage? {
        cache.object(forKey: url as NSURL)
    }

    /// Store an image. Cost is the decoded bitmap size — `image.bytesEstimate`
    /// — so the cost limit reflects actual memory pressure.
    public func store(_ image: UIImage, for url: URL) {
        let cost = Self.bytes(for: image)
        cache.setObject(image, forKey: url as NSURL, cost: cost)
    }

    /// Drop everything — used on memory-warning notifications and tests.
    public func evictAll() {
        cache.removeAllObjects()
    }

    /// Conservative byte estimate: width × height × 4 (RGBA).
    private static func bytes(for image: UIImage) -> Int {
        let pixels = Int(image.size.width * image.scale * image.size.height * image.scale)
        return pixels * 4
    }
}
