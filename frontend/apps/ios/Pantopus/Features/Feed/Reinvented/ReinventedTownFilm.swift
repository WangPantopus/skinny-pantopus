//
//  ReinventedTownFilm.swift
//  Pantopus
//
//  "Tonight in <town>" ("Pulse, reinvented" phase 3, PHASE-3 piece 10; board B12; CONTRACT 8k): from 8 pm until 4 am,
//  the town's film of that day's Moments, only where a town has enough (the server's rule: 8 Moments by 4 people, each
//  shared with people nearby, still live or kept by its author). Asked only once the list's first page has come (the
//  card sits in the loaded list) and only in the evening by the reader's own clock, so nothing competes with what opens
//  the tab. The phone's position goes in the body of `POST /api/reinvented/town-film`, never an address; the server keeps
//  nothing. A tap plays the film in the Moment viewer, oldest first. Only while the switch is on. Words as the web's.
//

import Observation
import SwiftUI

/// `POST /api/reinvented/town-film`: the film, or nil where the town hasn't enough today.
struct TownFilmDTO: Decodable {
    let town: String?
    let count: Int
    let people: Int
    let moments: [MomentDTO]

    private enum CodingKeys: String, CodingKey {
        case town, count, people, moments
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        town = try? c.decodeIfPresent(String.self, forKey: .town)
        moments = ((try? c.decodeIfPresent([LenientFilmMoment].self, forKey: .moments)) ?? []).compactMap(\.value)
        count = (try? c.decodeIfPresent(Int.self, forKey: .count)) ?? moments.count
        people = (try? c.decodeIfPresent(Int.self, forKey: .people)) ?? 0
    }
}

private struct LenientFilmMoment: Decodable {
    let value: MomentDTO?

    init(from decoder: any Decoder) throws {
        value = try? MomentDTO(from: decoder)
    }
}

private struct TownFilmEnvelope: Decodable {
    let film: TownFilmDTO?
}

private struct TownFilmBody: Encodable {
    let latitude: Double
    let longitude: Double
}

/// The evening's film, read at most every 15 minutes while Pulse shows it.
@Observable
@MainActor
final class ReinventedTownFilmModel {
    static let shared = ReinventedTownFilmModel()

    private(set) var film: TownFilmDTO?
    @ObservationIgnored private var readAt: Date?

    /// From 8 pm until 4 am by the reader's own clock, when the server may have a film.
    static func evening(_ now: Date = Date()) -> Bool {
        let hour = Calendar.current.component(.hour, from: now)
        return hour >= 20 || hour < 4
    }

    func read() async {
        guard PulseReinventedFlags.shared.isOn, Self.evening() else {
            film = nil
            return
        }
        if let readAt, Date().timeIntervalSince(readAt) < 15 * 60 { return }
        guard let here = await DeviceLocationProvider.shared.requestCurrent(timeoutSeconds: 6) else { return }
        readAt = Date()
        do {
            let answer: TownFilmEnvelope = try await MomentsAPI.send(Endpoint(
                method: .post,
                path: "/api/reinvented/town-film",
                body: TownFilmBody(latitude: here.latitude, longitude: here.longitude)
            ))
            film = answer.film
        } catch {
            film = nil
            await PulseReinventedFlags.shared.recheck()
        }
    }
}

/// Over Around me's list in the evening: "Tonight in Camas · 12 Moments by 6 people today", a tap plays them.
struct ReinventedTownFilmCard: View {
    let onPlay: ([MomentRingDTO]) -> Void
    @State private var model = ReinventedTownFilmModel.shared

    /// The label the server gives a place it can't name: then the card says "around you".
    private static let unnamed = "Nearby"

    var body: some View {
        // Read by the loaded list (`ReinventedPulseList`): an empty view here would drop its own `.task`.
        if ReinventedTownFilmModel.evening(), let film = model.film, !film.moments.isEmpty {
            card(film)
        }
    }

    private func card(_ film: TownFilmDTO) -> some View {
        let town = film.town.flatMap { $0 == Self.unnamed || $0.isEmpty ? nil : $0 }
        let title = town.map { "Tonight in \($0)" } ?? "Tonight around you"
        let cover = film.moments.lazy.compactMap { $0.kind == .video ? $0.poster : $0.kind == .photo ? $0.media : nil }.first
        return Button {
            onPlay(film.moments.map { MomentRingDTO(moment: $0, mine: false) })
        } label: {
            HStack(spacing: Spacing.s3) {
                AsyncImage(url: cover) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ZStack {
                        Theme.Color.appSurfaceSunken
                        Icon(.video, size: 22, color: Theme.Color.appTextSecondary)
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .pulseFont(16, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("\(film.count) Moments by \(film.people) people today")
                        .pulseFont(13)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: 0)
                Icon(.play, size: 18, color: Theme.Color.primaryTint)
            }
            .padding(Spacing.s3)
            .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.appSurface))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .accessibilityLabel("\(title): play \(film.count) Moments from today")
        .accessibilityIdentifier("reinventedPulse.townFilm")
    }
}
