//
//  WeatherConditionCode.swift
//  Pantopus
//
//  The weather condition vocabulary of the place-intelligence contract.
//  Its own file because the widget extension draws the living sky too and
//  compiles it (see `project.yml`); keep it Foundation-only.
//

import Foundation

/// Weather condition vocabulary. The server always ships a human
/// `condition_label`, so `.unknown` still renders — it only loses the
/// specific glyph.
public enum WeatherConditionCode: String, Sendable, Hashable {
    case clear
    case partlyCloudy = "partly_cloudy"
    case cloudy
    case fog
    case rain
    case snow
    case sleet
    case thunderstorm
    case wind
    case unknown
}

extension WeatherConditionCode: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = WeatherConditionCode(rawValue: raw) ?? .unknown
    }
}
