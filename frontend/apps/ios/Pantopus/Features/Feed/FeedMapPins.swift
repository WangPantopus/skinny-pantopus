//
//  FeedMapPins.swift
//  Pantopus
//
//  What the Pulse map draws for posts: a pin in the post's intent colour
//  with its glyph (the Explore pin's disc, ring and shadow), a slow ripple
//  around posts from the last day, and cluster bubbles that grow with
//  their count and ring themselves with the mix of intents inside.
//

import MapKit
import SwiftUI

/// How one post's pin looks: the colour and glyph of its intent, and
/// whether it is live (posted in the last day), which gives it a halo.
public struct FeedMapPinStyle: Sendable, Hashable {
    public let intent: PulseIntent
    public let isLive: Bool

    public init(intent: PulseIntent, isLive: Bool) {
        self.intent = intent
        self.isLive = isLive
    }

    /// Posts younger than this are live.
    static let liveWindow: TimeInterval = 24 * 60 * 60

    /// The style of a `/api/posts/map` post marker, as of `now`.
    static func of(_ marker: PostsMapMarkerDTO, now: Date) -> FeedMapPinStyle {
        let created = marker.createdAt.flatMap { fractional.date(from: $0) ?? plain.date(from: $0) }
        let isLive = created.map { now.timeIntervalSince($0) < liveWindow } ?? false
        return FeedMapPinStyle(intent: PulseIntent.from(postType: marker.postType), isLive: isLive)
    }

    /// `ISO8601DateFormatter` is thread-safe in practice but not annotated
    /// `Sendable`; the formatters are configured once and only ever read.
    private nonisolated(unsafe) static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private nonisolated(unsafe) static let plain = ISO8601DateFormatter()
}

/// One post on the Pulse map. The selected pin grows a little and keeps a
/// halo; a live post (from the last day) ripples (a still halo with Reduce
/// Motion).
struct PulseMapPin: View {
    let style: FeedMapPinStyle
    let isActive: Bool

    var body: some View {
        let tint = style.intent.mapTint
        ZStack {
            if style.isLive {
                PulseMapRipple(tint: tint, diameter: 46)
            } else if isActive {
                Circle()
                    .fill(tint.opacity(0.25))
                    .frame(width: 46, height: 46)
            }
            Circle()
                .fill(tint)
                .frame(width: 30, height: 30)
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .shadow(color: .black.opacity(0.30), radius: 3, x: 0, y: 2)
            Icon(style.intent.icon, size: 14, strokeWidth: 2.4, color: .white)
        }
        .frame(width: 54, height: 54)
        .scaleEffect(isActive ? 1.15 : 1)
        .animation(.spring(duration: 0.25), value: isActive)
    }
}

/// A cluster of posts on the Pulse map: the count in white on the brand
/// colour, ringed by one arc per intent inside (its share, its colour),
/// growing with the count. Holding a live post, it ripples.
struct PulseMapClusterBubble: View {
    let cluster: ExploreCluster
    let styles: [String: FeedMapPinStyle]

    var body: some View {
        let mix = intentMix
        let size = Self.diameter(count: cluster.count)
        ZStack {
            if mix.contains(where: \.isLive) {
                PulseMapRipple(tint: Theme.Color.primary500, diameter: size + 12)
            }
            Circle()
                .fill(Theme.Color.appSurface)
                .frame(width: size, height: size)
            ForEach(Array(arcs(mix).enumerated()), id: \.offset) { _, arc in
                Circle()
                    .trim(from: arc.from, to: arc.to)
                    .stroke(arc.tint, style: StrokeStyle(lineWidth: 4, lineCap: .butt))
                    .rotationEffect(.degrees(-90))
                    .frame(width: size - 4, height: size - 4)
            }
            Circle()
                .fill(Theme.Color.primarySolid)
                .frame(width: size - 12, height: size - 12)
            Text("\(cluster.count)")
                .font(.system(size: cluster.count >= 100 ? 12 : 14, weight: .heavy))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
                .padding(.horizontal, 4)
        }
        .frame(width: size + 16, height: size + 16)
        .shadow(color: .black.opacity(0.28), radius: 5, x: 0, y: 3)
    }

    /// 40 pt for two posts, about 6 pt more each time the count doubles, at most 60.
    static func diameter(count: Int) -> CGFloat {
        min(60, max(40, 34 + 6 * log2(CGFloat(max(count, 1)))))
    }

    private struct Share {
        let intent: PulseIntent
        let count: Int
        let isLive: Bool
    }

    /// The intents inside, most common first.
    private var intentMix: [Share] {
        var counts: [PulseIntent: Int] = [:]
        var live: Set<PulseIntent> = []
        for id in cluster.entityIds {
            let style = styles[id] ?? FeedMapPinStyle(intent: .generic, isLive: false)
            counts[style.intent, default: 0] += 1
            if style.isLive { live.insert(style.intent) }
        }
        return counts
            .map { Share(intent: $0.key, count: $0.value, isLive: live.contains($0.key)) }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.intent.rawValue < $1.intent.rawValue }
    }

    private struct Arc {
        let from: CGFloat
        let to: CGFloat
        let tint: Color
    }

    /// One arc per intent, with a hairline gap between arcs.
    private func arcs(_ mix: [Share]) -> [Arc] {
        let total = CGFloat(mix.reduce(0) { $0 + $1.count })
        guard total > 0 else { return [] }
        let gap: CGFloat = mix.count > 1 ? 0.012 : 0
        var start: CGFloat = 0
        return mix.map { share in
            let end = start + CGFloat(share.count) / total
            defer { start = end }
            return Arc(from: start + gap / 2, to: max(start + gap / 2, end - gap / 2), tint: share.intent.mapTint)
        }
    }
}

/// A soft ring that keeps expanding and fading out of a live pin; a still
/// halo with Reduce Motion.
struct PulseMapRipple: View {
    let tint: Color
    let diameter: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var expanded = false

    var body: some View {
        Circle()
            .fill(tint.opacity(0.32))
            .frame(width: diameter, height: diameter)
            .scaleEffect(reduceMotion ? 1 : (expanded ? 1.35 : 0.65))
            .opacity(reduceMotion ? 0.55 : (expanded ? 0 : 0.9))
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.8).repeatForever(autoreverses: false)) { expanded = true }
            }
            .accessibilityHidden(true)
    }
}

extension PulseIntent {
    /// The pin colour: the intent's colour, or the brand's for a plain post.
    var mapTint: Color {
        switch self {
        case .all, .generic: Theme.Color.primary600
        default: tint
        }
    }
}
