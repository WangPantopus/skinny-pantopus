//
//  SkyShareCard.swift
//  Pantopus
//
//  "Share today's sky": the Now card's living sky as a picture to send,
//  with the temperature, the condition, the city and the date. Only the
//  city, never the street or the house; no bins or neighbours' lights
//  either. Drawn when someone shares, not before. Parity twin of
//  Android's `SkyShareCard.kt`.
//

import SwiftUI
import UniformTypeIdentifiers

/// What the shared picture shows.
struct SkyShareCard: Transferable {
    let weather: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?
    let air: SkyAir?
    let city: String
    let date: Date

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { card in
            try await card.png()
        }
        .suggestedFileName("Today's sky.png")
    }

    @MainActor
    func png() throws -> Data {
        let renderer = ImageRenderer(content: SkyShareCardView(card: self))
        renderer.scale = 3
        guard let data = renderer.uiImage?.pngData() else { throw CocoaError(.fileWriteUnknown) }
        return data
    }

    /// The card's line: a sky note when there is one worth sharing (not the
    /// household's pickup day), otherwise "TODAY".
    func kicker(_ moment: SkyMoment) -> String {
        let note = SkyNote.pick(now: date, moment: moment, weather: weather, pickups: [], air: air)
        return note?.kicker ?? "TODAY"
    }
}

/// The picture: 360 × 450 points (1080 × 1350 pixels), the sky filling it.
struct SkyShareCardView: View {
    let card: SkyShareCard

    var body: some View {
        let moment = SkyMoment.at(card.date, sunrise: card.sun?.sunrise, sunset: card.sun?.sunset)
        ZStack(alignment: .topLeading) {
            Canvas { context, size in
                TodaySkyPainter(
                    condition: card.weather.conditionCode,
                    moment: moment,
                    temperature: card.weather.currentTempF,
                    note: nil,
                    season: SkySeason.at(card.date),
                    meteorShower: SkyNote.meteors(now: card.date, moment: moment, calendar: .autoupdatingCurrent) != nil,
                    smoke: card.air?.smoke ?? 0,
                    windMph: card.weather.windMph,
                    windFrom: card.weather.windDirection,
                    still: true
                ).paint(context, size: size, time: 0)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(card.kicker(moment))
                    .font(.system(size: 17, weight: .bold))
                    .kerning(1)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(SkyPalette.scrim.color(opacity: 0.45)))
                Text("\(Int(card.weather.currentTempF.rounded()))°")
                    .font(.system(size: 112, weight: .light))
                    .kerning(-4)
                    .padding(.top, 2)
                if !card.weather.conditionLabel.isEmpty {
                    Text(card.weather.conditionLabel)
                        .font(.system(size: 26, weight: .semibold))
                        .padding(.top, -10)
                }
                Spacer(minLength: 0)
                Text("\(card.city) · \(card.date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))")
                    .font(.system(size: 17, weight: .semibold))
                Text("Pantopus")
                    .font(.system(size: 13, weight: .bold))
                    .kerning(0.6)
                    .opacity(0.85)
                    .padding(.top, 2)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(SkyPalette.white.color)
            .shadow(color: SkyPalette.black.color(opacity: 0.35), radius: 4, y: 1)
            .padding(.horizontal, 26)
            .padding(.top, 28)
            .padding(.bottom, 22)
        }
        .frame(width: 360, height: 450)
    }
}

/// The Weather section's trailing link: shares the sky as a picture.
struct SkyShareLink: View {
    let card: SkyShareCard

    var body: some View {
        ShareLink(item: card, preview: SharePreview("Today in \(card.city)")) {
            HStack(spacing: 4) {
                Icon(.share, size: 13, strokeWidth: 2.2, color: Theme.Color.primaryInk)
                Text("Share")
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.primaryInk)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .accessibilityLabel("Share today's sky")
        .accessibilityIdentifier("todaySkyShare")
    }
}
