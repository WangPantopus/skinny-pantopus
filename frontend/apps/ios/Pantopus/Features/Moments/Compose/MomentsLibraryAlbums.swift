//
//  MomentsLibraryAlbums.swift
//  Pantopus
//
//  The albums the Photos app shows, for the library's title button (founder,
//  2026-11-11: "they can choose from their Favorites, from Videos, from
//  Recently Saved"): Recents and Favorites first, then Apple's own lists by
//  kind (Videos, Selfies, Screenshots…), the person's albums (one in a folder
//  says which) and shared albums. Each keeps Apple's name. Hidden and Recently
//  Deleted never show, and an album with nothing to post is left out.
//

import Photos
import SwiftUI
import UIKit

/// One album as the Photos app lists it. PhotoKit's objects never change and can be read from any thread.
struct MomentsAlbum: Identifiable, Equatable, @unchecked Sendable {
    let id: String
    let title: String
    /// The folder it's in ("Trips"), if it is in one.
    let folder: String?
    let count: Int
    let cover: PHAsset?
    /// nil is the whole library ("Recents").
    let collection: PHAssetCollection?

    static let recentsID = "recents"
}

struct MomentsAlbumSection: Identifiable, Equatable {
    let id: String
    /// nil for the first rows (Recents, Favorites, Recently Saved).
    let title: String?
    let albums: [MomentsAlbum]
}

/// An album's photos and videos, newest first; read one at a time, however big the album.
struct MomentsAlbumAssets: @unchecked Sendable {
    let result: PHFetchResult<PHAsset>
    /// Apple keeps "Recently Saved" in the order things were saved, oldest first: it is read from its end.
    let newestLast: Bool

    var count: Int {
        result.count
    }

    var isEmpty: Bool {
        result.firstObject == nil
    }

    func asset(at index: Int) -> PHAsset {
        result.object(at: newestLast ? result.count - 1 - index : index)
    }
}

enum MomentsAlbums {
    /// The photos and videos in an album (nil: the whole library), newest first.
    static func assets(in collection: PHAssetCollection?, limit: Int = 0) -> MomentsAlbumAssets {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(
            format: "mediaType == %d OR mediaType == %d",
            PHAssetMediaType.image.rawValue,
            PHAssetMediaType.video.rawValue
        )
        guard let collection else {
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = limit
            return MomentsAlbumAssets(result: PHAsset.fetchAssets(with: options), newestLast: false)
        }
        // Saved order is the point of "Recently Saved": a photo taken last year and saved today is first.
        let bySaved = savedOrder.contains(collection.assetCollectionSubtype.rawValue)
        if !bySaved {
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = limit
        }
        return MomentsAlbumAssets(result: PHAsset.fetchAssets(in: collection, options: options), newestLast: bySaved)
    }

    /// Every album with something in it, in the Photos app's order. Counting them reads the library, so off the main thread.
    static func sections() async -> [MomentsAlbumSection] {
        await Task.detached(priority: .userInitiated) { load() }.value
    }

    private static func load() -> [MomentsAlbumSection] {
        let everything = assets(in: nil)
        var top = [
            MomentsAlbum(
                id: MomentsAlbum.recentsID,
                title: "Recents",
                folder: nil,
                count: everything.count,
                cover: everything.isEmpty ? nil : everything.asset(at: 0),
                collection: nil
            )
        ]
        var kinds: [(order: Int, album: MomentsAlbum)] = []
        var utilities: [MomentsAlbum] = []
        let smart = PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: .any, options: nil)
        for index in 0..<smart.count {
            let collection = smart.object(at: index)
            let subtype = collection.assetCollectionSubtype.rawValue
            // Apple's unnamed lists show only when they're known to be ones Photos shows without Face ID.
            guard !left.contains(subtype), subtype < unnamed || shownUnnamed.contains(subtype) else { continue }
            guard let album = entry(collection) else { continue }
            if let place = first.firstIndex(where: { $0.contains(subtype) }) {
                top.insert(album, at: min(place + 1, top.count))
            } else if let order = byKind.firstIndex(of: subtype) {
                kinds.append((order, album))
            } else {
                utilities.append(album)
            }
        }
        kinds.sort { $0.order < $1.order }
        utilities.sort { $0.title.localizedStandardCompare($1.title) == .orderedAscending }

        let shared = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumCloudShared, options: nil)
        let sharedAlbums = (0..<shared.count).compactMap { entry(shared.object(at: $0)) }

        return [
            MomentsAlbumSection(id: "top", title: nil, albums: top),
            MomentsAlbumSection(id: "kinds", title: "Media Types", albums: kinds.map(\.album)),
            MomentsAlbumSection(id: "utilities", title: "Utilities", albums: utilities),
            MomentsAlbumSection(id: "mine", title: "My Albums", albums: userAlbums()),
            MomentsAlbumSection(id: "shared", title: "Shared Albums", albums: sharedAlbums)
        ].filter { !$0.albums.isEmpty }
    }

    /// The person's own albums, top to bottom as they keep them; one inside a folder says which folder.
    private static func userAlbums() -> [MomentsAlbum] {
        var albums: [MomentsAlbum] = []
        func add(_ collections: PHFetchResult<PHCollection>, folder: String?) {
            for index in 0..<collections.count {
                let item = collections.object(at: index)
                if let album = item as? PHAssetCollection {
                    if let entry = entry(album, folder: folder) { albums.append(entry) }
                } else if let list = item as? PHCollectionList {
                    let name = [folder, list.localizedTitle].compactMap { $0 }.joined(separator: " › ")
                    add(PHCollection.fetchCollections(in: list, options: nil), folder: name)
                }
            }
        }
        add(PHCollectionList.fetchTopLevelUserCollections(with: nil), folder: nil)
        return albums
    }

    private static func entry(_ collection: PHAssetCollection, folder: String? = nil) -> MomentsAlbum? {
        let assets = assets(in: collection)
        guard !assets.isEmpty else { return nil }
        return MomentsAlbum(
            id: collection.localIdentifier,
            title: collection.localizedTitle ?? "Album",
            folder: folder,
            count: assets.count,
            cover: assets.asset(at: 0),
            collection: collection
        )
    }

    // Apple's lists, by the number PhotoKit gives each (`PHAssetCollectionSubtype`; read on iOS 26.5, 2026-11-11).
    // The ones past a billion have no public name: "Recently Saved" is one of them.

    /// Never listed: "Recents" (the first row already), Hidden, the system's "unable to upload" and Recently
    /// Deleted and Recovered, which Photos keeps behind Face ID.
    private static let left: Set<Int> = [200, 205, 209, 216, 1_000_000_201, 1_000_000_219]
    private static let unnamed = 1_000_000_000
    /// Recently Saved, Captured by Me and Reference.
    private static let shownUnnamed: Set<Int> = [1_000_000_218, 1_000_000_220, 1_000_000_221]
    /// Right under Recents, as Photos pins them: Favorites, then Recently Saved (Recently Added before iOS 18).
    private static let first: [Set<Int>] = [[203], [206, 1_000_000_218]]
    private static let savedOrder: Set<Int> = [206, 1_000_000_218]
    /// Photos' "Media Types" order: Videos, Selfies, Live Photos, Portrait, Panoramas, Time-lapse, Slo-mo, Cinematic,
    /// Bursts, Screenshots, Screen Recordings, Spatial, Animated, Long Exposure, RAW, Dual Capture.
    private static let byKind = [202, 210, 213, 212, 201, 204, 208, 218, 207, 211, 220, 219, 214, 215, 217, 221]
}

// MARK: - Thumbnails

/// Grid and album-cover pictures: a rough one at once, then the sharp one, so a fast scroll never shows blank squares.
enum MomentsLibraryThumbnails {
    /// Photos' own cache of small pictures; safe from any thread.
    private nonisolated(unsafe) static let manager = PHCachingImageManager()

    static func pictures(for asset: PHAsset, side: CGFloat) -> AsyncStream<UIImage> {
        AsyncStream { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .opportunistic
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = true
            let request = manager.requestImage(
                for: asset, targetSize: CGSize(width: side, height: side), contentMode: .aspectFill, options: options
            ) { image, info in
                if let image { continuation.yield(image) }
                // The rough picture comes first and says so; anything else (the sharp one, a failure) is the last word.
                if (info?[PHImageResultIsDegradedKey] as? Bool) != true { continuation.finish() }
            }
            continuation.onTermination = { _ in manager.cancelImageRequest(request) }
        }
    }
}

/// A square that fills with an asset's picture.
struct MomentsLibraryThumbnail: View {
    let asset: PHAsset?
    var side: CGFloat = 400
    @State private var picture: UIImage?

    var body: some View {
        Color(white: 0.12)
            .overlay {
                if let picture { Image(uiImage: picture).resizable().scaledToFill() }
            }
            .clipped()
            .task(id: asset?.localIdentifier) {
                picture = nil
                guard let asset else { return }
                for await image in MomentsLibraryThumbnails.pictures(for: asset, side: side) {
                    picture = image
                }
            }
    }
}

// MARK: - The list

/// The albums, over the library: a tap shows that album in the grid.
struct MomentsAlbumsSheet: View {
    let sections: [MomentsAlbumSection]?
    let current: String
    let onChoose: (MomentsAlbum) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Albums")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Done", action: onClose)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary300)
                    .accessibilityIdentifier("moments.library.albums.done")
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 56)
            if let sections {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(sections) { section in
                            if let title = section.title {
                                Text(title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Color.white.opacity(0.6))
                                    .padding(.horizontal, Spacing.s4)
                                    .padding(.top, Spacing.s5)
                                    .padding(.bottom, Spacing.s2)
                                    .accessibilityAddTraits(.isHeader)
                            }
                            ForEach(section.albums) { album in
                                row(album)
                            }
                        }
                    }
                    .padding(.bottom, Spacing.s5)
                }
            } else {
                ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(white: 0.07).ignoresSafeArea())
        .environment(\.colorScheme, .dark)
        .accessibilityIdentifier("moments.library.albums.list")
    }

    private func row(_ album: MomentsAlbum) -> some View {
        Button {
            onChoose(album)
        } label: {
            HStack(spacing: Spacing.s3) {
                MomentsLibraryThumbnail(asset: album.cover, side: 180)
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(album.title)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(detail(album))
                        .font(.system(size: 13))
                        .monospacedDigit()
                        .foregroundStyle(Color.white.opacity(0.6))
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                if album.id == current {
                    Icon(.check, size: 20, color: Theme.Color.primary300)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(album.title), \(detail(album))")
        .accessibilityAddTraits(album.id == current ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.library.album.\(album.id == MomentsAlbum.recentsID ? "recents" : album.title)")
    }

    /// "1,204", or "1,204 · Trips" for an album in a folder.
    private func detail(_ album: MomentsAlbum) -> String {
        let count = album.count.formatted()
        return album.folder.map { "\(count) · \($0)" } ?? count
    }
}
