//
//  PlanPinView.swift
//  Pantopus
//
//  Board P1 "Pins and areas": one marker shape for every plan, a teardrop
//  with the kind's glyph (never a plain disc or ring: in Pantopus those mean
//  where a fact came from). 34 pt with a 2.5 pt ring and a 17 pt glyph;
//  selected 46 pt with a 22 pt glyph; an 18 pt badge (in, hosting,
//  requested); an 11 pt bold tag under the tip; 44 pt touch target.
//
//  The view's vertical center is the pin's tip, so a MapKit `Annotation`
//  with `anchor: .center` puts the tip on the plan's point.
//

import SwiftUI

/// How a pin looks right now.
struct PlanPinLook: Equatable {
    var kind: PlanKind
    var tag: String?
    var isSelected = false
    var isDimmed = false
    var isFull = false
    var isLive = false
    var badge: Badge?

    enum Badge: Equatable {
        /// You're in: green check.
        case going
        /// You're hosting: sky flag.
        case hosting
        /// Requested or waiting: dark clock.
        case waiting
    }
}

/// The teardrop marker with its badge and tag.
struct PlanPinView: View {
    /// Wide enough for the tag under the head.
    static let width: CGFloat = 96

    let look: PlanPinLook
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var haloGrows = false

    private var size: CGFloat {
        look.isSelected ? 46 : 34
    }

    private var ring: CGFloat {
        look.isSelected ? 3 : 2.5
    }

    /// From the head's center to its tip: the rounded square's diagonal, less
    /// the tip's 7 pt rounding.
    private var tipDrop: CGFloat {
        (size / 2 - 7) * 1.414 + 7
    }

    var body: some View {
        let tipY = size / 2 + tipDrop + ring
        VStack(spacing: 0) {
            ZStack {
                // The 44 pt touch target around the head.
                Circle().fill(Color.clear).frame(width: 44, height: 44).contentShape(Circle())
                if look.isLive { halo }
                head
                if let badge = look.badge { badgeView(badge) }
            }
            .frame(width: size + ring * 2, height: size + ring * 2)
            .frame(height: tipY, alignment: .top)
            if let tag = look.tag {
                Text(tag)
                    .font(.system(size: look.isSelected ? 12 : 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .shadow(color: Theme.Color.appSurface, radius: 1.5)
                    .shadow(color: Theme.Color.appSurface, radius: 1.5)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .frame(width: max(Self.width, size + 20), height: tipY * 2)
        .opacity(look.isDimmed ? 0.4 : 1)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : .easeOut(duration: 0.18), value: look)
    }

    private var teardrop: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: size / 2,
            bottomLeadingRadius: 7,
            bottomTrailingRadius: size / 2,
            topTrailingRadius: size / 2,
            style: .continuous
        )
    }

    private var head: some View {
        ZStack {
            teardrop
                .fill(Theme.Color.appSurface)
                .frame(width: size + ring * 2, height: size + ring * 2)
                .rotationEffect(.degrees(-45))
                .shadow(
                    color: .black.opacity(look.isSelected ? 0.32 : 0.28),
                    radius: look.isSelected ? 8 : 4,
                    x: 0,
                    y: look.isSelected ? 6 : 3
                )
            teardrop
                .fill(look.isFull ? Theme.Color.appBorderStrong : look.kind.color)
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-45))
            Icon(
                look.kind.icon,
                size: look.isSelected ? 22 : 17,
                color: look.isFull ? Theme.Color.appTextStrong : Theme.Color.categoryPlanPinInk
            )
        }
    }

    /// Happening now: a halo grows from 70% to 150% and fades over 1.8 s,
    /// looping while the plan is on. Static under Reduce Motion.
    private var halo: some View {
        teardrop
            .stroke(look.kind.color, lineWidth: 2)
            .frame(width: size + 14, height: size + 14)
            .rotationEffect(.degrees(-45))
            .scaleEffect(reduceMotion ? 1 : haloGrows ? 1.5 : 0.7)
            .opacity(reduceMotion ? 0.4 : haloGrows ? 0 : 0.5)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.8).repeatForever(autoreverses: false)) { haloGrows = true }
            }
    }

    private func badgeView(_ badge: PlanPinLook.Badge) -> some View {
        PlanPinBadge(badge: badge)
            .offset(x: size * 0.47, y: -size * 0.47)
    }
}

/// Board P1's 18 pt badge: in (green check), hosting (sky flag), asked (dark clock).
struct PlanPinBadge: View {
    let badge: PlanPinLook.Badge

    var body: some View {
        let fill: Color = switch badge {
        case .going: Theme.Color.successSolid
        case .hosting: Theme.Color.primary600
        case .waiting: Theme.Color.appTextStrong
        }
        let icon: PantopusIcon = switch badge {
        case .going: .check
        case .hosting: .flag
        case .waiting: .clock
        }
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(fill)
            .frame(width: 18, height: 18)
            .overlay(Icon(icon, size: 11, strokeWidth: 3, color: badge == .waiting ? Theme.Color.appSurface : Theme.Color.appTextInverse))
            .padding(2)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Theme.Color.appSurface))
    }
}

/// Board P1 "Cluster": the count and up to three kind colors; a tap zooms in.
struct PlanClusterView: View {
    let count: Int
    let kinds: [PlanKind]
    var badge: PlanPinLook.Badge?

    var body: some View {
        VStack(spacing: 3) {
            Text("\(count)")
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Theme.Color.appText)
            HStack(spacing: 2) {
                ForEach(Array(kinds.prefix(3)), id: \.self) { kind in
                    RoundedRectangle(cornerRadius: 2).fill(kind.color).frame(width: 6, height: 4)
                }
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .frame(minWidth: 36)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .padding(2.5)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
        .shadow(color: .black.opacity(0.22), radius: 4, x: 0, y: 3)
        .overlay(alignment: .topTrailing) {
            if let badge { PlanPinBadge(badge: badge).offset(x: 9, y: -9) }
        }
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(Rectangle())
    }
}
