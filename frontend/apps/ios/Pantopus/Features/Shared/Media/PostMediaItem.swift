//
//  PostMediaItem.swift
//  Pantopus
//
//  One media attachment on a Pulse post, resolved from the backend's
//  parallel arrays (`media_urls` / `media_types` / `media_thumbnails` /
//  `media_live_urls`). Shared by the feed card media strip, the post
//  detail grid, and the full-screen viewer.
//

import Foundation

/// What kind of attachment a media slot holds.
public enum PostMediaKind: Sendable, Hashable {
    case image
    case video
    /// Still image + short companion video clip (iPhone Live Photo).
    case livePhoto
}

/// A single render-ready media attachment.
public struct PostMediaItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: PostMediaKind
    /// Image kinds: the still. Video kind: the video file itself.
    public let url: URL
    /// Small preview (video poster frame / feed thumbnail) when the
    /// backend generated one.
    public let thumbnailURL: URL?
    /// Companion clip for `.livePhoto` — nil for every other kind.
    public let liveVideoURL: URL?

    public init(
        id: String,
        kind: PostMediaKind,
        url: URL,
        thumbnailURL: URL? = nil,
        liveVideoURL: URL? = nil
    ) {
        self.id = id
        self.kind = kind
        self.url = url
        self.thumbnailURL = thumbnailURL
        self.liveVideoURL = liveVideoURL
    }

    /// Resolves the backend's parallel media arrays into typed items.
    ///
    /// Rules mirror the RN app's `PostMediaGrid` + `usePostComposer`:
    /// - `media_types[i]` decides the kind; missing/unknown → image.
    /// - `live_photo` downgrades to a plain image when the companion
    ///   clip URL is missing (parallel arrays pad with "").
    /// - Blank strings in any array mean "no value for this slot".
    /// - When `liveURLs` arrives shorter than `urls` (older serializers
    ///   filtered the "" padding out), the k-th live_photo slot consumes
    ///   the k-th surviving clip URL instead of an index lookup.
    public static func items(
        urls: [String],
        types: [String]? = nil,
        thumbnails: [String]? = nil,
        liveURLs: [String]? = nil
    ) -> [PostMediaItem] {
        let liveList = liveURLs ?? []
        let liveIsAligned = liveList.count == urls.count
        var liveCursor = 0
        return urls.enumerated().compactMap { index, raw in
            guard let url = cleanURL(raw) else { return nil }
            let thumbnailURL = thumbnails?.count == urls.count
                ? cleanURL(thumbnails?[safe: index])
                : nil
            var liveVideoURL: URL?
            if types?[safe: index]?.lowercased() == "live_photo" {
                if liveIsAligned {
                    liveVideoURL = cleanURL(liveList[safe: index])
                } else {
                    liveVideoURL = cleanURL(liveList[safe: liveCursor])
                    liveCursor += 1
                }
            }
            let kind: PostMediaKind = switch types?[safe: index]?.lowercased() {
            case "video": .video
            case "live_photo" where liveVideoURL != nil: .livePhoto
            default: .image
            }
            return PostMediaItem(
                id: "\(index)-\(url.absoluteString)",
                kind: kind,
                url: url,
                thumbnailURL: thumbnailURL,
                liveVideoURL: kind == .livePhoto ? liveVideoURL : nil
            )
        }
    }

    private static func cleanURL(_ raw: String?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return URL(string: trimmed)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
