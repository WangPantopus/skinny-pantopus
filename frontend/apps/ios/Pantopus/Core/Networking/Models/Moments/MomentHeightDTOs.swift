//
//  MomentHeightDTOs.swift
//  Pantopus
//
//  "Show elevation" on a Moment (contract v3.8): what the phone sends with the
//  post, and the server's rules for a reading, kept here so the Post sheet
//  offers the switch only for a height the server will keep and shows the
//  number everyone will read. Beside `MomentsDTOs.swift`, which has no room.
//

import Foundation

/// `POST /api/moments` `altitude`: how high above sea level the fix, or the album photo, says the Moment was made.
/// Route backend/routes/moments.js:162.
public struct MomentAltitudeBody: Encodable, Sendable, Hashable {
    public let meters: Double
    /// How far off the phone says `meters` may be; left out when it doesn't say.
    public let accuracyM: Double?
    /// The phone's speed, which tells a flight from a mountain; left out when unknown.
    public let speedMps: Double?

    public init(meters: Double, accuracyM: Double?, speedMps: Double?) {
        self.meters = meters
        self.accuracyM = accuracyM
        self.speedMps = speedMps
    }

    private enum CodingKeys: String, CodingKey {
        case meters
        case accuracyM = "accuracy_m"
        case speedMps = "speed_mps"
    }
}

/// The server's rules for a height (`shownAltitude` in backend/services/moments/momentStore.js), mirrored.
public enum MomentHeight {
    /// The feet everyone reads for a reading, rounded to 10 as the server rounds; nil for one the server leaves out:
    /// below -500 m or above 15,000 m, or rougher than 60 m (150 m in flight, at 60 m/s or more).
    public static func feet(meters: Double, accuracyM: Double?, speedMps: Double?) -> Int? {
        guard meters.isFinite, (-500...15000).contains(meters) else { return nil }
        let flying = speedMps.map { $0.isFinite && $0 >= 60 } ?? false
        if let accuracyM, !(accuracyM.isFinite && (0...(flying ? 150 : 60)).contains(accuracyM)) { return nil }
        // Half a step rounds up, as JavaScript's Math.round does.
        return Int((meters * 3.28084 / 10 + 0.5).rounded(.down)) * 10
    }

    /// The row's second line: "4,390 ft above sea level".
    public static func line(feet: Int) -> String {
        feet < 0 ? "\((-feet).formatted()) ft below sea level" : "\(feet.formatted()) ft above sea level"
    }
}

// MARK: - A height everyone reads

/// A Moment's height as the server returns it (`altitude_ft` and `flying`, contract v3.8), on a ring (its newest
/// Moment's) and on a Moment: what the map's tag and the viewer show.
public struct MomentShownHeight: Sendable, Hashable {
    /// Feet above sea level, a multiple of 10; negative below it.
    public let feet: Int
    /// Posted in flight (60 m/s or more).
    public let flying: Bool

    public init?(feet: Int?, flying: Bool) {
        guard let feet else { return nil }
        self.feet = feet
        self.flying = flying
    }

    /// The colour that goes with the number (never colour alone).
    public var band: MomentHeightBand {
        flying ? .flying : MomentHeightBand(feet: feet)
    }

    /// The tag: "4,390 ft".
    public var text: String {
        "\(feet.formatted()) ft"
    }

    /// What VoiceOver adds to a ring: "4,390 feet above sea level", or "posted in flight at 34,000 feet".
    public var spoken: String {
        if flying { return "posted in flight at \(feet.formatted()) feet" }
        return feet < 0 ? "\((-feet).formatted()) feet below sea level" : "\(feet.formatted()) feet above sea level"
    }
}

/// The height bands of the map's key (board H2): four on the ground, and flying.
public enum MomentHeightBand: Int, CaseIterable, Sendable {
    case low, hills, mountain, peak, flying

    /// Under 500 ft; 500 to under 2,000; 2,000 to under 6,000; 6,000 and over.
    public init(feet: Int) {
        switch feet {
        case ..<500: self = .low
        case ..<2000: self = .hills
        case ..<6000: self = .mountain
        default: self = .peak
        }
    }

    /// Under its bar in the key: where the band starts.
    public var keyLabel: String {
        switch self {
        case .low: "0 ft"
        case .hills: "500"
        case .mountain: "2,000"
        case .peak: "6,000"
        case .flying: "Flying"
        }
    }

    /// What VoiceOver reads for it in the key.
    public var spoken: String {
        switch self {
        case .low: "green, under 500 feet"
        case .hills: "lime, 500 to 2,000 feet"
        case .mountain: "amber, 2,000 to 6,000 feet"
        case .peak: "rose, 6,000 feet and over"
        case .flying: "blue with a plane, posted in flight"
        }
    }
}

public extension MomentRingDTO {
    /// Its newest Moment's height; nil when it shows none.
    var shownHeight: MomentShownHeight? {
        MomentShownHeight(feet: altitudeFt, flying: flying)
    }
}

public extension MomentDTO {
    var shownHeight: MomentShownHeight? {
        MomentShownHeight(feet: altitudeFt, flying: flying)
    }
}

extension KeyedDecodingContainer {
    /// `altitude_ft`: whole feet, sent as a number (4390 and 4390.0 both read). One that can't be read only costs
    /// the height, never the ring or the Moment.
    func momentFeet(forKey key: Key) -> Int? {
        guard let feet = try? decodeIfPresent(Double.self, forKey: key), feet.isFinite, abs(feet) < 100_000 else { return nil }
        return Int(feet.rounded())
    }
}
