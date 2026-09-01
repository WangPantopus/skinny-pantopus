//
//  PlaceSectionView.swift
//  Pantopus
//
//  Renders one PlaceIntelligence section envelope as the right card —
//  the port of `presentation.tsx` `renderSection`. block_density gets
//  the DensityCard; locked sections get a LockedCard routed by band;
//  everything else is a SectionCard driven by PlacePresentation.
//  Reused by the dashboard and the detail pages.
//

import SwiftUI

struct PlaceSectionView: View {
    let env: PlaceSectionEnvelope
    /// Tap-through to the section's group-detail page (omitted ⇒ no chevron).
    var onOpen: (() -> Void)?
    /// Band D → verify (T3 → T4).
    var onVerify: (() -> Void)?
    /// Band B/C → claim (T1 → T3).
    var onClaim: (() -> Void)?

    private var lockHandler: (() -> Void)? {
        env.band == .d ? onVerify : onClaim
    }

    var body: some View {
        if env.id == .blockDensity {
            blockDensityCard
        } else if env.access == .locked {
            PlaceLockedCard(
                icon: PlacePresentation.config(for: env.id).icon,
                title: PlacePresentation.config(for: env.id).title,
                reason: PlacePresentation.lockReason(env),
                cta: PlacePresentation.lockCta(env.band),
                onTap: lockHandler
            )
        } else {
            sectionCard
        }
    }

    @ViewBuilder
    private var blockDensityCard: some View {
        if env.access == .locked {
            PlaceLockedCard(
                icon: .users,
                title: "Verified homes nearby",
                reason: PlacePresentation.lockReason(env),
                cta: PlacePresentation.lockCta(env.band),
                onTap: lockHandler
            )
        } else if let density = env.blockDensity,
                  env.status == .ready || env.status == .partial || env.status == .stale {
            PlaceDensityCard(bucket: density.bucket, label: density.label, ctaTitle: nil, onTap: onOpen)
        } else {
            PlaceSectionCard(
                icon: .users,
                title: "Verified homes nearby",
                state: PlacePresentation.cardState(env),
                caption: env.unavailableReason,
                onTap: onOpen
            )
        }
    }

    private var sectionCard: some View {
        let cfg = PlacePresentation.config(for: env.id)
        let state = PlacePresentation.cardState(env)
        let isLive = state == .loaded || state == .stale
        let reading = isLive ? PlacePresentation.reading(for: env) : PlaceSectionReading()
        return PlaceSectionCard(
            icon: cfg.icon,
            title: cfg.title,
            asOf: isLive ? PlacePresentation.asOf(for: env) : nil,
            state: state,
            value: reading.value,
            caption: state == .unavailable ? env.unavailableReason : reading.caption,
            chip: reading.chip,
            statusDot: reading.statusDot,
            sparkline: cfg.sparkline && isLive,
            actionLabel: nil,
            inline: cfg.inline,
            onTap: onOpen
        )
    }
}
