//
//  TodayWidgetSnapshot+Intel.swift
//  Pantopus
//
//  Builds the "Today at your address" widget's snapshot from what the
//  Today tab just loaded: the weather, sun and air sections it showed and
//  the address calendar's upcoming dates (live, or the fallback load).
//  Only the street name goes in, never the house number.
//

import Foundation

extension TodayWidgetSnapshot {
    @MainActor
    init(intel: PlaceIntelligence, viewModel: PlaceDetailViewModel, now: Date = Date()) {
        let live: (PlaceSectionEnvelope?) -> PlaceSectionEnvelope? = { section in
            section.flatMap { $0.status == .ready || $0.status == .stale ? $0 : nil }
        }
        let weather = live(viewModel.section(.weather, in: intel))?.weather
        let airSection = live(viewModel.section(.airQuality, in: intel))
        let sun = viewModel.section(.sunriseSunset, in: intel)?.sunriseSunset
        var events = viewModel.fallbackCalendar?.upcoming ?? []
        if let calendar = viewModel.section(.addressCalendar, in: intel), let data = calendar.addressCalendar,
           [.ready, .stale, .partial].contains(calendar.status) {
            events = data.upcoming
        }
        let street = intel.place.line1.trimmingCharacters(in: .whitespaces)
        self.init(
            generatedAt: now,
            placeLabel: street.isEmpty ? intel.place.city : TodayWidgetSnapshotContract.streetOnly(street),
            weather: weather.map {
                Weather(
                    tempF: $0.currentTempF,
                    condition: $0.conditionCode.rawValue,
                    label: $0.conditionLabel,
                    highF: $0.highF,
                    lowF: $0.lowF,
                    windMph: $0.windMph,
                    windDirection: $0.windDirection
                )
            },
            sun: sun.map { Sun(sunrise: $0.sunrise, sunset: $0.sunset) },
            air: airSection?.airQuality.map {
                Air(aqi: $0.index, label: $0.categoryLabel, source: airSection?.source, smoky: $0.dominantPollutant == "pm25")
            },
            dates: events.map { DateItem(kind: $0.kind, title: $0.title, date: $0.date, scope: $0.scope) }
        )
    }
}
