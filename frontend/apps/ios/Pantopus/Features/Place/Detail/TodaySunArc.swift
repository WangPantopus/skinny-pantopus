//
//  TodaySunArc.swift
//  Pantopus
//
//  The Sun card, right under the weather on Today: the sun's path from
//  sunrise to sunset over a small sky in the weather picture's colours
//  (blue by day, peach at dawn, orange-pink at dusk, deep navy with stars
//  at night). The sun glows where it is now (it travels there when the
//  card appears) and the stretch it has covered is lit in gold; by night
//  it waits half below the horizon, and the moon shows its real phase and
//  name. How long until the next sunrise or sunset leads; the times and
//  the day's length read as before. Parity twin of Android's `TodaySunArc.kt`.
//

import SwiftUI

struct TodaySunArcCard: View {
    let data: PlaceSunriseSunsetData
    var calendar: Calendar = .autoupdatingCurrent
    /// The reported weather, so the little sky matches the big one above it.
    var weather: WeatherConditionCode?

    var body: some View {
        TimelineView(.everyClockMinute) { minute in
            TodaySunArcContent(
                data: data,
                moment: SkyMoment.at(minute.date, sunrise: data.sunriseClock, sunset: data.sunsetClock, calendar: calendar),
                now: minute.date,
                day: PlacePresentation.fmtSunDay(data, timeZone: calendar.timeZone, now: minute.date),
                weather: weather.map { SkyPalette.Weather($0) } ?? .clear
            )
        }
        .accessibilityIdentifier("todaySunArc")
    }
}

private struct TodaySunArcContent: View {
    let data: PlaceSunriseSunsetData
    let moment: SkyMoment
    let now: Date
    /// "today", or "as of Nov 1" for another day's times.
    let day: String?
    let weather: SkyPalette.Weather

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var travelled = 0.0

    /// The times are today's at the place: only then does a countdown make sense.
    private var isToday: Bool {
        day == "today"
    }

    private var up: Bool {
        moment.minutes >= moment.sunrise && moment.minutes <= moment.sunset
    }

    private var sky: SkyPalette.Sky {
        SkyPalette.sky(moment.phase, weather)
    }

    /// Where the sun rests: along the path by day; through dusk where it
    /// set; the rest of the night where it will rise.
    private var target: Double {
        if up { return moment.dayFraction }
        return moment.minutes > moment.sunset && moment.phase == .dusk ? 1 : 0
    }

    private var daylight: String {
        "\(data.daylightMinutes / 60)h \(data.daylightMinutes % 60)m"
    }

    /// ("Sunset in", "3h 10m") by day; ("Sunrise in", "5h 54m") by night;
    /// nil for another day's times. Counted between instants when the server
    /// sends them, so the repeated hour the night the clocks go back counts once.
    private var countdown: (label: String, span: String)? {
        guard isToday else { return nil }
        let minutesLeft: Double
        if let rise = data.sunriseUtc.flatMap(SkyMoment.instant), let set = data.sunsetUtc.flatMap(SkyMoment.instant) {
            let target = now < rise ? rise : (now <= set ? set : rise.addingTimeInterval(86400))
            minutesLeft = target.timeIntervalSince(now) / 60
        } else {
            minutesLeft = up ? moment.sunset - moment.minutes
                : (moment.minutes < moment.sunrise ? moment.sunrise - moment.minutes : moment.sunrise + 1440 - moment.minutes)
        }
        let whole = max(Int(minutesLeft.rounded()), 1)
        let span = whole >= 60 ? "\(whole / 60)h \(whole % 60)m" : "\(whole)m"
        return (up ? "Sunset in" : "Sunrise in", span)
    }

    /// Dark ink on a light sky, white on a dark one, read where the words sit.
    private var ink: SkyRGB {
        sky.mid.mixed(with: sky.bottom, by: 0.45).luminance > 0.5 ? SkyPalette.scrim : SkyPalette.white
    }

    var body: some View {
        PlaceDetailCard(padding: 16) {
            VStack(spacing: 14) {
                dial
                times
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
        .onAppear { move(to: target) }
        .onChange(of: target) { _, value in move(to: value) }
    }

    private var spoken: String {
        let next = countdown.map { " \($0.label) \($0.span)." } ?? ""
        let moon = moment.phase == .night ? " \(MoonPhase.spoken(moment.moonPhase))." : ""
        return "Sunrise \(clock(moment.sunrise)), sunset \(clock(moment.sunset)), \(data.daylightMinutes / 60) hours "
            + "\(data.daylightMinutes % 60) minutes of daylight." + next + moon
    }

    // MARK: The little sky

    private var dial: some View {
        ZStack {
            SunDome()
                .fill(LinearGradient(
                    stops: [
                        .init(color: sky.top.color, location: 0),
                        .init(color: sky.mid.color, location: 0.5),
                        .init(color: sky.bottom.color, location: 1)
                    ],
                    startPoint: UnitPoint(x: 0.5, y: SunArcGeometry.peakInset / SunArcGeometry.height),
                    endPoint: UnitPoint(x: 0.5, y: 1 - SunArcGeometry.horizonInset / SunArcGeometry.height)
                ))
            if moment.phase == .night { SunDomeStars() }
            SunArcPath(progress: 1)
                .stroke(SkyPalette.white.color(opacity: 0.55), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [2, 5]))
            SunArcPath(progress: travelled)
                .stroke(
                    LinearGradient(colors: [SkyPalette.sunLow.color, SkyPalette.sunHigh.color], startPoint: .leading, endPoint: .trailing),
                    style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                )
                .shadow(color: SkyPalette.sunLow.color(opacity: 0.8), radius: 5)
            SunArcHorizon()
                .stroke(Theme.Color.appBorder, lineWidth: 1)
            horizonMark(0)
            horizonMark(1)
            if moment.phase == .night { moon }
            sunMarker
            reading
        }
        .frame(height: SunArcGeometry.height)
    }

    /// Where the sun comes up and goes down.
    private func horizonMark(_ fraction: Double) -> some View {
        Circle()
            .fill(SkyPalette.sunLow.color)
            .frame(width: 7, height: 7)
            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 1.5))
            .modifier(SunArcPosition(fraction: fraction))
    }

    /// A glowing disc by day; by night a dimmer one, half below the horizon.
    private var sunMarker: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [SkyPalette.sunHigh.color(opacity: up ? 0.6 : 0.35), SkyPalette.sunLow.color(opacity: 0)],
                    center: .center,
                    startRadius: 6,
                    endRadius: up ? 26 : 18
                ))
                .frame(width: 52, height: 52)
            Circle()
                .fill(RadialGradient(
                    colors: [SkyPalette.white.color, SkyPalette.sunHigh.color, SkyPalette.sunLow.color],
                    center: UnitPoint(x: 0.4, y: 0.35),
                    startRadius: 0,
                    endRadius: 11
                ))
                .frame(width: 20, height: 20)
                .overlay(Circle().strokeBorder(SkyPalette.white.color(opacity: 0.9), lineWidth: 1.5))
                .opacity(up ? 1 : 0.85)
        }
        .modifier(SunArcPosition(fraction: travelled))
        .mask { SunVisibleArea(clipsAtHorizon: !up) }
    }

    private var moon: some View {
        HStack(spacing: 7) {
            ZStack {
                Circle().fill(SkyPalette.white.color(opacity: 0.14))
                MoonShape(phase: moment.moonPhase).fill(SkyPalette.moon.color)
            }
            .frame(width: 18, height: 18)
            .background(Circle().fill(SkyPalette.moonGlow.color(opacity: 0.3)).frame(width: 30, height: 30).blur(radius: 6))
            Text(MoonPhase.name(moment.moonPhase))
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(SkyPalette.white.color(opacity: 0.85))
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(.top, 38)
    }

    /// The countdown in the middle of the sky; the day's length for another day's times.
    private var reading: some View {
        VStack(spacing: 0) {
            Text(countdown?.label ?? "Daylight")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(ink.color(opacity: 0.8))
            Text(countdown?.span ?? daylight)
                .font(.system(size: 27, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(ink.color)
        }
        .shadow(color: ink == SkyPalette.white ? SkyPalette.scrim.color(opacity: 0.35) : .clear, radius: 3, y: 1)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, SunArcGeometry.horizonInset + 10)
    }

    // MARK: Times

    private var times: some View {
        HStack(alignment: .top, spacing: 8) {
            sunTime(icon: .sunrise, label: "Sunrise", minutes: moment.sunrise, alignment: .leading)
            Spacer(minLength: 0)
            VStack(spacing: 3) {
                if isToday {
                    Text("Daylight")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(daylight)
                        .font(.system(size: 15, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else if let day {
                    Text(day)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.warning)
                }
            }
            Spacer(minLength: 0)
            sunTime(icon: .sunset, label: "Sunset", minutes: moment.sunset, alignment: .trailing)
        }
    }

    private func sunTime(icon: PantopusIcon, label: String, minutes: Double, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 3) {
            HStack(spacing: 4) {
                Icon(icon, size: 15, strokeWidth: 2, color: Theme.Color.warning)
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text(clock(minutes))
                .font(.system(size: 17, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
        }
    }

    private func clock(_ minutes: Double) -> String {
        SkyMoment.clockText(minutes)
    }

    /// Forward along the path; never backwards (night to the sunrise side snaps).
    private func move(to value: Double) {
        if reduceMotion || value < travelled {
            travelled = value
        } else {
            withAnimation(.spring(duration: 1.2, bounce: 0.15)) { travelled = value }
        }
    }
}

// MARK: - Moon

/// The moon's phase in words, from its age in the synodic month.
enum MoonPhase {
    static func name(_ phase: Double) -> String {
        switch phase {
        case ..<0.03: "New moon"
        case ..<0.22: "Waxing crescent"
        case ..<0.28: "First quarter"
        case ..<0.47: "Waxing gibbous"
        case ..<0.53: "Full moon"
        case ..<0.72: "Waning gibbous"
        case ..<0.78: "Last quarter"
        case ..<0.97: "Waning crescent"
        default: "New moon"
        }
    }

    /// The name as VoiceOver reads it: "Last quarter moon", "Full moon".
    static func spoken(_ phase: Double) -> String {
        let label = name(phase)
        return label.hasSuffix("moon") ? label : "\(label) moon"
    }
}

/// The lit part of the moon for its phase.
struct MoonShape: Shape {
    let phase: Double

    func path(in rect: CGRect) -> Path {
        TodaySkyPainter.moonPath(center: CGPoint(x: rect.midX, y: rect.midY), radius: min(rect.width, rect.height) / 2, phase: phase)
    }
}

// MARK: - Arc geometry

/// The path spans the card: the horizon 14 pt above the bottom, the peak 18 pt from the top.
private enum SunArcGeometry {
    static let height: CGFloat = 140
    static let horizonInset: CGFloat = 14
    static let peakInset: CGFloat = 18

    static func horizon(_ rect: CGRect) -> Double {
        Double(rect.maxY - horizonInset)
    }

    static func radii(_ rect: CGRect) -> (x: Double, y: Double) {
        (Double(rect.width) / 2 - 24, horizon(rect) - Double(rect.minY + peakInset))
    }

    static func point(_ fraction: Double, in rect: CGRect) -> CGPoint {
        // Doubles throughout: mixing CGFloat into cos/sin is ambiguous for Xcode 16's compiler.
        let theta = Double.pi * (1 - min(max(fraction, 0), 1))
        let axes = radii(rect)
        return CGPoint(x: Double(rect.midX) + axes.x * cos(theta), y: horizon(rect) - axes.y * sin(theta))
    }
}

private struct SunArcPath: Shape {
    var progress: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let steps = max(Int(60 * min(max(progress, 0), 1)), 1)
        for step in 0...steps {
            let point = SunArcGeometry.point(progress * Double(step) / Double(steps), in: rect)
            if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        return progress <= 0 ? Path() : path
    }
}

/// The sky under the sun's path, closed along the horizon.
private struct SunDome: Shape {
    func path(in rect: CGRect) -> Path {
        var path = SunArcPath(progress: 1).path(in: rect)
        path.closeSubpath()
        return path
    }
}

private struct SunArcHorizon: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + 4, y: SunArcGeometry.horizon(rect)))
        path.addLine(to: CGPoint(x: rect.maxX - 4, y: SunArcGeometry.horizon(rect)))
        return path
    }
}

/// Where the sun may show, with room for its glow: above the horizon at
/// night (it waits half below it), everywhere by day.
private struct SunVisibleArea: Shape {
    let clipsAtHorizon: Bool

    func path(in rect: CGRect) -> Path {
        let bottom = clipsAtHorizon ? CGFloat(SunArcGeometry.horizon(rect)) : rect.maxY + 40
        return Path(CGRect(x: rect.minX - 40, y: rect.minY - 40, width: rect.width + 80, height: bottom - rect.minY + 40))
    }
}

private extension SkyRGB {
    /// How light the colour looks, 0 (black) to 1 (white).
    var luminance: Double {
        0.2126 * red + 0.7152 * green + 0.0722 * blue
    }
}

/// Night stars inside the sky, clear of the moon and the countdown; always in the same places.
private struct SunDomeStars: View {
    var body: some View {
        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size)
            let horizon = SunArcGeometry.horizon(rect)
            let radii = SunArcGeometry.radii(rect)
            let middle = Double(rect.midX)
            var random = SkyRandom(seed: 23)
            for index in 0..<34 {
                let across = random.next() * 1.84 - 0.92
                let rise = 0.3 + random.next() * 0.62
                let radius = 0.5 + random.next() * 0.85
                let alpha = 0.4 + random.next() * 0.55
                let x = middle + across * radii.x
                let y = horizon - radii.y * (1 - across * across).squareRoot() * rise
                // Keep the moon's line and the countdown clear.
                let nearMoon = abs(x - middle) < 76 && y < 66 && y > 28
                let nearCountdown = abs(x - middle) < 62 && y > horizon - 66
                if nearMoon || nearCountdown { continue }
                let star = Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                context.fill(star, with: .color(SkyPalette.white.color(opacity: alpha)))
                // A few brighter ones sparkle.
                if index % 9 == 4 { context.fill(Self.sparkle(x, y, 3.6), with: .color(SkyPalette.white.color(opacity: alpha * 0.8))) }
            }
        }
        .allowsHitTesting(false)
    }

    /// A four-pointed glint.
    private static func sparkle(_ x: Double, _ y: Double, _ size: Double) -> Path {
        var path = Path()
        let waist = size * 0.22
        path.move(to: CGPoint(x: x, y: y - size))
        path.addLine(to: CGPoint(x: x + waist, y: y - waist))
        path.addLine(to: CGPoint(x: x + size, y: y))
        path.addLine(to: CGPoint(x: x + waist, y: y + waist))
        path.addLine(to: CGPoint(x: x, y: y + size))
        path.addLine(to: CGPoint(x: x - waist, y: y + waist))
        path.addLine(to: CGPoint(x: x - size, y: y))
        path.addLine(to: CGPoint(x: x - waist, y: y - waist))
        path.closeSubpath()
        return path
    }
}

/// Places its content on the arc; animatable, so the sun travels along the curve.
private struct SunArcPosition: ViewModifier, Animatable {
    var fraction: Double

    var animatableData: Double {
        get { fraction }
        set { fraction = newValue }
    }

    func body(content: Content) -> some View {
        GeometryReader { proxy in
            content.position(SunArcGeometry.point(fraction, in: CGRect(origin: .zero, size: proxy.size)))
        }
    }
}
