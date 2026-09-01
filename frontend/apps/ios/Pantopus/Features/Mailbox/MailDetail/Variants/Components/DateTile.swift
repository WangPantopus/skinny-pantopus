//
//  DateTile.swift
//  Pantopus
//
//  A17.9 — Rose calendar-page tile. 56×60 card with a rose month strip
//  on top (MAY) and a serif day number + uppercase weekday label below.
//  Lives in the hero panel and the EventDetails grid; both lock the
//  rose accent to `Theme.Color.categoryParty` so the tile stays on the
//  party token even if the host's pillar accent drifts.
//

import SwiftUI

@MainActor
struct DateTile: View {
    let monthLabel: String
    let dayNumber: String
    let dayLabel: String

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Text(monthLabel)
                .font(.system(size: 9.5, weight: .heavy))
                .tracking(1.2)
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 18)
                .background(Theme.Color.categoryParty)
            VStack(spacing: 2) {
                Text(dayNumber)
                    .font(.system(size: 22, weight: .heavy, design: .serif))
                    .tracking(-0.5)
                    .foregroundStyle(Theme.Color.appText)
                Text(dayLabel)
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(Theme.Color.appSurface)
        }
        .frame(width: 56, height: 60)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .shadow(color: Theme.Color.categoryParty.opacity(0.15), radius: 3, x: 0, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(dayLabel) \(monthLabel) \(dayNumber)")
        .accessibilityIdentifier("partyDateTile")
    }
}

#Preview {
    HStack(spacing: Spacing.s3) {
        DateTile(monthLabel: "MAY", dayNumber: "24", dayLabel: "SAT")
        DateTile(monthLabel: "JUN", dayNumber: "07", dayLabel: "SAT")
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
