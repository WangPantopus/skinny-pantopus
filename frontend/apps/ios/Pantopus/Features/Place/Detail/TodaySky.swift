//
//  TodaySky.swift
//  Pantopus
//
//  The Today tab's "Now" card as a living sky over the resident's house:
//  the sky, the sun or the moon (in its real phase), clouds, rain, snow,
//  fog, wind and storms follow the reported weather and the time of day at
//  this address. The numbers sit on top, read exactly as before.
//
//  Motion is decoration, so it stops for Reduce Motion, Low Power Mode,
//  an inactive app and a card scrolled out of view; the still picture
//  carries the same scene. Parity twin of Android's `TodaySky.kt`.
//

import SwiftUI

// MARK: - Moment (time of day, sun and moon)

/// Where the day is at this address: phase, how far the sun has
/// travelled, and the moon's phase.
struct SkyMoment: Equatable {
    let phase: SkyPalette.Phase
    /// 0 at sunrise, 1 at sunset, clamped.
    let dayFraction: Double
    /// 11 pm to 5 am: only one window stays lit.
    let lateNight: Bool
    /// 0 new moon, 0.5 full, back toward 1 at the next new moon.
    let moonPhase: Double
    /// Minutes past local midnight now, at sunrise and at sunset.
    let minutes: Double
    let sunrise: Double
    let sunset: Double

    /// Sunrise and sunset arrive as local wall-clock times ("2026-10-07T07:15")
    /// and can be a day old just after midnight; only their clock times are
    /// used, which drift by a couple of minutes a day.
    static func at(_ now: Date, sunrise: String?, sunset: String?, calendar: Calendar = .autoupdatingCurrent) -> SkyMoment {
        let parts = calendar.dateComponents([.hour, .minute, .second], from: now)
        let minutes = Double(parts.hour ?? 12) * 60 + Double(parts.minute ?? 0) + Double(parts.second ?? 0) / 60
        var rise = clockMinutes(sunrise, calendar: calendar) ?? 390
        var set = clockMinutes(sunset, calendar: calendar) ?? 1110
        if set <= rise {
            rise = 390
            set = 1110
        }
        let phase: SkyPalette.Phase = if minutes >= rise - 30, minutes < rise + 40 {
            .dawn
        } else if minutes >= rise + 40, minutes < set - 40 {
            .day
        } else if minutes >= set - 40, minutes < set + 30 {
            .dusk
        } else {
            .night
        }
        return SkyMoment(
            phase: phase,
            dayFraction: min(max((minutes - rise) / (set - rise), 0), 1),
            lateNight: minutes >= 23 * 60 || minutes < 5 * 60,
            moonPhase: moonPhase(at: now),
            minutes: minutes,
            sunrise: rise,
            sunset: set
        )
    }

    /// Minutes past midnight of a sunrise/sunset string. A bare wall-clock
    /// time is taken as written; a zoned instant is read in the local zone.
    static func clockMinutes(_ raw: String?, calendar: Calendar = .autoupdatingCurrent) -> Double? {
        guard let raw, let tee = raw.firstIndex(of: "T") else { return nil }
        let clock = raw[raw.index(after: tee)...]
        let zoned = clock.contains("Z") || clock.contains("+") || clock.dropFirst(5).contains("-")
        if zoned, let date = PlacePresentation.parseISO(raw) {
            let parts = calendar.dateComponents([.hour, .minute], from: date)
            return Double(parts.hour ?? 0) * 60 + Double(parts.minute ?? 0)
        }
        let fields = clock.prefix(5).split(separator: ":")
        guard fields.count == 2, let hour = Double(fields[0]), let minute = Double(fields[1]),
              (0..<24).contains(hour), (0..<60).contains(minute) else { return nil }
        return hour * 60 + minute
    }

    /// The moon's age as a fraction of the 29.53-day synodic month, from the
    /// new moon of 6 January 2000 (Julian day 2451550.1).
    static func moonPhase(at date: Date) -> Double {
        let julianDay = date.timeIntervalSince1970 / 86400 + 2_440_587.5
        let cycles = (julianDay - 2_451_550.1) / 29.530588853
        let fraction = cycles - cycles.rounded(.down)
        return fraction < 0 ? fraction + 1 : fraction
    }
}

extension SkyPalette.Weather {
    init(_ code: WeatherConditionCode) {
        switch code {
        case .clear, .wind: self = .clear
        case .partlyCloudy: self = .partly
        case .cloudy, .unknown: self = .overcast
        case .fog: self = .fog
        case .rain, .sleet: self = .wet
        case .snow: self = .snow
        case .thunderstorm: self = .storm
        }
    }
}

// MARK: - The hero card

/// The "Now" reading drawn over the living sky.
struct TodaySkyHero: View {
    let data: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?

    static let height: CGFloat = 188

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
    @State private var onScreen = true
    @State private var appeared = false

    private var animating: Bool {
        !reduceMotion && !lowPower && scenePhase == .active && onScreen && appeared
    }

    /// "Now, 60°, Overcast": one spoken reading instead of "60", "°" apart.
    private var nowLabel: String {
        let reading = "Now, \(Int(data.currentTempF.rounded()))°"
        return data.conditionLabel.isEmpty ? reading : "\(reading), \(data.conditionLabel)"
    }

    private var rangeLabel: String {
        var parts: [String] = []
        if let hi = data.highF, let lo = data.lowF {
            parts.append("High \(Int(hi.rounded()))°, low \(Int(lo.rounded()))°")
        }
        if let feels = data.feelsLikeF { parts.append("feels like \(Int(feels.rounded()))°") }
        return parts.joined(separator: ", ")
    }

    private var rangeText: String {
        var parts: [String] = []
        if let hi = data.highF, let lo = data.lowF {
            parts.append("H \(Int(hi.rounded()))° · L \(Int(lo.rounded()))°")
        }
        if let feels = data.feelsLikeF { parts.append("Feels like \(Int(feels.rounded()))°") }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        // The minute timeline moves the sky from day to dusk while the tab
        // stays open, even when the frame-by-frame motion is off.
        TimelineView(.everyMinute) { minute in
            let moment = SkyMoment.at(minute.date, sunrise: sun?.sunrise, sunset: sun?.sunset)
            let sky = SkyPalette.sky(moment.phase, SkyPalette.Weather(data.conditionCode))
            ZStack(alignment: .topLeading) {
                scene(moment: moment)
                reading
            }
            .frame(maxWidth: .infinity)
            .frame(height: Self.height)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            // A hairline edge keeps a night sky from melting into the dark page.
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(
                SkyPalette.white.color(opacity: 0.1),
                lineWidth: 1
            ))
            .shadow(color: sky.mid.color(opacity: 0.28), radius: 14, y: 6)
        }
        .onAppear { appeared = true }
        .onDisappear { appeared = false }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
        .modifier(ScrollVisibility(onScreen: $onScreen))
        .accessibilityIdentifier("todaySkyHero")
    }

    private func scene(moment: SkyMoment) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !animating)) { frame in
            let painter = TodaySkyPainter(
                condition: data.conditionCode,
                moment: moment,
                cold: data.currentTempF < 50,
                still: !animating
            )
            Canvas { context, size in
                painter.paint(context, size: size, time: frame.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 86400))
            }
        }
        .accessibilityHidden(true)
    }

    private var reading: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text("NOW")
                    .font(.system(size: 12, weight: .bold))
                    .kerning(0.9)
                    .opacity(0.86)
                HStack(alignment: .top, spacing: 1) {
                    Text("\(Int(data.currentTempF.rounded()))")
                        .font(.system(size: 64, weight: .light))
                        .kerning(-2)
                    Text("°")
                        .font(.system(size: 34, weight: .light))
                        .padding(.top, 4)
                }
                .padding(.top, -2)
                if !data.conditionLabel.isEmpty {
                    Text(data.conditionLabel)
                        .font(.system(size: 17, weight: .semibold))
                        .padding(.top, -4)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(nowLabel)
            if !rangeText.isEmpty {
                Text(rangeText)
                    .font(.system(size: 13.5, weight: .medium))
                    .opacity(0.9)
                    .padding(.top, 3)
                    .accessibilityLabel(rangeLabel)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .foregroundStyle(SkyPalette.white.color)
        .shadow(color: SkyPalette.black.color(opacity: 0.28), radius: 3, y: 1)
        .padding(.leading, 18)
        .padding(.top, 14)
        .padding(.trailing, 120)
    }
}

/// Stops the sky's motion while the card is scrolled out of view (iOS 18+).
private struct ScrollVisibility: ViewModifier {
    @Binding var onScreen: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollVisibilityChange(threshold: 0.05) { onScreen = $0 }
        } else {
            content
        }
    }
}
