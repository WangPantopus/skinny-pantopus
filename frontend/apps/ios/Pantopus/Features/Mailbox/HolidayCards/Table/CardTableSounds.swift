//
//  CardTableSounds.swift
//  Pantopus
//
//  Feeling and hearing the paper on the table (launch key `card_table`, plan
//  Part 8): a light tick every 8% of a card's way out of its envelope or into
//  it, and three quiet paper sounds (the card sliding, the seal pressing or
//  breaking, the card set down).
//

import AVFoundation
import CoreHaptics
import os
import QuartzCore

#if DEBUG
/// For checking on the simulator, which can't play haptics: `log stream --predicate 'category == "cardTablePaper"'`.
private let paperLog = Logger(subsystem: "com.pantopus.app", category: "cardTablePaper")
#endif

/// The light tick you feel along a card's pull (plan 8.1), with Core Haptics. Phones without the Taptic Engine (and
/// the simulator) feel nothing.
@MainActor
final class CardTablePaperTicks {
    private let supported = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var engine: CHHapticEngine?
    private var player: CHHapticPatternPlayer?
    private var running = false
    private var broken = false
    func tick() {
        #if DEBUG
        paperLog.debug("tick")
        #endif
        guard supported, !broken else { return }
        do {
            if engine == nil { try makeEngine() }
            if !running {
                try engine?.start()
                running = true
            }
            try player?.start(atTime: CHHapticTimeImmediate)
        } catch {
            // The engine refused (another app holds it, or it's resetting): drop this tick and try again on the next.
            running = false
        }
    }

    private func makeEngine() throws {
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = true
        engine.isAutoShutdownEnabled = true
        // The engine calls these on its own queue.
        engine.stoppedHandler = { @Sendable [weak self] _ in
            Task { @MainActor in self?.running = false }
        }
        engine.resetHandler = { @Sendable [weak self] in
            Task { @MainActor in
                self?.running = false
                self?.player = nil
                self?.player = try? self?.makePlayer()
            }
        }
        self.engine = engine
        do {
            player = try makePlayer()
        } catch {
            broken = true
            throw error
        }
    }

    /// One short, light, crisp tap: paper over paper, not a buzz.
    private func makePlayer() throws -> CHHapticPatternPlayer? {
        let event = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.38),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.62)
            ],
            relativeTime: 0
        )
        return try engine?.makePlayer(with: CHHapticPattern(events: [event], parameters: []))
    }
}

/// Three quiet paper sounds (plan 8.3). They play only with the ringer on (an ambient audio session follows the
/// silent switch and mixes with anything else playing, never stopping it), and only while "Card sounds" is on in
/// Mail Day settings: on by default, kept on this phone.
@MainActor
final class CardTableSounds {
    enum Sound: String, CaseIterable {
        case slide = "card-slide"
        case seal
        case down = "card-down"
    }

    private static let key = "pantopus.cardSounds"

    /// The switch in Mail Day settings (default on).
    nonisolated static var isOn: Bool {
        get { UserDefaults.standard.object(forKey: key) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }

    private var players: [Sound: AVAudioPlayer] = [:]
    private var lastPlayed: [Sound: CFTimeInterval] = [:]
    /// Loads the three ahead, so the first isn't late.
    func preload() {
        guard Self.isOn else { return }
        for sound in Sound.allCases {
            player(sound)?.prepareToPlay()
        }
    }

    func play(_ sound: Sound) {
        guard Self.isOn else { return }
        let now = CACurrentMediaTime()
        // The same sound twice within 0.35 s is one sound (web's rule).
        if now - (lastPlayed[sound] ?? -1) < 0.35 { return }
        lastPlayed[sound] = now
        #if DEBUG
        paperLog.debug("sound \(sound.rawValue, privacy: .public)")
        #endif
        let session = AVAudioSession.sharedInstance()
        if session.category != .ambient {
            try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        }
        try? session.setActive(true)
        guard let player = player(sound) else { return }
        player.currentTime = 0
        player.play()
    }

    private func player(_ sound: Sound) -> AVAudioPlayer? {
        if let player = players[sound] { return player }
        guard let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "caf", subdirectory: "HolidayCardTable"),
              let player = try? AVAudioPlayer(contentsOf: url)
        else { return nil }
        // The files are already quiet (about -34 dBFS while sounding); a little lower still, as on web.
        player.volume = 0.85
        players[sound] = player
        return player
    }
}
