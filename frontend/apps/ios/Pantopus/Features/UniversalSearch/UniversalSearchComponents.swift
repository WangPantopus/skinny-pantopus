//
//  UniversalSearchComponents.swift
//  Pantopus
//
//  S2 — the pieces the universal-search results list is built from:
//  the overline section header, the hairline-row card, the partial-
//  failure notice, and the "browse nearby businesses" CTA. Split out of
//  `UniversalSearchView` so neither file outgrows the SwiftLint
//  type-body budget.
//
//  Geometry follows the A08 "Discover hub" frame: 14/11pt overline
//  header with a trailing count, then a 16pt-radius surface card whose
//  rows are separated by hairlines inset past the 40pt leading glyph.
//

import SwiftUI

/// Overline section header — glyph + plural label + row count. Only the
/// "All" tab renders these.
struct UniversalSearchSectionHeader: View {
    let section: UniversalSearchSection

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(section.kind.icon, size: 14, color: section.kind.accent)
            Text(section.kind.sectionTitle)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
            Text("\(section.results.count)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier("universalSearchSection_\(section.kind.rawValue)")
    }
}

/// One section's rows inside a bordered surface card.
struct UniversalSearchResultsCard: View {
    let section: UniversalSearchSection
    let onOpen: @MainActor (UniversalSearchDestination) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(section.results.enumerated()), id: \.element.id) { index, result in
                Button { onOpen(result.destination) } label: {
                    UniversalSearchRow(result: result)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("universalSearchRow_\(result.kind.rawValue)_\(result.id)")
                if index < section.results.count - 1 {
                    Divider()
                        .background(Theme.Color.appBorderSubtle)
                        .padding(.leading, Spacing.s12 + Spacing.s3)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .padding(.bottom, Spacing.s1)
    }
}

/// One universal-search row: avatar (or tinted kind glyph), title +
/// subtitle, accent meta, chevron.
struct UniversalSearchRow: View {
    let result: UniversalSearchResult

    var body: some View {
        HStack(spacing: Spacing.s3) {
            leading
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(result.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if let subtitle = result.subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s0)
            if let meta = result.meta {
                Text(meta)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(result.kind.accent)
                    .lineLimit(1)
            }
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .contentShape(Rectangle())
    }

    @ViewBuilder private var leading: some View {
        if let url = result.imageURL {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    glyph
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        } else {
            glyph
        }
    }

    private var glyph: some View {
        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
            .fill(result.kind.accentBackground)
            .frame(width: 40, height: 40)
            .overlay(Icon(result.kind.icon, size: 18, color: result.kind.accent))
    }
}

/// Inline "this one source failed" strip. Shown only on the "All" tab,
/// where the other four still have rows to render — a partial outage
/// must not blank what did load.
struct UniversalSearchNotice: View {
    let kind: UniversalSearchKind
    let onRetry: @MainActor () async -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 14, color: Theme.Color.warning)
            Text(kind.failureNotice)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
            Button {
                Task { await onRetry() }
            } label: {
                Text("Retry")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.top, Spacing.s3)
        .accessibilityIdentifier("universalSearchNotice_\(kind.rawValue)")
    }
}

/// "Browse nearby businesses" card — RN renders this above the results
/// whenever the Businesses tab is active (`src/app/discover.tsx:412`).
struct UniversalSearchBrowseNearbyCard: View {
    let onTap: @MainActor () -> Void

    var body: some View {
        Button { onTap() } label: {
            HStack(spacing: Spacing.s3) {
                Icon(.building2, size: 18, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text("Browse nearby businesses")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                    Text("Find trusted businesses near you with neighbor recommendations")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.primary50)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.primary200, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("universalSearchBrowseNearbyBusinesses")
    }
}
