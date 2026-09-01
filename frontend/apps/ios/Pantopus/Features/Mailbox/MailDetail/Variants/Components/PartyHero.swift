//
//  PartyHero.swift
//  Pantopus
//
//  A17.9 — Festive event hero. Three-layer card:
//    1. Pink-gradient band carrying the trust + party-invite chips, the
//       time-ago stamp, the "You're invited by …" eyebrow, and the
//       serif event title. The `ConfettiSpray` primitive overlays the
//       band — gentle drift in the rose / amber / sky / magic palette
//       lifted from `party.jsx` Confetti.
//    2. A `DateTile` + location row that overlaps the band by 46pt so
//       the panel sits half on / half off the gradient (the design's
//       signature "ticket stub" trick).
//    3. Optional going-state confirmation banner — green check pill,
//       headcount, +1 chip, and the local-time stamp.
//

import SwiftUI

@MainActor
struct PartyHero: View {
    let party: PartyDetailDTO

    var body: some View {
        VStack(spacing: Spacing.s0) {
            festiveBand
            datePanel
                .padding(.horizontal, Spacing.s3)
                .padding(.top, -46)
                .padding(.bottom, party.rsvp == .going ? Spacing.s2 : Spacing.s3)
            if party.rsvp == .going {
                goingBanner
                    .padding(.horizontal, Spacing.s3)
                    .padding(.bottom, Spacing.s3)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.categoryParty.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .shadow(color: Theme.Color.categoryParty.opacity(0.10), radius: 10, x: 0, y: 4)
        .accessibilityIdentifier("partyHero")
    }

    // MARK: - Band

    private var festiveBand: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [
                    Theme.Color.errorBg,
                    Theme.Color.categoryParty.opacity(0.20),
                    Theme.Color.categoryParty.opacity(0.32)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            ConfettiSpray(seed: 24, dotCount: 48)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s1) {
                    PartyHeroTrustPill()
                    PartyInvitePill()
                    Spacer()
                    Text(party.timeAgoLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.categoryParty)
                        .opacity(0.7)
                }
                Text("You're invited by \(party.host.name.split(separator: " ").first.map(String.init) ?? party.host.name)")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(Theme.Color.categoryParty.opacity(0.85))
                Text(party.rsvp == .going
                    ? "You're going on \(party.event.date.monthLabel.capitalized) \(party.event.date.dayNumber)"
                    : party.event.what
                )
                .font(.system(size: 22, weight: .heavy, design: .serif))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 60)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Date / location panel

    private var datePanel: some View {
        HStack(spacing: Spacing.s3) {
            DateTile(
                monthLabel: party.event.date.monthLabel,
                dayNumber: party.event.date.dayNumber,
                dayLabel: party.event.date.dayLabel
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("\(party.event.date.weekday) · \(party.event.date.timeRange)")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .tracking(-0.1)
                HStack(spacing: 5) {
                    Icon(.mapPin, size: 12, color: Theme.Color.categoryParty)
                    Text(party.event.location)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                Text(party.event.locationNote)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.leading, 17)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.06), radius: 6, x: 0, y: 4)
    }

    // MARK: - Going banner

    private var goingBanner: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.success).frame(width: 20, height: 20)
                Icon(.check, size: 12, color: Theme.Color.appTextInverse)
            }
            (
                Text("You're going")
                    .font(.system(size: 12, weight: .heavy))
                    + Text(party.plusOneCount > 0 ? " · +\(party.plusOneCount)" : "")
                    .font(.system(size: 12, weight: .heavy))
                    + Text(party.rsvpConfirmedAtLabel.map { " · RSVP'd \($0)" } ?? "")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Theme.Color.success.opacity(0.85))
            )
            .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 9)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityIdentifier("partyHero_goingBanner")
    }
}

// MARK: - Chips

private struct PartyHeroTrustPill: View {
    var body: some View {
        HStack(spacing: 3) {
            Icon(.shieldCheck, size: 10, color: Theme.Color.success)
            Text("Verified")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

private struct PartyInvitePill: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(Theme.Color.categoryParty).frame(width: 6, height: 6)
            Text("Party invite")
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.2)
                .foregroundStyle(Theme.Color.categoryParty)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill)
                .stroke(Theme.Color.categoryParty.opacity(0.45), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

#Preview("Open") {
    PartyHero(party: MailItemSampleData.partyInvite)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}

#Preview("Going") {
    PartyHero(party: MailItemSampleData.partyInviteGoing)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
