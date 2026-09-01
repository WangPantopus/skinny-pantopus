//
//  LinkCard.swift
//  Pantopus
//
//  A.5 (A13.11) — a portfolio link row with an auto-fetched preview: a
//  host glyph (or spinner while resolving), the title + URL, and a drag
//  handle. Links added this session carry an amber border + fresh dot.
//

import SwiftUI

@MainActor
struct LinkCard: View {
    let link: PortfolioLink

    var body: some View {
        HStack(spacing: Spacing.s2) {
            iconTile
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Spacing.s1) {
                    Text(primaryText)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if link.isFresh { FreshDot() }
                }
                Text(secondaryText)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(secondaryColor)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.gripVertical, size: 14, color: Theme.Color.appTextMuted)
                .accessibilityHidden(true)
        }
        .padding(Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(link.isFresh ? Theme.Color.warning : Theme.Color.appBorder, lineWidth: link.isFresh ? 1.5 : 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("proLinkCard_\(link.id)")
    }

    private var iconTile: some View {
        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(link.state == .loading ? Theme.Color.appSurfaceSunken : Theme.Color.appSurface)
            .frame(width: 38, height: 38)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .overlay {
                if link.state == .loading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Theme.Color.business)
                } else {
                    Icon(
                        link.icon,
                        size: 16,
                        color: link.state == .error ? Theme.Color.error : Theme.Color.appTextStrong
                    )
                }
            }
            .accessibilityHidden(true)
    }

    private var primaryText: String {
        link.title.isEmpty ? link.url : link.title
    }

    private var secondaryText: String {
        switch link.state {
        case .loading: "Fetching preview…"
        case .error: "Couldn't fetch preview"
        case .resolved: link.url
        }
    }

    private var secondaryColor: Color {
        switch link.state {
        case .loading: Theme.Color.business
        case .error: Theme.Color.error
        case .resolved: Theme.Color.appTextSecondary
        }
    }

    private var accessibilityText: String {
        let state: String = switch link.state {
        case .loading: "fetching preview"
        case .error: "preview failed"
        case .resolved: link.url
        }
        return "Portfolio link, \(primaryText), \(state)" + (link.isFresh ? ", added this session" : "")
    }
}

/// "Add link" affordance, styled as a card row to match the design.
@MainActor
struct AddLinkRow: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(.plusCircle, size: 15, color: Theme.Color.business)
                Text("Add link")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.business)
                Spacer(minLength: Spacing.s0)
                Text("up to 6")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add link")
        .accessibilityIdentifier("proAddLinkRow")
    }
}

#Preview {
    VStack(spacing: Spacing.s2) {
        LinkCard(link: PortfolioLink(
            id: "1",
            host: "kovacsco.work",
            title: "kovacsco.work · Past projects",
            url: "https://kovacsco.work",
            state: .resolved
        ))
        LinkCard(link: PortfolioLink(
            id: "2",
            host: "youtube",
            title: "Hardwood floor repair walk-through",
            url: "youtu.be/_2j8…",
            state: .resolved
        ))
        LinkCard(link: PortfolioLink(
            id: "3",
            host: "behance",
            title: "",
            url: "behance.net/mariak/tile-bathroom-2026",
            state: .loading,
            isFresh: true
        ))
        AddLinkRow {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
