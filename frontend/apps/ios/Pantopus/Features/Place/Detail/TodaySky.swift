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

// MARK: - The hero card

/// The "Now" reading drawn over the living sky. Touch and hold, then
/// slide, to see the hours ahead (`TodaySkyScrub.swift`).
struct TodaySkyHero: View {
    let data: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?
    /// The address calendar's upcoming dates: on the evening before a
    /// household pickup the bins stand at the curb.
    var pickups: [PlaceCalendarEvent] = []
    /// The air reading: smoke veils the sky, and bad air leads the card.
    var air: SkyAir?
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
            let nowNote = SkyNote.pick(now: minute.date, moment: nowMoment, weather: data, pickups: pickups, air: air)
            let when = picked?.date ?? minute.date
            let shown = picked.map { SkyScrub.weather(data, at: $0) } ?? data
            let moment = picked == nil ? nowMoment : SkyMoment.at(when, sunrise: sun?.sunrise, sunset: sun?.sunset)
            let note = picked == nil ? nowNote : SkyNote.pick(now: when, moment: moment, weather: shown, pickups: pickups, air: air)
            let sky = SkyPalette.sky(moment.phase, SkyPalette.Weather(shown.conditionCode))
            // A new hour, phase or kind of weather crossfades in.
            let key = SceneKey(hour: picked?.date, phase: moment.phase, sky: SkyPalette.Weather(shown.conditionCode))
            ZStack(alignment: .topLeading) {
                scene(
                    SkyScene(
                        moment: moment,
                        weather: shown,
                        note: note,
                        season: SkySeason.at(when),
                        rain: SkyScrub.rain(data.hourly, at: when)
                    ),
                    shower: SkyNote.meteors(now: when, moment: moment, calendar: .autoupdatingCurrent) != nil
                )
                .id(key)
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
            .animation(reduceMotion ? nil : .easeInOut(duration: picked == nil ? 0.6 : 0.18), value: key)
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
        /// 0...1, from the forecast hour's chance of rain.
        let rain: Double
    }

    private struct SceneKey: Hashable {
        let hour: Date?
        let phase: SkyPalette.Phase
        let sky: SkyPalette.Weather
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
                smoke: air?.smoke ?? 0,
                rain: shown.rain,
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
