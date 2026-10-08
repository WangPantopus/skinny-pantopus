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

    /// "5:38 PM" for minutes past local midnight, in the person's own clock style.
    static func clockText(_ minutes: Double, calendar: Calendar = .autoupdatingCurrent) -> String {
        let midnight = calendar.startOfDay(for: Date())
        return midnight.addingTimeInterval(minutes * 60).formatted(date: .omitted, time: .shortened)
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

/// The "Now" reading drawn over the living sky. Touch and hold, then
/// slide, to see the hours ahead (`TodaySkyScrub.swift`).
struct TodaySkyHero: View {
    let data: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?
    /// The address calendar's upcoming dates: on the evening before a
    /// household pickup the bins stand at the curb.
    var pickups: [PlaceCalendarEvent] = []
    /// Tapping the bins shows the pickup schedule.
    var onBins: (() -> Void)?

    static let height: CGFloat = 188

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
    @State private var onScreen = true
    @State private var appeared = false
    /// The forecast hour slid to, an index into the hours ahead; nil is now.
    @State private var scrub: Int?

    private var animating: Bool {
        !reduceMotion && !lowPower && scenePhase == .active && onScreen && appeared
    }

    var body: some View {
        // The minute timeline moves the sky from day to dusk while the tab
        // stays open, even when the frame-by-frame motion is off.
        TimelineView(.everyMinute) { minute in
            let hours = SkyScrub.hours(data.hourly, after: minute.date)
            let picked = scrub.flatMap { hours.indices.contains($0) ? hours[$0] : nil }
            let nowMoment = SkyMoment.at(minute.date, sunrise: sun?.sunrise, sunset: sun?.sunset)
            let nowNote = SkyNote.pick(now: minute.date, moment: nowMoment, weather: data, pickups: pickups)
            let when = picked?.date ?? minute.date
            let shown = picked.map { SkyScrub.weather(data, at: $0) } ?? data
            let moment = picked == nil ? nowMoment : SkyMoment.at(when, sunrise: sun?.sunrise, sunset: sun?.sunset)
            let note = picked == nil ? nowNote : SkyNote.pick(now: when, moment: moment, weather: shown, pickups: pickups)
            let sky = SkyPalette.sky(moment.phase, SkyPalette.Weather(shown.conditionCode))
            ZStack(alignment: .topLeading) {
                scene(
                    SkyScene(moment: moment, weather: shown, note: note, season: SkySeason.at(when)),
                    shower: SkyNote.meteors(now: when, moment: moment, calendar: .autoupdatingCurrent) != nil
                )
                .id(picked?.date)
                .transition(.opacity)
                TodaySkyReading(
                    reading: SkyReadingModel(now: data, note: nowNote, picked: picked, at: minute.date),
                    hours: hours.count,
                    scrub: $scrub
                )
                if picked == nil, let note, !note.bins.isEmpty, let onBins { binsButton(note, action: onBins) }
                if let scrub, picked != nil { SkyScrubTrack(index: scrub, count: hours.count) }
                SkyScrubHint(hours: hours.count, scrubbing: scrub != nil)
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: picked?.date)
            // At least 188 pt; taller only if the chips have to stack on a narrow phone,
            // so the reading is never clipped. The ground stays at the bottom either way.
            .frame(maxWidth: .infinity, minHeight: Self.height)
            // Behind the crossfade between two hours, so the page never shows through.
            .background(sky.mid.color)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            // A hairline edge keeps a night sky from melting into the dark page.
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(
                SkyPalette.white.color(opacity: 0.1),
                lineWidth: 1
            ))
            .shadow(color: sky.mid.color(opacity: 0.28), radius: 14, y: 6)
            .modifier(SkyScrubGesture(scrub: $scrub, hours: hours.count, reduceMotion: reduceMotion))
        }
        .onAppear { appeared = true }
        .onDisappear { appeared = false }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
        .modifier(ScrollVisibility(onScreen: $onScreen))
        // A container, so the bins button keeps its own identifier.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("todaySkyHero")
    }

    /// What the scene shows: the moment, the weather and today's (or that
    /// hour's) note, and the season for the tree.
    private struct SkyScene {
        let moment: SkyMoment
        let weather: PlaceWeatherData
        let note: SkyNote?
        let season: SkySeason
    }

    private func scene(_ shown: SkyScene, shower: Bool) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !animating)) { frame in
            let painter = TodaySkyPainter(
                condition: shown.weather.conditionCode,
                moment: shown.moment,
                temperature: shown.weather.currentTempF,
                note: shown.note,
                season: shown.season,
                meteorShower: shower,
                still: !animating
            )
            Canvas { context, size in
                painter.paint(context, size: size, time: frame.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 86400))
            }
        }
        .accessibilityHidden(true)
    }

    /// The bins drawn at the curb, as a 44 pt button that shows the pickup schedule.
    private func binsButton(_ note: SkyNote, action: @escaping () -> Void) -> some View {
        GeometryReader { proxy in
            Button(action: action) {
                Color.clear.frame(width: 52, height: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .position(TodaySkyGround.binsCenter(in: proxy.size, count: note.bins.count))
            .accessibilityLabel(note.spoken)
            .accessibilityHint("Shows your pickup schedule.")
            .accessibilityIdentifier("todaySkyBins")
        }
    }
}

/// What the reading says: now with today's note, or the hour slid to.
struct SkyReadingModel {
    let weather: PlaceWeatherData
    /// "NOW", today's note or the hour slid to ("3 PM").
    let kicker: String
    /// A note sits on the chips' dark glass; "NOW" and an hour's time don't need it.
    let glass: Bool
    /// "Full moon tonight. Now, 60°, Overcast": one spoken reading instead of "60", "°" apart.
    let spoken: String
    /// The hour slid to, said after each VoiceOver adjustment.
    let value: String
    let chips: [String]
    let spokenChips: String

    init(now data: PlaceWeatherData, note: SkyNote?, picked: SkyScrubHour?, at now: Date) {
        let shown = picked.map { SkyScrub.weather(data, at: $0) } ?? data
        weather = shown
        kicker = picked.map { SkyScrub.kicker($0, now: now) } ?? note?.kicker ?? "NOW"
        glass = picked == nil && note != nil
        let reading = "Now, \(Int(data.currentTempF.rounded()))°"
        let current = data.conditionLabel.isEmpty ? reading : "\(reading), \(data.conditionLabel)"
        spoken = note.map { "\($0.spoken) \(current)" } ?? current
        value = picked.map { SkyScrub.spoken($0, now: now) } ?? ""
        // High/low and feels-like (or an hour's chance of rain), each in a dark glass
        // chip: they sit near the bright horizon, where white text alone can't keep 4.5:1.
        var chips: [String] = []
        var said: [String] = []
        if let hi = shown.highF, let lo = shown.lowF {
            chips.append("H \(Int(hi.rounded()))° · L \(Int(lo.rounded()))°")
            said.append("High \(Int(hi.rounded()))°, low \(Int(lo.rounded()))°")
        }
        if let picked, let chip = SkyScrub.precipChip(picked) {
            chips.append(chip)
            said.append(chip)
        } else if picked == nil, let feels = shown.feelsLikeF {
            chips.append("Feels like \(Int(feels.rounded()))°")
            said.append("feels like \(Int(feels.rounded()))°")
        }
        self.chips = chips
        spokenChips = said.joined(separator: ", ")
    }
}

/// The reading over the sky: the kicker, the temperature, the condition and
/// the chips. VoiceOver adjusts it an hour at a time.
struct TodaySkyReading: View {
    let reading: SkyReadingModel
    let hours: Int
    @Binding var scrub: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            VStack(alignment: .leading, spacing: 0) {
                // 14 pt bold (large text) in full white: it sits over the cloud deck on grey days.
                Text(reading.kicker)
                    .font(.system(size: 14, weight: .bold))
                    .kerning(0.9)
                    .background { if reading.glass { glass } }
                HStack(alignment: .top, spacing: 1) {
                    Text("\(Int(reading.weather.currentTempF.rounded()))")
                        .font(.system(size: 64, weight: .light))
                        .kerning(-2)
                        .contentTransition(.numericText(value: reading.weather.currentTempF))
                    Text("°")
                        .font(.system(size: 34, weight: .light))
                        .padding(.top, 4)
                }
                .padding(.top, -2)
                if !reading.weather.conditionLabel.isEmpty {
                    // 18 pt: large text, so 3:1 over the sky is enough (every scene clears it).
                    Text(reading.weather.conditionLabel)
                        .font(.system(size: 18, weight: .semibold))
                        .padding(.top, -4)
                }
            }
            .shadow(color: SkyPalette.black.color(opacity: 0.28), radius: 3, y: 1)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(reading.spoken)
            .modifier(HourAdjuster(hours: hours, scrub: $scrub, value: reading.value))
            if !reading.chips.isEmpty {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 6) { chipViews }
                    VStack(alignment: .leading, spacing: 4) { chipViews }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(reading.spokenChips)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .foregroundStyle(SkyPalette.white.color)
        .padding(.leading, 18)
        .padding(.top, 14)
        .padding(.trailing, 110)
        .padding(.bottom, 36)
    }

    /// A note is longer than "NOW" and can run under a bright cloud, so it
    /// sits on the chips' dark glass, drawn outside its frame so the card
    /// keeps its height.
    private var glass: some View {
        Capsule()
            .fill(SkyPalette.scrim.color(opacity: 0.45))
            .padding(.horizontal, -8)
            .padding(.vertical, -3)
    }

    private var chipViews: some View {
        ForEach(reading.chips, id: \.self) { chip in
            Text(chip)
                .font(.system(size: 13, weight: .semibold))
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(Capsule().fill(SkyPalette.scrim.color(opacity: 0.45)))
        }
    }
}

/// VoiceOver's swipe up and down move through the hours ahead; nothing to
/// adjust without an hourly forecast.
private struct HourAdjuster: ViewModifier {
    let hours: Int
    @Binding var scrub: Int?
    let value: String

    func body(content: Content) -> some View {
        if hours > 0 {
            content
                .accessibilityValue(value)
                .accessibilityHint("Swipe up or down to hear the hours ahead.")
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: scrub = min((scrub ?? -1) + 1, hours - 1)
                    case .decrement: scrub = scrub.flatMap { $0 > 0 ? $0 - 1 : nil }
                    @unknown default: break
                    }
                }
        } else {
            content
        }
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
