//
//  MomentsStudioCompass.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, the heading that makes live beams (CONTRACT 9h): while the camera is up and the switch
//  is on for the person, the phone's compass is read, and a photo or video the camera takes now posts with the way it
//  faced (`heading`: degrees from true north, and how far off). Only for the camera's own shot with a fresh fix (the
//  Live mark's rules), only when the compass is good to 30 degrees or better, and never with the switch off; the server
//  keeps it only where it may (never at home, floating, under a made-up name or on a guess spot) and drops it otherwise.
//  No route answers it as a number. Nothing runs on a phone without a compass (the simulator) or with the switch off.
//

import CoreLocation
import Foundation

/// `heading` on `POST /api/moments` (CONTRACT 9h).
public struct MomentHeadingBody: Encodable, Sendable, Hashable {
    public let deg: Double
    public let accuracyDeg: Double

    private enum CodingKeys: String, CodingKey {
        case deg
        case accuracyDeg = "accuracy_deg"
    }
}

@MainActor
final class MomentsStudioCompass: NSObject, CLLocationManagerDelegate {
    static let shared = MomentsStudioCompass()

    private struct Reading {
        let at: Date
        let deg: Double
        let accuracy: Double
    }

    private let manager = CLLocationManager()
    private var readings: [Reading] = []
    private var watching = 0

    override init() {
        super.init()
        manager.delegate = self
        manager.headingFilter = 2
    }

    /// Reads the compass for as long as the calling task lives (the camera screen's), while the switch is on.
    func watch() async {
        guard PulseReinventedFlags.shared.isOn, CLLocationManager.headingAvailable() else { return }
        watching += 1
        if watching == 1 { manager.startUpdatingHeading() }
        defer {
            watching -= 1
            if watching == 0 { manager.stopUpdatingHeading() }
        }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(60))
        }
    }

    nonisolated func locationManager(_: CLLocationManager, didUpdateHeading heading: CLHeading) {
        let deg = heading.trueHeading >= 0 ? heading.trueHeading : heading.magneticHeading
        let accuracy = heading.headingAccuracy
        let at = heading.timestamp
        MainActor.assumeIsolated {
            guard accuracy >= 0 else { return }
            readings.append(Reading(at: at, deg: deg, accuracy: accuracy))
            readings.removeAll { $0.at < at.addingTimeInterval(-30) }
        }
    }

    /// The reading nearest `date` (within two seconds), if the compass was good to 30 degrees then.
    func heading(at date: Date) -> MomentHeadingBody? {
        guard let nearest = readings.min(by: { abs($0.at.timeIntervalSince(date)) < abs($1.at.timeIntervalSince(date)) }),
              abs(nearest.at.timeIntervalSince(date)) <= 2, nearest.accuracy <= 30 else { return nil }
        // Rounded to a tenth first, then brought under 360: a reading of 359.95 or more would otherwise go as 360.0, which
        // the server drops.
        let deg = ((nearest.deg * 10).rounded() / 10).truncatingRemainder(dividingBy: 360)
        return MomentHeadingBody(deg: deg, accuracyDeg: (nearest.accuracy * 10).rounded() / 10)
    }
}

extension MomentsComposerModel {
    /// The way the camera faced at the shot, for a photo or video the camera took now with a fresh fix, while the
    /// switch is on; nil (left out) otherwise.
    var studioHeading: MomentHeadingBody? {
        guard PulseReinventedFlags.shared.isOn, let shot = live.takenAt, capture == nil, takenAt == nil else { return nil }
        switch draft {
        case .photo, .video: return MomentsStudioCompass.shared.heading(at: shot)
        default: return nil
        }
    }
}
