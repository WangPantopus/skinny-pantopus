//
//  MomentsLibrary.swift
//  Pantopus
//
//  Posting from the library (Moments brief, "Posting"): any photo or video
//  in the album, newest first (founder, 2026-11-11; it was the last 24 hours
//  before). The title is a button: it opens the albums the Photos app shows
//  (Favorites, Videos, Recently Saved, the person's own; `MomentsLibraryAlbums.swift`)
//  and the grid shows the one chosen. One taken more than a day ago says when
//  on the Moment ("Taken Oct 3"), so it never reads as now. A photo or video
//  pins where it was taken when the file says where; a video over 30 seconds
//  can't be chosen. "Select" picks up to ten together: each is its own Moment,
//  with its own Post sheet in turn (`MomentsComposerModel+Several.swift`).
//

import AVFoundation
import Photos
import SwiftUI
import UIKit

/// Reads the photo library: the whole album, thumbnails and the files themselves.
@MainActor
enum MomentsLibraryLoader {
    /// Every photo and video, newest first. Lazy: the grid reads only the ones it shows, however big the album.
    static func albumAssets(limit: Int = 0) -> PHFetchResult<PHAsset> {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(
            format: "mediaType == %d OR mediaType == %d",
            PHAssetMediaType.image.rawValue,
            PHAssetMediaType.video.rawValue
        )
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = limit
        return PHAsset.fetchAssets(with: options)
    }

    /// The newest few (the camera's library button, the Duo's recent row).
    static func newestAssets(_ count: Int) -> [PHAsset] {
        let result = albumAssets(limit: count)
        return (0..<result.count).map { result.object(at: $0) }
    }

    /// The camera's library button: the newest photo or video, only when the library is already open to Pantopus.
    static func newestThumbnail() async -> UIImage? {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited, let newest = newestAssets(1).first else { return nil }
        return await thumbnail(for: newest, side: 120)
    }

    static func thumbnail(for asset: PHAsset, side: CGFloat) async -> UIImage? {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        return await withCheckedContinuation { continuation in
            PHImageManager.default().requestImage(
                for: asset, targetSize: CGSize(width: side, height: side), contentMode: .aspectFill, options: options
            ) { image, _ in
                continuation.resume(returning: image)
            }
        }
    }

    static func image(for asset: PHAsset) async -> UIImage? {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        options.version = .current
        let data: Data? = await withCheckedContinuation { continuation in
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
                continuation.resume(returning: data)
            }
        }
        return data.flatMap(UIImage.init(data:))
    }

    /// The video as a file of its own, for the export: copied as it is, or
    /// rendered once when it can't be (a slow-motion video is an edit, not a file).
    static func videoFile(for asset: PHAsset) async -> URL? {
        if let copy = await videoFile(for: asset, preset: AVAssetExportPresetPassthrough) { return copy }
        return await videoFile(for: asset, preset: AVAssetExportPresetHighestQuality)
    }

    private static func videoFile(for asset: PHAsset, preset: String) async -> URL? {
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = true
        options.version = .current
        options.deliveryMode = .highQualityFormat
        let target = FileManager.default.temporaryDirectory.appendingPathComponent("moment-library-\(UUID().uuidString).mov")
        let session: AVAssetExportSession? = await withCheckedContinuation { continuation in
            PHImageManager.default().requestExportSession(forVideo: asset, options: options, exportPreset: preset) { session, _ in
                continuation.resume(returning: session)
            }
        }
        guard let session, session.supportedFileTypes.contains(.mov) else { return nil }
        session.outputURL = target
        session.outputFileType = .mov
        await session.export()
        return session.status == .completed ? target : nil
    }
}

struct MomentsLibraryScreen: View {
    let model: MomentsComposerModel
    let onClose: () -> Void
    @State private var status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    @State private var assets: MomentsAlbumAssets?
    @State private var loaded = false
    /// The album in the grid: the whole library ("Recents") until another is chosen.
    @State private var album: MomentsAlbum?
    @State private var albums: [MomentsAlbumSection]?
    @State private var showsAlbums = false
    @State private var opening: String?
    /// "Select" is on: a tap picks or drops one, in the order they'll post.
    @State private var selecting = false
    @State private var picked: [PHAsset] = []
    @Environment(\.momentsDuoScreen) private var duo
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 3)

    var body: some View {
        VStack(spacing: 0) {
            header
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if let error = model.error {
                Text(error)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .background(Capsule().fill(Theme.Color.errorSolid.opacity(0.9)))
                    .padding(.vertical, Spacing.s2)
            }
            if selecting, !picked.isEmpty {
                nextButton
            } else {
                MomentsModeTabs(model: model)
                    .padding(.bottom, Spacing.s1)
            }
        }
        .background(Color.black)
        // The closed iPhone Duo: Close is in the side strip, as on the camera and the text card (boards C6, C7).
        .overlay {
            if duo.pose == .closed {
                GeometryReader { geo in
                    MomentsStripButtons(
                        screen: duo,
                        height: geo.size.height,
                        top: [MomentsStripButtons.Item(id: "moments.camera.close", icon: .x, label: "Close") { onClose() }],
                        bottom: nil
                    )
                }
                .ignoresSafeArea(.container)
            }
        }
        .task { await open() }
        .sheet(isPresented: $showsAlbums) {
            MomentsAlbumsSheet(
                sections: albums,
                current: album?.id ?? MomentsAlbum.recentsID,
                onChoose: show
            ) {
                showsAlbums = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .task { albums = await MomentsAlbums.sections() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.library")
    }

    private var header: some View {
        HStack {
            if duo.pose == .closed {
                Color.clear.frame(width: 44, height: 44)
            } else {
                Button(action: onClose) {
                    Icon(.x, size: 26, color: .white)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("moments.camera.close")
            }
            Spacer()
            albumButton
            Spacer()
            selectButton
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
    }

    /// "Recents ⌄": the album in the grid, and the way to another.
    private var albumButton: some View {
        Button {
            showsAlbums = true
        } label: {
            HStack(spacing: 6) {
                Text(album?.title ?? "Recents")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Icon(.chevronDown, size: 16, color: .white)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 36)
            .background(Capsule().fill(Color.white.opacity(0.14)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(status != .authorized && status != .limited)
        .accessibilityLabel("\(album?.title ?? "Recents"), choose an album")
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier("moments.library.albums")
    }

    /// "Select" / "Cancel", across from Close: several at once, each its own Moment.
    private var selectButton: some View {
        Button(selecting ? "Cancel" : "Select") {
            selecting.toggle()
            picked = []
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(.white)
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .opacity(assets?.isEmpty == false ? 1 : 0)
        .disabled(assets?.isEmpty != false || opening != nil)
        .accessibilityLabel(selecting ? "Cancel selecting" : "Select several")
        .accessibilityIdentifier("moments.library.select")
    }

    /// "Next · 3": on to the first one's Post sheet.
    private var nextButton: some View {
        Button {
            guard opening == nil, let first = picked.first else { return }
            opening = first.localIdentifier
            Task {
                await model.use(assets: picked)
                opening = nil
            }
        } label: {
            ZStack {
                Text("Next · \(picked.count)")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .opacity(opening == nil ? 1 : 0)
                if opening != nil { ProgressView().tint(.white) }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Capsule().fill(Theme.Color.primarySolid))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .accessibilityLabel("Next, \(picked.count) picked")
        .accessibilityIdentifier("moments.library.next")
    }

    @ViewBuilder
    private var content: some View {
        switch status {
        case .denied, .restricted:
            note(
                title: "Allow Pantopus to see your photos",
                line: "Then your photos and videos show here.",
                button: "Open Settings"
            ) {
                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            }
        default:
            if !loaded {
                ProgressView().tint(.white)
            } else if let assets, !assets.isEmpty {
                grid(assets)
                    // A new album starts at its top.
                    .id(album?.id ?? MomentsAlbum.recentsID)
            } else {
                note(title: "No photos or videos yet", line: "Photos and videos you take show here.", button: nil, action: nil)
                    .accessibilityIdentifier("moments.library.empty")
            }
        }
    }

    private func grid(_ assets: MomentsAlbumAssets) -> some View {
        ScrollView {
            if status == .limited {
                Text("Showing the photos you allowed. Change this in Settings.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.white.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
            }
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(0..<assets.count, id: \.self) { index in
                    let asset = assets.asset(at: index)
                    MomentsLibraryCell(
                        asset: asset,
                        isOpening: !selecting && opening == asset.localIdentifier,
                        selecting: selecting,
                        order: picked.firstIndex { $0.localIdentifier == asset.localIdentifier }.map { $0 + 1 }
                    ) {
                        choose(asset)
                    }
                    .id(asset.localIdentifier)
                    .accessibilityIdentifier("moments.library.item.\(index)")
                }
            }
        }
    }

    private func note(title: String, line: String, button: String?, action: (() -> Void)?) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.image, size: 30, color: Color.white.opacity(0.8))
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
            Text(line)
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.75))
            if let button, let action {
                Button(button, action: action)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary300)
                    .padding(.top, Spacing.s1)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, Spacing.s8)
    }

    private func open() async {
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        guard status == .authorized || status == .limited else {
            loaded = true
            return
        }
        assets = MomentsAlbums.assets(in: nil)
        loaded = true
    }

    private func show(_ chosen: MomentsAlbum) {
        album = chosen.collection == nil ? nil : chosen
        assets = MomentsAlbums.assets(in: chosen.collection)
        showsAlbums = false
    }

    private func choose(_ asset: PHAsset) {
        guard opening == nil else { return }
        if selecting {
            if let index = picked.firstIndex(where: { $0.localIdentifier == asset.localIdentifier }) {
                picked.remove(at: index)
            } else if picked.count < MomentsComposerModel.pickLimit {
                picked.append(asset)
            } else {
                model.error = "Up to \(MomentsComposerModel.pickLimit) at a time."
            }
            return
        }
        opening = asset.localIdentifier
        Task {
            await model.use(asset: asset)
            opening = nil
        }
    }
}

/// One photo or video in the grid; a video shows its length, and one over 30 seconds can't be chosen.
private struct MomentsLibraryCell: View {
    let asset: PHAsset
    let isOpening: Bool
    /// "Select" is on, and this one's place among the ones picked (1 posts first).
    var selecting = false
    var order: Int?
    let onTap: () -> Void

    var body: some View {
        let tooLong = asset.mediaType == .video
            && asset.duration > MomentsMediaExport.maxVideoSeconds + MomentsMediaExport.videoSecondsTolerance
        Button(action: onTap) {
            MomentsLibraryThumbnail(asset: asset)
                .aspectRatio(1, contentMode: .fit)
                .overlay(alignment: .bottomTrailing) {
                    if asset.mediaType == .video {
                        Text(duration)
                            .font(.system(size: 12, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.6), radius: 1)
                            .padding(6)
                    }
                }
                .overlay {
                    if tooLong { Color.black.opacity(0.55) }
                    if isOpening { ProgressView().tint(.white) }
                    if order != nil { Color.white.opacity(0.18) }
                }
                .overlay(alignment: .topTrailing) {
                    if selecting, !tooLong { badge }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(tooLong)
        .accessibilityLabel(label(tooLong: tooLong) + (order.map { ", picked, number \($0)" } ?? ""))
        .accessibilityAddTraits(order == nil ? [] : .isSelected)
    }

    /// An empty ring until it's picked, then its number.
    private var badge: some View {
        ZStack {
            Circle().fill(order == nil ? Color.black.opacity(0.25) : Theme.Color.primarySolid)
            Circle().strokeBorder(Color.white, lineWidth: 1.5)
            if let order {
                Text("\(order)")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 24, height: 24)
        .padding(6)
    }

    private var duration: String {
        let seconds = Int(asset.duration.rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func label(tooLong: Bool) -> String {
        guard asset.mediaType == .video else { return "Photo" }
        return tooLong ? "Video, \(duration), over 30 seconds" : "Video, \(duration)"
    }
}
