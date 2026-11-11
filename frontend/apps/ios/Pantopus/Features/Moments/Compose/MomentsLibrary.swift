//
//  MomentsLibrary.swift
//  Pantopus
//
//  Posting from the library (Moments brief, "Posting"): only photos and
//  videos taken in the last 24 hours, newest first, so a Moment is still
//  about now. A photo or video pins where it was taken when the file says
//  where; a video over 30 seconds can't be chosen.
//

import AVFoundation
import Photos
import SwiftUI
import UIKit

/// Reads the photo library: the last 24 hours, thumbnails and the files themselves.
@MainActor
enum MomentsLibraryLoader {
    static func recentAssets() -> [PHAsset] {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(
            format: "creationDate >= %@ AND (mediaType == %d OR mediaType == %d)",
            Date().addingTimeInterval(-24 * 3600) as NSDate,
            PHAssetMediaType.image.rawValue,
            PHAssetMediaType.video.rawValue
        )
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 300
        let result = PHAsset.fetchAssets(with: options)
        var assets: [PHAsset] = []
        result.enumerateObjects { asset, _, _ in assets.append(asset) }
        return assets
    }

    /// The camera's library button: the newest of the last 24 hours, only when the library is already open to Pantopus.
    static func newestThumbnail() async -> UIImage? {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited, let newest = recentAssets().first else { return nil }
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
    @State private var assets: [PHAsset] = []
    @State private var loaded = false
    @State private var opening: String?
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
            MomentsModeTabs(model: model)
                .padding(.bottom, Spacing.s1)
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
            Text("Last 24 hours")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
    }

    @ViewBuilder
    private var content: some View {
        switch status {
        case .denied, .restricted:
            note(
                title: "Allow Pantopus to see your photos",
                line: "Then photos and videos you took in the last 24 hours show here.",
                button: "Open Settings"
            ) {
                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            }
        default:
            if !loaded {
                ProgressView().tint(.white)
            } else if assets.isEmpty {
                note(title: "Nothing from the last 24 hours", line: "Photos and videos you take today show here.", button: nil, action: nil)
                    .accessibilityIdentifier("moments.library.empty")
            } else {
                grid
            }
        }
    }

    private var grid: some View {
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
                ForEach(Array(assets.enumerated()), id: \.element.localIdentifier) { index, asset in
                    MomentsLibraryCell(asset: asset, isOpening: opening == asset.localIdentifier) {
                        choose(asset)
                    }
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
        assets = MomentsLibraryLoader.recentAssets()
        loaded = true
    }

    private func choose(_ asset: PHAsset) {
        guard opening == nil else { return }
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
    let onTap: () -> Void
    @State private var thumbnail: UIImage?

    var body: some View {
        let tooLong = asset.mediaType == .video
            && asset.duration > MomentsMediaExport.maxVideoSeconds + MomentsMediaExport.videoSecondsTolerance
        Button(action: onTap) {
            Color(white: 0.12)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    if let thumbnail { Image(uiImage: thumbnail).resizable().scaledToFill() }
                }
                .clipped()
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
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(tooLong)
        .task { thumbnail = await MomentsLibraryLoader.thumbnail(for: asset, side: 240) }
        .accessibilityLabel(label(tooLong: tooLong))
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
