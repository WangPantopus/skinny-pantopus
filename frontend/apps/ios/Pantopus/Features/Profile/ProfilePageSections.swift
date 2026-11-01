//
//  ProfilePageSections.swift
//  Pantopus
//
//  The parts of a person's profile below the header (the 11-01 redesign,
//  `Main.dc.html` and `About.dc.html`): the "wants to connect" banner, the
//  About tab (what they help with, what Pantopus verified, their links;
//  never the bio again) and the Work tab (portfolio, posted tasks, reviews),
//  which shows only when there is work to show.
//

import SwiftUI

// MARK: - Request banner

/// "<name> wants to connect" with Accept and Not now, above Message. The
/// note they may have written reached you in the notification; the server
/// keeps no copy, so the banner can't show it.
@MainActor
struct ProfileRequestBanner: View {
    let name: String
    let isWorking: Bool
    let onAccept: @MainActor () -> Void
    let onDecline: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(name) wants to connect")
                    .scaledFont(17, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("You'll see each other's connections-only posts and can invite each other to plans.")
                    .scaledFont(14)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ProfileActionRow {
                ProfileActionButton(title: "Accept", icon: .userCheck)
                    .button(action: onAccept)
                    .accessibilityIdentifier("publicProfileAcceptRequest")
                ProfileActionButton(title: "Not now", icon: nil, style: .secondary)
                    .button(action: onDecline)
                    .accessibilityIdentifier("publicProfileDeclineRequest")
            }
            .disabled(isWorking)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfileRequestBanner")
    }
}

// MARK: - About

/// The About tab (`About.dc.html`): Helps with, Verified (in plain words),
/// Links. Only the parts that have something in them; never the bio, which
/// the header already shows.
@MainActor
struct LocalProfileAboutSection: View {
    let content: NeighborProfileContent
    let header: PublicProfileHeader
    let profile: PublicProfile

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s6) {
            if !content.skills.isEmpty {
                section("Helps with") {
                    ContentDetailFlowLayout(spacing: Spacing.s2) {
                        ForEach(content.skills, id: \.self) { skill in
                            Text(skill)
                                .scaledFont(15)
                                .foregroundStyle(Theme.Color.appTextStrong)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(Theme.Color.appSurface)
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("publicProfileNeighborSkills")
                }
            }
            if !verifiedRows.isEmpty {
                section("Verified") {
                    card(verifiedRows) { row in
                        AboutRowView(row: row)
                    }
                }
                .accessibilityIdentifier("publicProfileNeighborLedger")
            }
            if !links.isEmpty {
                section("Links") {
                    card(links) { link in
                        Button {
                            openURL(link.url)
                        } label: {
                            AboutRowView(row: link.row, showsChevron: true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens in Safari")
                    }
                }
                .accessibilityIdentifier("publicProfileLinks")
            }
            if content.skills.isEmpty, verifiedRows.isEmpty, links.isEmpty {
                Text("\(header.firstName) hasn't added anything here yet.")
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("publicProfileLocalAbout")
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .scaledFont(17, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Rows in one bordered card with hairlines between them.
    private func card<Item: Identifiable>(
        _ items: [Item],
        @ViewBuilder row: @escaping (Item) -> some View
    ) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                row(item)
                if index < items.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(height: 1)
                        .padding(.leading, 60)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    /// Only what the profile read shows: the verified home (its city when
    /// they share it; the method isn't sent) and the confirmed email.
    private var verifiedRows: [AboutRow] {
        var rows: [AboutRow] = []
        if header.isVerifiedNeighbor {
            rows.append(AboutRow(
                id: "home",
                icon: .shieldCheck,
                tone: .home,
                title: header.trustCity.map { "Lives in \($0)" } ?? "Verified home",
                detail: "Pantopus confirmed this home. The address itself is never shown."
            ))
        }
        if profile.verified ?? false {
            rows.append(AboutRow(id: "email", icon: .mail, tone: .neutral, title: "Email confirmed", detail: nil))
        }
        return rows
    }

    /// The person's links (`social_links`), web addresses only.
    private var links: [AboutLink] {
        guard case let .object(map) = profile.socialLinks ?? .null else { return [] }
        return AboutLinkKind.all.compactMap { entry in
            guard case let .string(raw) = map[entry.key] ?? .null,
                  let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
                  let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
                  let host = url.host(), !host.isEmpty else { return nil }
            let shown = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
            let row = AboutRow(id: entry.key, icon: entry.icon, tone: .neutral, title: entry.label, detail: shown)
            return AboutLink(id: entry.key, url: url, row: row)
        }
    }
}

/// One row of an About card.
struct AboutRow: Identifiable {
    enum Tone {
        case home
        case neutral
    }

    let id: String
    let icon: PantopusIcon
    let tone: Tone
    let title: String
    let detail: String?
}

/// The links a profile can carry (`social_links`), in the order they show.
private struct AboutLinkKind {
    let key: String
    let label: String
    let icon: PantopusIcon

    static let all = [
        AboutLinkKind(key: "website", label: "Website", icon: .globe),
        AboutLinkKind(key: "linkedin", label: "LinkedIn", icon: .link),
        AboutLinkKind(key: "twitter", label: "X", icon: .link),
        AboutLinkKind(key: "instagram", label: "Instagram", icon: .link),
        AboutLinkKind(key: "facebook", label: "Facebook", icon: .link)
    ]
}

/// A link row and where it goes.
private struct AboutLink: Identifiable {
    let id: String
    let url: URL
    let row: AboutRow
}

/// An icon disc, a title and an optional line under it.
@MainActor
private struct AboutRowView: View {
    let row: AboutRow
    var showsChevron = false

    @ScaledMetric(relativeTo: .subheadline) private var disc: CGFloat = 32

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(row.icon, size: disc * 0.53, color: row.tone == .home ? Theme.Color.home : Theme.Color.appTextSecondary)
                .frame(width: disc, height: disc)
                .background(row.tone == .home ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.title)
                    .scaledFont(15, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail = row.detail {
                    Text(detail)
                        .scaledFont(13)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
            if showsChevron {
                Icon(.externalLink, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Work

/// The Work tab: the portfolio, the tasks they posted (with Open gigs on)
/// and their reviews, each only when it has something. Your own profile
/// always shows the portfolio, where "Add portfolio item" lives.
@MainActor
struct LocalProfileWorkSection: View {
    let userId: String
    let isOwnProfile: Bool
    let showsPortfolio: Bool
    let showsTasks: Bool
    let showsReviews: Bool
    let onOpenGig: @MainActor (String) -> Void
    let onOpenReviewer: @MainActor (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s6) {
            if showsPortfolio {
                part("Portfolio") {
                    ProfilePortfolioSection(userId: userId, isOwnProfile: isOwnProfile)
                }
            }
            if showsTasks {
                part("Tasks") {
                    ProfileGigsSection(userId: userId, onOpenGig: onOpenGig)
                }
            }
            if showsReviews {
                part("Reviews") {
                    ProfileGigReviewsSection(userId: userId, onOpenReviewer: onOpenReviewer)
                }
            }
        }
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("publicProfileWork")
    }

    private func part(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .scaledFont(17, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }
}
