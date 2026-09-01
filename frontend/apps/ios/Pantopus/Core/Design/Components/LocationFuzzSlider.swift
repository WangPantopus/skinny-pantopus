//
//  LocationFuzzSlider.swift
//  Pantopus
//
//  A14.7 Privacy — the "Map location fuzz" card body: a lead-in line, a
//  five-stop stepped slider (white thumb, primary fill, tick dots), the
//  stop labels, and the live `FuzzMap` preview (P1.3) that grows its
//  concentric ring as the slider drags. The five stops are the
//  `FuzzStop` cases — Exact · Block · Quarter mile · Half mile ·
//  Neighborhood. Lives beside `FuzzMap` so the shared `GroupedListView`
//  can render it without reaching into a feature folder.
//
//  Each piece is a small `some View` helper so the SwiftUI type-checker
//  resolves the nested track/tick/thumb geometry without timing out.
//

import SwiftUI

@MainActor
public struct LocationFuzzSlider: View {
    private let leadIn: String
    private let stop: FuzzStop
    private let onChange: (FuzzStop) -> Void

    private let stops = FuzzStop.allCases

    public init(
        leadIn: String,
        stop: FuzzStop,
        onChange: @escaping (FuzzStop) -> Void
    ) {
        self.leadIn = leadIn
        self.stop = stop
        self.onChange = onChange
    }

    private var index: Int {
        stops.firstIndex(of: stop) ?? 0
    }

    private var activeFraction: CGFloat {
        stops.count > 1 ? CGFloat(index) / CGFloat(stops.count - 1) : 0
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            leadInText
            sliderSection
            divider
            mapSection
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("locationFuzzSlider")
    }

    private var leadInText: some View {
        Text(leadIn)
            .font(.system(size: 13.5, weight: .medium))
            .foregroundStyle(Theme.Color.appTextStrong)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 14)
            .padding(.bottom, Spacing.s1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sliderSection: some View {
        VStack(spacing: Spacing.s2) {
            GeometryReader { proxy in
                trackStack(width: proxy.size.width)
            }
            .frame(height: 24)
            stopLabels
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 14)
        .padding(.bottom, 18)
    }

    private func trackStack(width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            trackBar
            fillBar(width: width)
            tickDots(width: width)
            thumb(width: width)
        }
        .frame(maxHeight: .infinity, alignment: .center)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in updateStop(locationX: value.location.x, width: width) }
        )
    }

    private var trackBar: some View {
        Capsule()
            .fill(Theme.Color.appBorder)
            .frame(height: 4)
    }

    private func fillBar(width: CGFloat) -> some View {
        Capsule()
            .fill(Theme.Color.primary600)
            .frame(width: width * activeFraction, height: 4)
    }

    private func tickDots(width: CGFloat) -> some View {
        ForEach(Array(stops.enumerated()), id: \.offset) { offset, _ in
            tickDot(at: offset, width: width)
        }
    }

    private func tickDot(at offset: Int, width: CGFloat) -> some View {
        let fraction = stops.count > 1 ? CGFloat(offset) / CGFloat(stops.count - 1) : 0
        let filled = offset <= index
        return Circle()
            .fill(filled ? Theme.Color.appSurface : Theme.Color.appBorderStrong)
            .frame(width: 6, height: 6)
            .overlay(tickRing(filled: filled))
            .offset(x: width * fraction - 3)
    }

    private func tickRing(filled: Bool) -> some View {
        Circle().stroke(filled ? Theme.Color.primary600 : Color.clear, lineWidth: 1.5)
    }

    private func thumb(width: CGFloat) -> some View {
        Circle()
            .fill(Theme.Color.appSurface)
            .frame(width: 24, height: 24)
            .overlay(Circle().stroke(Theme.Color.primary600, lineWidth: 2))
            .shadow(color: .black.opacity(0.18), radius: 3, x: 0, y: 2)
            .offset(x: width * activeFraction - 12)
    }

    private var stopLabels: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stops.enumerated()), id: \.offset) { offset, fuzzStop in
                stopLabel(at: offset, label: fuzzStop.label)
                if offset < stops.count - 1 {
                    Spacer(minLength: Spacing.s1)
                }
            }
        }
    }

    private func stopLabel(at offset: Int, label: String) -> some View {
        Text(label)
            .font(.system(size: 10.5, weight: offset == index ? .bold : .medium))
            .foregroundStyle(offset == index ? Theme.Color.appText : Theme.Color.appTextMuted)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .multilineTextAlignment(.center)
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder.opacity(0.6))
            .frame(height: 1)
            .padding(.leading, Spacing.s4)
    }

    private var mapSection: some View {
        FuzzMap(stop: stop)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
    }

    private func updateStop(locationX: CGFloat, width: CGFloat) {
        guard width > 0, stops.count > 1 else { return }
        let fraction = max(0, min(1, locationX / width))
        let newIndex = Int((fraction * CGFloat(stops.count - 1)).rounded())
        let newStop = stops[newIndex]
        if newStop != stop { onChange(newStop) }
    }
}

#Preview("Location fuzz slider") {
    LocationFuzzSlider(
        leadIn: "How exact your task and listing pins appear on the map.",
        stop: .halfMile
    ) { _ in }
        .background(Theme.Color.appSurface)
        .padding(Spacing.s3)
        .background(Theme.Color.appBg)
}
