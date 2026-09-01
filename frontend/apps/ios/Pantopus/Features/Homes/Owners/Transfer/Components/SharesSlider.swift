//
//  SharesSlider.swift
//  Pantopus
//
//  A13.4 — Custom 1–60% slider used by `TransferOwnershipView`.
//  Standalone (not the SwiftUI `Slider`) because the design needs a
//  primary-toned track with a 24pt ringed thumb and a mono percentage
//  pill, with optional tick marks at fixed presets.
//

import SwiftUI

/// 1–60% slider with monospaced tick marks at the preset stops.
///
/// The thumb is a 24pt circle with a 2pt primary-coloured ring; the active
/// track segment is filled with `primary600` and the trailing segment with
/// `appSurfaceSunken`. A trailing pill shows the live mono percentage.
@MainActor
public struct SharesSlider: View {
    @Binding private var value: Int
    private let range: ClosedRange<Int>
    private let ticks: [Int]
    private let identifier: String?

    public init(
        value: Binding<Int>,
        range: ClosedRange<Int> = 1...60,
        ticks: [Int] = [10, 25, 33, 50],
        identifier: String? = nil
    ) {
        _value = value
        self.range = range
        self.ticks = ticks
        self.identifier = identifier
    }

    public var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let currentFraction = sliderFraction(for: value)
            ZStack(alignment: .leading) {
                // Inactive track
                Capsule()
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 4)
                // Active track
                Capsule()
                    .fill(Theme.Color.primary600)
                    .frame(width: max(0, width * currentFraction), height: 4)
                // Tick dots — sit on top of the track so they remain visible
                // whether the active fill has covered them or not.
                ForEach(ticks, id: \.self) { tick in
                    let tickFraction = sliderFraction(for: tick)
                    Circle()
                        .fill(tick <= value ? Theme.Color.appTextInverse : Theme.Color.appBorderStrong)
                        .frame(width: 4, height: 4)
                        .offset(x: max(0, width * tickFraction - 2))
                }
                // Thumb
                Circle()
                    .fill(Theme.Color.appSurface)
                    .overlay(Circle().stroke(Theme.Color.primary600, lineWidth: 2))
                    .frame(width: 24, height: 24)
                    .shadow(color: Theme.Color.primary600.opacity(0.25), radius: 6, y: 2)
                    .offset(x: max(0, width * currentFraction - 12))
                    .accessibilityIdentifier("sharesSliderThumb")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        update(for: gesture.location.x, totalWidth: width)
                    }
            )
        }
        .frame(height: 24)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Share to transfer")
        .accessibilityValue("\(value) percent")
        .accessibilityIdentifier(identifier ?? "sharesSlider")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment:
                value = min(range.upperBound, value + 1)
            case .decrement:
                value = max(range.lowerBound, value - 1)
            @unknown default:
                break
            }
        }
    }

    private func sliderFraction(for raw: Int) -> CGFloat {
        let lower = CGFloat(range.lowerBound)
        let upper = CGFloat(range.upperBound)
        guard upper > lower else { return 0 }
        return CGFloat(raw - range.lowerBound) / (upper - lower)
    }

    private func update(for locationX: CGFloat, totalWidth: CGFloat) {
        guard totalWidth > 0 else { return }
        let clamped = min(max(0, locationX), totalWidth)
        let span = CGFloat(range.upperBound - range.lowerBound)
        let raw = (clamped / totalWidth) * span + CGFloat(range.lowerBound)
        let snapped = Int(raw.rounded())
        value = min(max(range.lowerBound, snapped), range.upperBound)
    }
}

#Preview {
    StatefulPreview()
        .padding()
        .background(Theme.Color.appSurface)
}

private struct StatefulPreview: View {
    @State private var value = 25
    var body: some View {
        VStack(spacing: Spacing.s4) {
            SharesSlider(value: $value)
            Text("\(value)%")
                .font(.system(.body, design: .monospaced))
        }
    }
}
