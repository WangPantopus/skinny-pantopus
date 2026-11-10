//
//  MomentsMediaViews.swift
//  Pantopus
//
//  What a Moment shows (boards V1–V3): the photo filling the screen, the
//  video with its sound (a player drawn edge to edge, no controls), and the
//  text card on its background, in white 29 pt type.
//

import AVFoundation
import SwiftUI
import UIKit

// MARK: - Video

/// Plays one Moment's video at a time and reports how far it has got.
@MainActor
final class MomentsVideoController {
    let player = AVPlayer()
    var onProgress: ((Double) -> Void)?
    var onEnd: (() -> Void)?
    var onReady: (() -> Void)?
    private var timeObserver: Any?
    private var endObserver: (any NSObjectProtocol)?
    private var statusObserver: NSKeyValueObservation?
    private var isReady = false

    var isMuted: Bool {
        get { player.isMuted }
        set { player.isMuted = newValue }
    }

    init() {
        player.automaticallyWaitsToMinimizeStalling = true
    }

    func load(_ url: URL) {
        stop()
        let item = AVPlayerItem(url: url)
        statusObserver = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            guard item.status == .readyToPlay else { return }
            Task { @MainActor [weak self] in
                guard let self, !isReady else { return }
                isReady = true
                onReady?()
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.onEnd?() }
        }
        player.replaceCurrentItem(with: item)
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 20), queue: .main) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, let duration = self.player.currentItem?.duration.seconds, duration.isFinite, duration > 0 else { return }
                self.onProgress?(min(1, max(0, time.seconds / duration)))
            }
        }
    }

    func play() {
        player.play()
    }

    func pause() {
        player.pause()
    }

    func stop() {
        player.pause()
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
        statusObserver = nil
        player.replaceCurrentItem(with: nil)
        isReady = false
    }
}

/// The player edge to edge, filling the screen like the photo does.
struct MomentsVideoSurface: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context _: Context) -> PlayerView {
        let view = PlayerView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        // Clear until the first frame, so the poster under it shows instead of black.
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: PlayerView, context _: Context) {
        if view.playerLayer.player !== player { view.playerLayer.player = player }
    }

    final class PlayerView: UIView {
        override static var layerClass: AnyClass {
            AVPlayerLayer.self
        }

        var playerLayer: AVPlayerLayer {
            // swiftlint:disable:next force_cast
            layer as! AVPlayerLayer
        }
    }
}

// MARK: - Text card

/// Board V3 / P2: a text card on one of the six backgrounds, 160° from top to bottom.
struct MomentsTextCard: View {
    let text: String
    let background: String?
    /// 29 pt on the full screen; smaller in a thumbnail.
    var fontSize: CGFloat = 29

    var body: some View {
        let colors = MomentsPalette.card(background)
        ZStack {
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
            Text(text)
                .font(.system(size: fontSize, weight: .semibold))
                .lineSpacing(fontSize * 0.27)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
                .padding(.horizontal, fontSize * 1.24)
                .padding(.vertical, fontSize * 1.38)
                .minimumScaleFactor(0.6)
        }
    }
}

/// The text card drawn as a picture, for Save to Photos (1080 × 1920).
@MainActor
enum MomentsCardPicture {
    static func render(text: String, background: String?) -> UIImage? {
        let card = MomentsTextCard(text: text, background: background, fontSize: 29)
            .frame(width: 390, height: 693)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 1080 / 390
        return renderer.uiImage
    }
}
