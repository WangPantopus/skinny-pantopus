//
//  HolidayCardVoice.swift
//  Pantopus
//
//  A card's own voice greeting (memories plan step 7, `holiday_card_memories`; wave 4 drawings 1-4): recorded here as
//  AAC-LC in MP4 (mono, about 48 kbps, the server's one format: no converter), at most a frame under 60 seconds, the
//  microphone asked for only when Record is tapped. An interruption or leaving the app stops it and keeps what was
//  recorded; it never starts again by itself. Nothing plays by itself either: the player loads the bytes on the first
//  press, through the card's reader-checked routes, and the length shown is always the server's.
//

import AVFoundation
import SwiftUI
import UIKit

/// Words for a greeting's length.
enum HolidayCardGreetingWords {
    /// "0:18", from the server's milliseconds.
    static func length(_ ms: Int?) -> String {
        let seconds = max(1, Int((Double(ms ?? 0) / 1000).rounded()))
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// "0:07", how long it has been recording.
    static func clock(_ seconds: TimeInterval) -> String {
        let whole = max(0, Int(seconds))
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }

    /// "18 seconds", for screen readers.
    static func spoken(_ ms: Int?) -> String {
        let seconds = max(1, Int((Double(ms ?? 0) / 1000).rounded()))
        if seconds < 60 { return "\(seconds) second\(seconds == 1 ? "" : "s")" }
        let rest = seconds % 60
        return "1 minute" + (rest == 0 ? "" : ", \(rest) second\(rest == 1 ? "" : "s")")
    }
}

/// Records one greeting.
@MainActor @Observable
final class HolidayCardVoiceRecorder {
    private(set) var recording = false
    private(set) var elapsed: TimeInterval = 0
    /// Why it can't record (the microphone was refused), said under the buttons.
    private(set) var refused: String?

    /// The server allows a frame or two over 60 s: stop a little before.
    static let longest: TimeInterval = 59.7

    @ObservationIgnored private var recorder: AVAudioRecorder?
    @ObservationIgnored private var ticker: Task<Void, Never>?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    @ObservationIgnored var onRecorded: ((Data) -> Void)?

    /// Record is tapped: ask for the microphone (only now), then record.
    func start() async {
        guard !recording else { return }
        refused = nil
        let allowed = await AVAudioApplication.requestRecordPermission()
        guard allowed else {
            refused = "Pantopus can’t use the microphone. You can still send the card with your note, "
                + "or allow the microphone in Settings and try again."
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("card-greeting-\(UUID().uuidString).m4a")
        // AAC-LC mono at 48 kbps (about 360 KB a minute, as the plan sizes it); 24 kHz carries a voice well and lets the
        // encoder keep to that rate.
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 24000,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 48000
        ]
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            guard recorder.record(forDuration: Self.longest) else { throw CocoaError(.fileWriteUnknown) }
            self.recorder = recorder
            recording = true
            elapsed = 0
            watch()
        } catch {
            refused = "Couldn’t start recording just now. Try again in a moment."
            try? FileManager.default.removeItem(at: url)
        }
    }

    /// Stop: the recording goes up as soon as it stops.
    func stop() {
        guard let recorder else { return }
        recorder.stop()
        finish(recorder.url)
    }

    private func watch() {
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self, let recorder else { return }
                if recorder.isRecording {
                    elapsed = recorder.currentTime
                } else {
                    // `record(forDuration:)` stopped it at the longest.
                    finish(recorder.url)
                    return
                }
            }
        }
        let center = NotificationCenter.default
        // An interruption (a call) or leaving the app stops it, keeping what was recorded; never resumed by itself.
        observers = [
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.stop() }
            },
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.stop() }
            }
        ]
    }

    private func finish(_ url: URL) {
        guard recording else { return }
        recording = false
        ticker?.cancel()
        ticker = nil
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers = []
        recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        // The clip is read into memory and its file goes: raw recordings aren't kept on the phone.
        let data = try? Data(contentsOf: url)
        try? FileManager.default.removeItem(at: url)
        if let data, !data.isEmpty { onRecorded?(data) }
    }

    func clearRefused() {
        refused = nil
    }
}

/// Plays one greeting when it's pressed: its bytes load on the first press (or come from this phone's own recording).
@MainActor @Observable
final class HolidayCardGreetingPlayer: NSObject, AVAudioPlayerDelegate {
    enum State: Equatable {
        case idle, loading, playing, failed
    }

    private(set) var state: State = .idle
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var source: CardMediaSource?
    @ObservationIgnored private var local: Data?

    var playing: Bool {
        state == .playing
    }

    /// What it plays: a card's file through its route, or this phone's own recording.
    func set(source: CardMediaSource?, local: Data? = nil) {
        guard source != self.source || local != self.local else { return }
        stop()
        player = nil
        self.source = source
        self.local = local
        state = .idle
    }

    func toggle() async {
        if state == .playing {
            player?.pause()
            state = .idle
            return
        }
        if let player {
            start(player)
            return
        }
        state = .loading
        do {
            let data = if let local { local } else if let source {
                try await HolidayCardMediaStore.shared.data(for: source)
            } else {
                Data()
            }
            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            self.player = player
            start(player)
        } catch {
            state = .failed
        }
    }

    func stop() {
        player?.stop()
        player?.currentTime = 0
        if state == .playing || state == .loading { state = .idle }
    }

    private func start(_ player: AVAudioPlayer) {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        state = player.play() ? .playing : .failed
    }

    nonisolated func audioPlayerDidFinishPlaying(_: AVAudioPlayer, successfully _: Bool) {
        Task { @MainActor in
            self.player?.currentTime = 0
            if self.state == .playing { self.state = .idle }
        }
    }
}
