//
//  ReinventedTownSound.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, Listen to the town (PHASE-4 piece 7; CONTRACT 9g), as the web's: with Listen on, the
//  Pulse map plays the place sound kept with the Moment nearest its middle, and as the map is dragged across the town
//  the sound changes: the creek, the market, the game. Only what an author kept as place sound for people nearby (never
//  a voice or a whisper); the server decides which. Best with headphones, and it says so. It stops when Listen goes
//  off or the map leaves the screen.
//

import AVFoundation
import MapKit
import Observation
import SwiftUI

struct ReinventedTownSoundDTO: Decodable, Identifiable {
    let momentId: String
    let latitude: Double
    let longitude: Double
    let url: URL
    var id: String {
        momentId
    }

    private enum CodingKeys: String, CodingKey {
        case latitude, longitude, url
        case momentId = "moment_id"
    }
}

private struct ReinventedTownSoundsAnswer: Decodable {
    let sounds: [ReinventedTownSoundDTO]

    private enum CodingKeys: String, CodingKey {
        case sounds
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sounds = (try? c.decodeIfPresent(LossyList<ReinventedTownSoundDTO>.self, forKey: .sounds))?.items ?? []
    }
}

private extension ReinventedEndpoints {
    static func sounds(_ region: MKCoordinateRegion, time: String) -> Endpoint {
        let box = ReinventedMapBox(region) // inside the world, as the map's own read
        return Endpoint(
            method: .get,
            path: "/api/reinvented/sounds",
            query: [
                "south": String(format: "%.5f", box.south),
                "west": String(format: "%.5f", box.west),
                "north": String(format: "%.5f", box.north),
                "east": String(format: "%.5f", box.east),
                "time": time
            ],
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }
}

@Observable
@MainActor
final class ReinventedTownSound {
    static let shared = ReinventedTownSound()

    private(set) var listening = false
    /// The Moment whose sound plays now.
    private(set) var playing: String?
    /// None of the Moments in view kept a place sound.
    private(set) var quiet = false
    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var reading: Task<Void, Never>?

    var headphones: Bool {
        AVAudioSession.sharedInstance().currentRoute.outputs.contains { output in
            [.headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .airPlay].contains(output.portType)
        }
    }

    func toggle() {
        if listening { stop() } else { start() }
    }

    private func start() {
        listening = true
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        if let region = ReinventedLivingMap.shared.region { moved(region: region, time: ReinventedLivingMap.shared.time) }
    }

    func stop() {
        reading?.cancel()
        player?.pause()
        player = nil
        (listening, playing, quiet) = (false, nil, false)
    }

    /// The map moved (its answer came): plays the sound nearest its middle, if it isn't the one playing.
    func moved(region: MKCoordinateRegion, time: String) {
        guard listening else { return }
        reading?.cancel()
        reading = Task { [weak self] in
            let read: ReinventedTownSoundsAnswer? = try? await APIClient.shared.request(ReinventedEndpoints.sounds(region, time: time))
            guard !Task.isCancelled, let self, listening else { return }
            let middle = CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
            let nearest = (read?.sounds ?? []).min { first, second in
                middle.distance(from: CLLocation(latitude: first.latitude, longitude: first.longitude))
                    < middle.distance(from: CLLocation(latitude: second.latitude, longitude: second.longitude))
            }
            quiet = nearest == nil
            guard let nearest else {
                player?.pause()
                playing = nil
                return
            }
            guard nearest.momentId != playing else { return }
            playing = nearest.momentId
            let next = AVPlayer(url: nearest.url)
            next.actionAtItemEnd = .none
            player?.pause()
            player = next
            next.play()
        }
    }
}

/// The Listen button beside Ask the map, and what it hears.
struct ReinventedListenButton: View {
    private let town = ReinventedTownSound.shared

    var body: some View {
        Button { town.toggle() } label: {
            Icon(.volume2, size: 16, strokeWidth: 2.2, color: town.listening ? .white : Theme.Color.appText)
                .frame(width: 40, height: 40)
                .background(Circle().fill(town.listening ? Theme.Color.primarySolid : Theme.Color.appSurface))
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: town.listening ? 0 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(town.listening ? "Stop listening to the town" : "Listen to the town")
        .accessibilityIdentifier("reinventedPulse.listen")
        .onDisappear { town.stop() }
    }

    /// The line under the bar while listening.
    static var said: String? {
        let town = ReinventedTownSound.shared
        guard town.listening else { return nil }
        if town.quiet { return "No place sounds here. Move the map to listen elsewhere." }
        let hint = town.headphones ? "" : " Best with headphones."
        return (town.playing == nil ? "Listening to the town." : "Hearing the place nearest the middle.") + hint
    }
}
