//
//  MediaViewerView.swift
//  Pantopus
//
//  Full-screen paged media viewer for Pulse posts — images, videos
//  (native AVKit controls), and Live Photos (LIVE replay pill +
//  long-press, same gesture as the grid tile). Mirrors the RN app's
//  `ImageViewerModal`.
//

import AVKit
import SwiftUI

/// Full-screen, horizontally paged gallery over a post's media.
public struct MediaViewerView: View {
    private let items: [PostMediaItem]
    @State private var selection: Int
    @Environment(\.dismiss) private var dismiss

    public init(items: [PostMediaItem], startIndex: Int = 0) {
        self.items = items
        _selection = State(initialValue: min(max(0, startIndex), max(0, items.count - 1)))
    }

    public var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            TabView(selection: $selection) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    slide(item, isActive: index == selection)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea(edges: .bottom)

            topBar
        }
        .statusBarHidden()
        .accessibilityIdentifier("mediaViewer")
    }

    private var topBar: some View {
        HStack {
            if items.count > 1 {
                Text("\(selection + 1) / \(items.count)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 10)
                    .frame(height: 28)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Capsule())
                    .accessibilityLabel("Item \(selection + 1) of \(items.count)")
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Icon(.x, size: 18, strokeWidth: 2.4, color: Color.white)
                    .frame(width: 36, height: 36)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("mediaViewerClose")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    @ViewBuilder
    private func slide(_ item: PostMediaItem, isActive: Bool) -> some View {
        switch item.kind {
        case .image:
            viewerImage(item.url)
        case .video:
            VideoSlideView(url: item.url, isActive: isActive)
        case .livePhoto:
            LivePhotoTileView(
                stillURL: item.url,
                thumbnailURL: nil,
                videoURL: item.liveVideoURL ?? item.url,
                contentMode: .fit,
                showsDot: false,
                showsReplayButton: true
            )
        }
    }

    private func viewerImage(_ url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFit()
            case .failure:
                Icon(.alertCircle, size: 32, color: Theme.Color.appTextMuted)
            case .empty:
                ProgressView().tint(Color.white)
            @unknown default:
                Color.black
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Photo")
    }
}

// MARK: - Video slide

/// One video page — AVKit player with native controls. Playback starts
/// when the page becomes the selection and pauses when swiped away.
private struct VideoSlideView: View {
    let url: URL
    let isActive: Bool

    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            if let player {
                VideoPlayer(player: player)
            } else {
                ProgressView().tint(Color.white)
            }
        }
        .onAppear {
            if player == nil {
                player = AVPlayer(url: url)
            }
            if isActive { player?.play() }
        }
        .onChange(of: isActive) { _, nowActive in
            if nowActive {
                player?.play()
            } else {
                player?.pause()
            }
        }
        .onDisappear {
            player?.pause()
        }
        .accessibilityLabel("Video player")
    }
}

#Preview("Viewer — mixed media") {
    MediaViewerView(
        items: [
            PostMediaItem(
                id: "0",
                kind: .image,
                url: URL(string: "https://picsum.photos/900/1200")!
            ),
            PostMediaItem(
                id: "1",
                kind: .livePhoto,
                url: URL(string: "https://picsum.photos/901/1200")!,
                liveVideoURL: URL(string: "https://example.com/clip.mov")
            )
        ],
        startIndex: 0
    )
}
