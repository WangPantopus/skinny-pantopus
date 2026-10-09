//
//  TodayWidgetSnapshot.swift
//  Pantopus
//
//  Shared contract between the app and the "Today at your address" widget
//  (`PantopusWidgets/TodayWidget.swift`). The widget never fetches: the app
//  writes this snapshot of the Today tab's last load into the shared App
//  Group, and the widget draws the living sky and one useful line from it.
//  Compiled into BOTH targets (see `project.yml`); keep it Foundation-only.
//

import Foundation

/// What the Today tab last showed for the person's own place.
public struct TodayWidgetSnapshot: Codable, Sendable, Equatable {
    /// When the Today tab loaded; drives staleness.
    public let generatedAt: Date
    /// The street, never the house number ("Larkspur Loop"): the widget sits
    /// on a home screen anyone nearby can see.
    public let placeLabel: String
    public let weather: Weather?
    public let sun: Sun?
    public let air: Air?
    /// The next two weeks' dates at this address, as the Today tab showed them.
    public let dates: [DateItem]

    public init(generatedAt: Date, placeLabel: String, weather: Weather?, sun: Sun?, air: Air?, dates: [DateItem]) {
        self.generatedAt = generatedAt
        self.placeLabel = placeLabel
        self.weather = weather
        self.sun = sun
        self.air = air
        self.dates = Array(dates.prefix(TodayWidgetSnapshotContract.maxDates))
    }

    public struct Weather: Codable, Sendable, Equatable {
        public let tempF: Double
        /// `WeatherConditionCode` raw value ("partly_cloudy").
        public let condition: String
        /// "Mostly Clear".
        public let label: String
        public let highF: Double?
        public let lowF: Double?
        /// Sustained wind, mph, and where it blows from ("SW"), so the widget's
        /// trees lean too; nil in older snapshots.
        public let windMph: Double?
        public let windDirection: String?

        public init(
            tempF: Double,
            condition: String,
            label: String,
            highF: Double?,
            lowF: Double?,
            windMph: Double? = nil,
            windDirection: String? = nil
        ) {
            self.tempF = tempF
            self.condition = condition
            self.label = label
            self.highF = highF
            self.lowF = lowF
            self.windMph = windMph
            self.windDirection = windDirection
        }
    }

    /// Local wall-clock times, as the place-intelligence contract sends them.
    public struct Sun: Codable, Sendable, Equatable {
        public let sunrise: String?
        public let sunset: String?

        public init(sunrise: String?, sunset: String?) {
            self.sunrise = sunrise
            self.sunset = sunset
        }
    }

    public struct Air: Codable, Sendable, Equatable {
        public let aqi: Int
        /// "Good", "Unhealthy for sensitive groups", …
        public let label: String
        public let source: String?
        /// Fine particles lead it (in the Northwest, wildfire smoke); nil in older snapshots.
        public let smoky: Bool?

        public init(aqi: Int, label: String, source: String?, smoky: Bool? = nil) {
            self.aqi = aqi
            self.label = label
            self.source = source
            self.smoky = smoky
        }
    }

    public struct DateItem: Codable, Sendable, Equatable, SkyPickupDate {
        /// "garbage", "recycling", "yard_waste", "bill", …
        public let kind: String
        public let title: String
        /// YYYY-MM-DD, the home's local date.
        public let date: String
        /// "home" for what the household set itself.
        public let scope: String

        public init(kind: String, title: String, date: String, scope: String) {
            self.kind = kind
            self.title = title
            self.date = date
            self.scope = scope
        }
    }
}

/// Storage constants and (de)coding shared by the writer and the widget.
public enum TodayWidgetSnapshotContract {
    public static let snapshotKey = "todaySnapshotV1"
    public static let widgetKind = "TodayWidget"
    /// Older than this, the widget asks to open the app instead.
    public static let stalenessSeconds: TimeInterval = 6 * 60 * 60
    public static let maxDates = 20

    public static func encode(_ snapshot: TodayWidgetSnapshot) -> Data? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(snapshot)
    }

    public static func decode(_ data: Data) -> TodayWidgetSnapshot? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(TodayWidgetSnapshot.self, from: data)
    }

    public static func load(
        defaults: UserDefaults? = UserDefaults(suiteName: GigWidgetSnapshotContract.appGroupId)
    ) -> TodayWidgetSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        return decode(data)
    }

    public static func isFresh(_ snapshot: TodayWidgetSnapshot, now: Date = Date()) -> Bool {
        now.timeIntervalSince(snapshot.generatedAt) < stalenessSeconds
    }

    /// "12 Larkspur Loop" → "Larkspur Loop": the street without the number.
    public static func streetOnly(_ line: String) -> String {
        let words = line.split(separator: " ")
        guard let first = words.first, first.first?.isNumber == true, words.count > 1 else { return line }
        return words.dropFirst().joined(separator: " ")
    }
}
