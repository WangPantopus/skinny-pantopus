//
//  MomentMotionLayer.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece C (CONTRACT 10b): a Live Photo's motion for a reader whose switch is on. When
//  the Moment opens it plays once, silently, over its photo, then rests on the photo; while the reader holds the
//  picture (today's hold, which pauses the viewer as before) it plays again with its sound. Under Reduce Motion it
//  doesn't play by itself; holding still plays it. A small moving-photo mark says it moves; never the word "Live",
//  which means "taken here just now". A Moment without `motion` is drawn as before.
//

import AVFoundation
import SwiftUI
import UIKit

/// The viewer's hold, handed down by today's viewer (one line), so a Live Photo's motion replays while held.
private struct MomentHoldingKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var momentHolding: Bool {
        get { self[MomentHoldingKey.self] }
        set { self[MomentHoldingKey.self] = newValue }
    }
}

/// The clip over the photo, laid on the photo's own frame (filled as the photo is, or fitted for a whole picture).
struct MomentMotionLayer: View {
    let motion: MomentMotionDTO
    /// The photo fills its frame (today's look) or is fitted in it (a whole picture).
    let fills: Bool
    @Environment(\.momentHolding) private var holding
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var player: AVPlayer?
    @State private var showing = false

    var body: some View {
        ZStack {
            if let player, showing {
                MomentMotionPlayerView(player: player, fills: fills)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.25), value: showing)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .task(id: motion.url) { start() }
        .onChange(of: holding) { _, held in
            held ? play(sound: true) : rest()
        }
        // Played to its end: the photo again.
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { note in
            if let item = note.object as? AVPlayerItem, item === player?.currentItem { showing = false }
        }
        .onDisappear { stop() }
    }

    private func start() {
        stop()
        guard let link = motion.url, let url = URL(string: link) else { return }
        let made = AVPlayer(url: url)
        made.actionAtItemEnd = .pause
        player = made
        // Once, silently, when it opens; with Reduce Motion only when held.
        if !reduceMotion { play(sound: false) }
    }

    private func play(sound: Bool) {
        guard let player else { return }
        player.isMuted = !sound
        player.seek(to: .zero)
        player.play()
        showing = true
    }

    private func rest() {
        player?.pause()
        showing = false
    }

    private func stop() {
        player?.pause()
        (player, showing) = (nil, false)
    }
}

/// The small moving-photo mark: concentric rings in a dark disc.
struct MomentMotionMark: View {
    var body: some View {
        Icon(.circleDot, size: 16, strokeWidth: 2.2, color: .white)
            .frame(width: 30, height: 30)
            .background(Circle().fill(Color.black.opacity(0.45)))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Moving photo: hold to play it with sound")
            .accessibilityIdentifier("moments.viewer.motion.mark")
            .allowsHitTesting(false)
    }
}

/// An AVPlayer's picture, filled or fitted as the photo under it (today's viewer's player view).
private struct MomentMotionPlayerView: UIViewRepresentable {
    let player: AVPlayer
    let fills: Bool

    func makeUIView(context _: Context) -> MomentsVideoSurface.PlayerView {
        let view = MomentsVideoSurface.PlayerView()
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: MomentsVideoSurface.PlayerView, context _: Context) {
        if view.playerLayer.player !== player { view.playerLayer.player = player }
        view.playerLayer.videoGravity = fills ? .resizeAspectFill : .resizeAspect
    }
}
