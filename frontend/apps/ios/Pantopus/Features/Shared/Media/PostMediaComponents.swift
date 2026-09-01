//
//  PostMediaComponents.swift
//  Pantopus
//
//  Shared media tiles + grid for Pulse posts. Renders images, videos
//  (poster + play disc), and Live Photos (still + LIVE dot; long-press
//  crossfades to the companion clip with a haptic, mirroring the RN
//  app's `LivePhotoMedia`). The grid handles the design's 1/2/3/4+
//  layouts and presents the full-screen `MediaViewerView` on tile tap.
//

import AVFoundation
import SwiftUI

// MARK: - Still image

/// AsyncImage with the standard Pulse loading / failure placeholders.
///
/// Built on a `Color.clear` base so the view's geometry is always the
/// size its container proposes — a flexible frame around a fill-mode
/// image otherwise adopts the *image's* expanded size, inflating the
/// tile and pushing badge overlays into the clipped band.
struct MediaStillImage: View {
    let url: URL?
    /// `.fill` for grid cells, `.fit` for full-screen viewer slides.
    var contentMode: ContentMode = .fill

    var body: some View {
        Color.clear
            .overlay {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        if contentMode == .fill {
                            image.resizable().scaledToFill()
                        } else {
                            image.resizable().scaledToFit()
                        }
                    case .failure:
                        Theme.Color.appSurfaceSunken
                            .overlay(Icon(.alertCircle, size: 22, color: Theme.Color.appTextMuted))
                    case .empty:
                        Theme.Color.appSurfaceSunken.overlay(ProgressView())
                    @unknown default:
                        Theme.Color.appSurfaceSunken
                    }
                }
            }
            .clipped()
    }
}

// MARK: - AVPlayer layer

/// Control-free AVPlayer surface (SwiftUI's `VideoPlayer` always draws
/// chrome; Live Photo playback needs a bare layer).
struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer
    let gravity: AVLayerVideoGravity

    final class PlayerContainerView: UIView {
        override static var layerClass: AnyClass {
            AVPlayerLayer.self
        }

        var playerLayer: AVPlayerLayer? {
            layer as? AVPlayerLayer
        }
    }

    func makeUIView(context _: Context) -> PlayerContainerView {
        let view = PlayerContainerView()
        view.playerLayer?.player = player
        view.playerLayer?.videoGravity = gravity
        return view
    }

    func updateUIView(_ view: PlayerContainerView, context _: Context) {
        view.playerLayer?.player = player
        view.playerLayer?.videoGravity = gravity
    }
}

// MARK: - Live Photo tile

/// Still image that crossfades into its companion clip on long-press
/// (haptic + 1.05× zoom, 150ms fade — RN `LivePhotoMedia` parity).
/// The player is created lazily on the first long-press so feed
/// scrolling never pays video setup cost.
struct LivePhotoTileView: View {
    let stillURL: URL
    /// Smaller preview rendered in grid cells when available.
    let thumbnailURL: URL?
    let videoURL: URL
    /// `.fill` for grid cells, `.fit` for the full-screen viewer.
    let contentMode: ContentMode
    /// Yellow indicator dot (hidden in the viewer, which shows a pill).
    var showsDot = true
    /// Viewer slide: render a LIVE pill that replays the clip once.
    var showsReplayButton = false
    var onTap: (() -> Void)?

    @State private var player: AVPlayer?
    @State private var isShowingVideo = false
    /// True while a tap-triggered play-once run is in flight.
    @State private var isPlayingOnce = false
    /// Tracks the press-and-hold. `GestureState` resets to false the
    /// moment the finger lifts (the open-ended second stage fails),
    /// which is what ends playback.
    @GestureState private var isPressing = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            mediaLayers
            if showsReplayButton {
                replayButton
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
        }
        .overlay(alignment: .topLeading) {
            if showsDot {
                Circle()
                    .fill(Theme.Color.liveBadge)
                    .frame(width: 7, height: 7)
                    .padding(Spacing.s2)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onTap?() }
        .simultaneousGesture(pressAndHold)
        .onChange(of: isPressing) { _, pressing in
            if pressing {
                startPlayback()
            } else if !isPlayingOnce {
                stopPlayback()
            }
        }
        .onDisappear {
            stopPlayback()
            player?.replaceCurrentItem(with: nil)
            player = nil
        }
        .onReceive(
            NotificationCenter.default.publisher(
                for: AVPlayerItem.didPlayToEndTimeNotification,
                object: player?.currentItem
            )
        ) { _ in
            if isPlayingOnce { stopPlayback() }
        }
        .accessibilityElement()
        .accessibilityLabel("Live Photo")
        .accessibilityHint("Hold to play")
        .accessibilityIdentifier("livePhotoTile")
    }

    private var mediaLayers: some View {
        ZStack {
            MediaStillImage(
                url: contentMode == .fill ? (thumbnailURL ?? stillURL) : stillURL,
                contentMode: contentMode
            )
            if let player {
                PlayerLayerView(
                    player: player,
                    gravity: contentMode == .fill ? .resizeAspectFill : .resizeAspect
                )
                .opacity(isShowingVideo ? 1 : 0)
                .allowsHitTesting(false)
            }
        }
        .scaleEffect(isShowingVideo ? 1.05 : 1)
        .animation(.easeOut(duration: 0.15), value: isShowingVideo)
        .clipped()
    }

    private var replayButton: some View {
        Button {
            playOnce()
        } label: {
            HStack(spacing: Spacing.s1) {
                Circle().fill(Theme.Color.liveBadge).frame(width: 7, height: 7)
                Text("LIVE")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.white)
            }
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Color.black.opacity(0.55))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(Spacing.s3)
        .accessibilityLabel("Play Live Photo")
        .accessibilityIdentifier("livePhotoReplay")
    }

    /// Press-and-hold: a 0.3s long press chains into an open-ended
    /// second stage that never completes, so `isPressing` stays true
    /// exactly while the finger is down and resets on lift. Built this
    /// way (vs. LongPress + Drag with `.gesture`) because it keeps
    /// working inside ScrollView feeds, the paging TabView, and the
    /// card's outer Button. A plain tap never reaches the long-press
    /// minimum so `onTap` stays clean.
    private var pressAndHold: some Gesture {
        LongPressGesture(minimumDuration: 0.3)
            .sequenced(before: LongPressGesture(minimumDuration: .infinity, maximumDistance: 80))
            .updating($isPressing) { value, state, _ in
                if case .second = value { state = true }
            }
    }

    private func startPlayback() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        if player == nil {
            player = AVPlayer(url: videoURL)
        }
        player?.seek(to: .zero)
        player?.isMuted = false
        player?.play()
        isShowingVideo = true
    }

    private func playOnce() {
        isPlayingOnce = true
        startPlayback()
    }

    private func stopPlayback() {
        isPlayingOnce = false
        player?.pause()
        isShowingVideo = false
    }
}

// MARK: - Single tile

/// One grid cell — dispatches on the item kind.
struct PostMediaTileView: View {
    let item: PostMediaItem
    var onTap: (() -> Void)?

    var body: some View {
        switch item.kind {
        case .image:
            MediaStillImage(url: item.url)
                .contentShape(Rectangle())
                .onTapGesture { onTap?() }
                .accessibilityElement()
                .accessibilityLabel("Photo")
                .accessibilityAddTraits(.isImage)
        case .video:
            ZStack {
                if item.thumbnailURL != nil {
                    MediaStillImage(url: item.thumbnailURL)
                } else {
                    Theme.Color.appText.opacity(0.85)
                }
                playDisc
            }
            .contentShape(Rectangle())
            .onTapGesture { onTap?() }
            .accessibilityElement()
            .accessibilityLabel("Video")
            .accessibilityHint("Opens the player")
        case .livePhoto:
            // Dot drawn here (not inside the tile) so it stays above the
            // player layer regardless of the host container.
            LivePhotoTileView(
                stillURL: item.url,
                thumbnailURL: item.thumbnailURL,
                videoURL: item.liveVideoURL ?? item.url,
                contentMode: .fill,
                showsDot: false,
                onTap: onTap
            )
            .overlay(alignment: .topLeading) {
                Circle()
                    .fill(Theme.Color.liveBadge)
                    .frame(width: 7, height: 7)
                    .padding(Spacing.s2)
                    .accessibilityHidden(true)
            }
        }
    }

    private var playDisc: some View {
        ZStack {
            Circle().fill(Color.black.opacity(0.45))
            Icon(.play, size: 18, color: Color.white)
                .padding(.leading, 2) // optical centering of the triangle
        }
        .frame(width: 44, height: 44)
    }
}

// MARK: - Grid

/// Pulse media grid — the design's 1 (16:9) / 2 / 3 / 4+ ("+N" overflow)
/// layouts. Owns the full-screen viewer presentation: tapping any tile
/// opens `MediaViewerView` paged across **all** items (including the
/// ones hidden behind the "+N" cap).
public struct PostMediaGridView: View {
    /// Tile heights differ between the feed card and the detail screen.
    public enum Style: Sendable {
        case compact // feed card
        case regular // post detail

        var twoUpHeight: CGFloat {
            self == .compact ? 140 : 160
        }

        var threeUpHeight: CGFloat {
            self == .compact ? 160 : 200
        }
    }

    private let items: [PostMediaItem]
    private let style: Style
    private let accessibilityID: String
    /// Place label drawn on the last visible tile (A10.4 map-pin badge).
    private let locationBadge: String?

    @State private var viewerSelection: MediaViewerSelection?

    public init(
        items: [PostMediaItem],
        style: Style,
        accessibilityID: String = "postMediaGrid",
        locationBadge: String? = nil
    ) {
        self.items = items
        self.style = style
        self.accessibilityID = accessibilityID
        self.locationBadge = locationBadge
    }

    public var body: some View {
        if items.isEmpty {
            EmptyView()
        } else {
            grid
                .accessibilityIdentifier(accessibilityID)
                .fullScreenCover(item: $viewerSelection) { selection in
                    MediaViewerView(items: items, startIndex: selection.index)
                }
        }
    }

    @ViewBuilder private var grid: some View {
        switch items.count {
        case 1:
            tile(0)
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .clipped()
                .overlay(alignment: .bottomLeading) { badgeView }
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        case 2:
            HStack(spacing: Spacing.s2) {
                sizedTile(0, height: style.twoUpHeight)
                sizedTile(1, height: style.twoUpHeight)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        case 3:
            let halfHeight = (style.threeUpHeight - Spacing.s2) / 2
            HStack(spacing: Spacing.s2) {
                sizedTile(0, height: style.threeUpHeight)
                VStack(spacing: Spacing.s2) {
                    sizedTile(1, height: halfHeight)
                    sizedTile(2, height: halfHeight)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        default:
            let overflow = items.count - 4
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: Spacing.s2),
                    GridItem(.flexible(), spacing: Spacing.s2)
                ],
                spacing: Spacing.s2
            ) {
                ForEach(0..<4, id: \.self) { index in
                    ZStack {
                        tile(index)
                        if index == 3, overflow > 0 {
                            Theme.Color.appText.opacity(0.4)
                                .allowsHitTesting(false)
                            Text("+\(overflow)")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                                .allowsHitTesting(false)
                        }
                    }
                    .aspectRatio(1, contentMode: .fill)
                    .clipped()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
    }

    private func tile(_ index: Int) -> some View {
        PostMediaTileView(item: items[index]) {
            viewerSelection = MediaViewerSelection(index: index)
        }
    }

    /// Pins the tile's geometry to the visible cell so badge overlays
    /// (LIVE dot, play disc) anchor to what's on screen — a fill-mode
    /// image otherwise inflates the tile beyond the row height and the
    /// top-left corner lands in the clipped band.
    private func sizedTile(_ index: Int, height: CGFloat) -> some View {
        tile(index)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipped()
            .overlay(alignment: .bottomLeading) {
                if index == badgeTileIndex {
                    badgeView
                }
            }
    }

    /// The A10.4 frame pins the place badge to the trailing tile.
    private var badgeTileIndex: Int {
        min(items.count, 4) - 1
    }

    @ViewBuilder private var badgeView: some View {
        if let locationBadge {
            HStack(spacing: Spacing.s1) {
                Icon(.mapPin, size: 10, color: Color.white)
                Text(locationBadge)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Color.black.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            .padding(Spacing.s3)
            .accessibilityLabel("Location: \(locationBadge)")
        }
    }
}

/// `fullScreenCover(item:)` payload — which tile launched the viewer.
struct MediaViewerSelection: Identifiable {
    let index: Int
    var id: Int {
        index
    }
}
