//
//  TodaySunArc.swift
//  Pantopus
//
//  The Sun card as the sun's path: a dashed arc from sunrise to sunset
//  with the sun where it is now (it travels there when the card appears),
//  the stretch it has covered drawn in warm light, and at night the moon
//  in its real phase. The times and daylight read as before, plus how long
//  until the next sunrise or sunset. Parity twin of Android's `TodaySunArc.kt`.
//

import SwiftUI

struct TodaySunArcCard: View {
    let data: PlaceSunriseSunsetData

    var body: some View {
        TimelineView(.everyMinute) { minute in
            TodaySunArcContent(data: data, moment: SkyMoment.at(minute.date, sunrise: data.sunrise, sunset: data.sunset))
        }
        .accessibilityIdentifier("todaySunArc")
    }
}

private struct TodaySunArcContent: View {
    let data: PlaceSunriseSunsetData
    let moment: SkyMoment

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var travelled = 0.0

    private var up: Bool {
        moment.minutes >= moment.sunrise && moment.minutes <= moment.sunset
    }

    /// Where the sun marker rests: along the arc by day, at the horizon it
    /// will rise from (before sunrise) or set into (after sunset) by night.
    private var target: Double {
        up ? moment.dayFraction : (moment.minutes < moment.sunrise ? 0 : 1)
    }

    private var daylight: String {
        "\(data.daylightMinutes / 60)h \(data.daylightMinutes % 60)m"
    }

    /// "Sunset in 3h 10m" by day; "Sunrise in 5h 54m" by night.
    private var next: String {
        let minutesLeft = up ? moment.sunset - moment.minutes
            : (moment.minutes < moment.sunrise ? moment.sunrise - moment.minutes : moment.sunrise + 1440 - moment.minutes)
        let whole = max(Int(minutesLeft.rounded()), 1)
        let span = whole >= 60 ? "\(whole / 60)h \(whole % 60)m" : "\(whole)m"
        return up ? "Sunset in \(span)" : "Sunrise in \(span)"
    }

    var body: some View {
        PlaceDetailCard(padding: 16) {
            VStack(spacing: 4) {
                ZStack {
                    SunArcPath(progress: 1)
                        .stroke(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 5]))
                    SunArcPath(progress: travelled)
                        .stroke(
                            LinearGradient(
                                colors: [SkyPalette.sunLow.color, SkyPalette.sunHigh.color],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            style: StrokeStyle(lineWidth: 3, lineCap: .round)
                        )
                    SunArcHorizon()
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                    if !up { moon }
                    sunMarker
                    VStack(spacing: 1) {
                        Text(daylight)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("of daylight")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .padding(.top, 34)
                }
                .frame(height: 104)
                HStack(alignment: .top) {
                    sunTime(icon: .sunrise, label: "Sunrise", minutes: moment.sunrise, alignment: .leading)
                    Spacer(minLength: 8)
                    Text(next)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.warning)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Theme.Color.warningBg))
                    Spacer(minLength: 8)
                    sunTime(icon: .sunset, label: "Sunset", minutes: moment.sunset, alignment: .trailing)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Sunrise \(clock(moment.sunrise)), sunset \(clock(moment.sunset)), \(data.daylightMinutes / 60) hours "
                + "\(data.daylightMinutes % 60) minutes of daylight. \(next)."
        )
        .onAppear { move(to: target) }
        .onChange(of: target) { _, value in move(to: value) }
    }

    private var sunMarker: some View {
        Circle()
            .fill(up ? SkyPalette.sunHigh.color : Theme.Color.appTextMuted)
            .frame(width: 16, height: 16)
            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
            .shadow(color: up ? SkyPalette.sunLow.color(opacity: 0.8) : .clear, radius: 8)
            .modifier(SunArcPosition(fraction: travelled))
    }

    private var moon: some View {
        ZStack {
            Circle().fill(Theme.Color.appTextMuted.opacity(0.18))
            MoonShape(phase: moment.moonPhase).fill(Theme.Color.appTextSecondary)
        }
        .frame(width: 18, height: 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(.top, 2)
        .padding(.trailing, 38)
    }

    private func sunTime(icon: PantopusIcon, label: String, minutes: Double, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            HStack(spacing: 4) {
                Icon(icon, size: 15, strokeWidth: 2, color: Theme.Color.warning)
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text(clock(minutes))
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
        }
    }

    private func clock(_ minutes: Double) -> String {
        let midnight = Calendar.autoupdatingCurrent.startOfDay(for: Date())
        return midnight.addingTimeInterval(minutes * 60).formatted(date: .omitted, time: .shortened)
    }

    private func move(to value: Double) {
        if reduceMotion {
            travelled = value
        } else {
            withAnimation(.spring(duration: 1.2, bounce: 0.15)) { travelled = value }
        }
    }
}

// MARK: - Arc geometry

/// The arc spans the card: horizon 12 pt above the bottom, peak 14 pt from the top.
private enum SunArcGeometry {
    static func point(_ fraction: Double, in rect: CGRect) -> CGPoint {
        let theta = Double.pi * (1 - min(max(fraction, 0), 1))
        let horizon = rect.maxY - 12
        let rx = rect.width / 2 - 26
        let ry = horizon - rect.minY - 14
        return CGPoint(x: rect.midX + rx * cos(theta), y: horizon - ry * sin(theta))
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

private struct SunArcHorizon: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + 8, y: rect.maxY - 12))
        path.addLine(to: CGPoint(x: rect.maxX - 8, y: rect.maxY - 12))
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

/// The lit part of the moon for its phase.
struct MoonShape: Shape {
    let phase: Double

    func path(in rect: CGRect) -> Path {
        TodaySkyPainter.moonPath(center: CGPoint(x: rect.midX, y: rect.midY), radius: min(rect.width, rect.height) / 2, phase: phase)
    }
}
