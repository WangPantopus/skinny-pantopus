//
//  ProfilePageHeader.swift
//  Pantopus
//
//  The top of a person's profile (the 11-01 profile redesign, `Main.dc.html`):
//  photo or initials on the person's feed color, the name neighbors see (it
//  wraps, never cut off), @username, one trust line ("Verified neighbor ·
//  Vancouver · Joined Oct 2026"), the tagline in bold, the bio up to four lines
//  with "more", then the actions. Type grows with the reader's text size; at
//  the accessibility sizes the photo sits above the name, the trust facts take
//  a line each and the buttons go full width (`LargestText.dc.html`).
//

import SwiftUI

/// What the trust line says, and only what's true: "Verified neighbor" for a
/// verified home, the city only when the profile read returns it.
struct ProfileTrustFacts: Equatable {
    let isVerifiedNeighbor: Bool
    let city: String?
    /// "Joined Oct 2026", or "Joined this week".
    let joined: String?

    var isEmpty: Bool {
        !isVerifiedNeighbor && city == nil && joined == nil
    }

    /// The trust line as one spoken sentence.
    var spoken: String {
        [isVerifiedNeighbor ? "Verified neighbor" : nil, city, joined].compactMap { $0 }.joined(separator: ", ")
    }
}

/// Name, photo, trust line, tagline, bio and the caller's action buttons.
@MainActor
struct ProfilePageHeader<Actions: View>: View {
    let name: String
    /// False for someone with no name: the avatar shows a plain person glyph.
    let showsInitials: Bool
    let handle: String?
    let avatarURL: URL?
    let color: ProfileAvatarColor
    let trust: ProfileTrustFacts
    let tagline: String?
    let bio: String?
    /// Opens the "what verified means" explainer; nil leaves the line as text.
    var onTrustTap: (@MainActor () -> Void)?
    @ViewBuilder let actions: () -> Actions

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            identity
            if !trust.isEmpty {
                ProfileTrustLine(facts: trust, stacked: typeSize.isAccessibilitySize, onTap: onTrustTap)
                    .padding(.top, 14)
            }
            if let tagline = Self.trimmed(tagline) {
                Text(tagline)
                    .scaledFont(17, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
                    .accessibilityIdentifier("publicProfileTagline")
            }
            if let bio = Self.trimmed(bio) {
                ProfileExpandableText(text: bio)
                    .padding(.top, Self.trimmed(tagline) == nil ? 14 : 6)
                    .accessibilityIdentifier("publicProfileBio")
            }
            actions()
                .padding(.top, 18)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var identity: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                avatar(size: 64)
                nameAndHandle
            }
        } else {
            HStack(alignment: .center, spacing: Spacing.s4) {
                avatar(size: 84)
                nameAndHandle
            }
        }
    }

    private func avatar(size: CGFloat) -> some View {
        ProfileAvatarDisc(name: name, showsInitials: showsInitials, imageURL: avatarURL, color: color, size: size)
    }

    private var nameAndHandle: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .scaledFont(28, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("publicProfileName")
            if let handle = Self.trimmed(handle) {
                Text(verbatim: "@\(handle)")
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func trimmed(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

// MARK: - Avatar

/// The person's photo, or their initials on their profile color.
@MainActor
struct ProfileAvatarDisc: View {
    let name: String
    let showsInitials: Bool
    let imageURL: URL?
    let color: ProfileAvatarColor
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(color.color)
            if !initials.isEmpty {
                Text(initials)
                    .font(.system(size: size * 0.36, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            } else {
                Icon(.userRound, size: size * 0.42, color: Theme.Color.appTextInverse)
            }
            if let imageURL {
                CachedAsyncImage(url: imageURL) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        // The name sits right beside it.
        .accessibilityHidden(true)
    }

    /// "RP" for Rowan Park; "" for someone with no name (the glyph shows).
    private var initials: String {
        showsInitials ? ProfileAvatarColor.initials(from: name) : ""
    }
}

/// A person's avatar color on the profile screens, the same on iOS, Android
/// and web (agreed in the PRF build's QUESTIONS.md, 11-01): the sum of the
/// lowercased account id's character codes, modulo five, picks sky, green,
/// violet, rose or slate. Each keeps its color in dark mode, where white
/// initials stay readable.
public enum ProfileAvatarColor: Int, CaseIterable, Sendable, Hashable {
    case sky
    case green
    case violet
    case rose
    case slate

    public init(userId: String) {
        let sum = userId.lowercased().unicodeScalars.reduce(0) { $0 + Int($1.value) }
        self = ProfileAvatarColor(rawValue: sum % Self.allCases.count) ?? .sky
    }

    public var color: Color {
        switch self {
        case .sky: Theme.Color.primarySolid
        case .green: Theme.Color.successSolid
        case .violet: Theme.Color.magic
        case .rose: Theme.Color.rose
        // The slate token that keeps its color in dark mode (Accent/Slate turns pale there).
        case .slate: Theme.Color.categoryRecords
        }
    }

    /// "RP" for Rowan Park: the first letters of the first and last words of
    /// the name; one word gives one letter.
    public static func initials(from name: String) -> String {
        let words = name.replacingOccurrences(of: "@", with: "").split(whereSeparator: \.isWhitespace)
        guard let first = words.first?.first else { return "" }
        guard words.count > 1, let last = words.last?.first else { return String(first).uppercased() }
        return (String(first) + String(last)).uppercased()
    }
}

// MARK: - Trust line

/// "Verified neighbor · Vancouver · Joined Oct 2026". Tapping a verified line
/// explains what it means; at the accessibility sizes each fact takes a line.
@MainActor
private struct ProfileTrustLine: View {
    let facts: ProfileTrustFacts
    let stacked: Bool
    let onTap: (@MainActor () -> Void)?

    @ScaledMetric(relativeTo: .subheadline) private var iconSize: CGFloat = 17

    var body: some View {
        if let onTap, facts.isVerifiedNeighbor {
            // A one-line row: the tap area grows to 44 pt without moving anything.
            Button(action: onTap) { content.hitArea(vertical: 13) }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(facts.spoken)
                .accessibilityHint("Shows what verified means")
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("publicProfileTrustLine")
        } else {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(facts.spoken)
                .accessibilityIdentifier("publicProfileTrustLine")
        }
    }

    @ViewBuilder private var content: some View {
        if stacked {
            VStack(alignment: .leading, spacing: 2) {
                if facts.isVerifiedNeighbor {
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                        shield
                        Text("Verified neighbor")
                            .scaledFont(15, weight: .semibold)
                            .foregroundStyle(Theme.Color.home)
                    }
                }
                ForEach([facts.city, facts.joined].compactMap { $0 }, id: \.self) { fact in
                    Text(fact)
                        .scaledFont(15)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if facts.isVerifiedNeighbor { shield }
                line
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var shield: some View {
        Icon(.shieldCheck, size: iconSize, color: Theme.Color.home)
            .alignmentGuide(.firstTextBaseline) { $0.height * 0.8 }
    }

    /// One wrapping line: the verified part in the home green, the rest muted.
    private var line: Text {
        let rest = [facts.city, facts.joined].compactMap { $0 }.joined(separator: " · ")
        guard facts.isVerifiedNeighbor else { return Text(verbatim: rest) }
        let verified = Text("Verified neighbor").fontWeight(.semibold).foregroundStyle(Theme.Color.home)
        return rest.isEmpty ? verified : verified + Text(verbatim: " · \(rest)")
    }
}

// MARK: - Bio

/// The bio, up to four lines with "more" when it runs longer. VoiceOver reads
/// the whole bio either way, so "more" is only for the eye.
@MainActor
struct ProfileExpandableText: View {
    let text: String
    var lineLimit = 4

    @State private var isExpanded = false
    @State private var fullHeight: CGFloat = 0
    @State private var shownHeight: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            styled(Text(text))
                .lineLimit(isExpanded ? nil : lineLimit)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { shownHeight = $0 }
                .background(alignment: .topLeading) {
                    styled(Text(text))
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fullHeight = $0 }
                }
            if !isExpanded, fullHeight > shownHeight + 1 {
                Button {
                    isExpanded = true
                } label: {
                    Text("more")
                        .scaledFont(16, weight: .semibold)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHidden(true)
                .accessibilityIdentifier("publicProfileBioMore")
            }
        }
    }

    private func styled(_ text: Text) -> some View {
        text
            .scaledFont(16)
            .foregroundStyle(Theme.Color.appTextStrong)
            .lineSpacing(3)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Buttons

/// The profile's header buttons: 48 pt tall (growing with the text size),
/// filled for the main action and outlined for the other.
@MainActor
struct ProfileActionButton: View {
    enum Style {
        case primary
        case secondary
    }

    let title: String
    let icon: PantopusIcon?
    var style: Style = .primary
    /// The ▾ of a button that opens a menu.
    var showsChevron = false

    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 19

    var body: some View {
        HStack(spacing: Spacing.s2) {
            if let icon {
                Icon(icon, size: min(iconSize, 36), strokeWidth: 2.25, color: foreground)
            }
            Text(title)
                .scaledFont(17, weight: .semibold)
                .foregroundStyle(foreground)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if showsChevron {
                Icon(.chevronDown, size: min(iconSize, 36) * 0.8, strokeWidth: 2.5, color: foreground)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        // 48 pt, or taller as the text grows.
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(style == .primary ? Theme.Color.primarySolid : Theme.Color.appSurface)
        .overlay {
            if style == .secondary {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var foreground: Color {
        style == .primary ? Theme.Color.appTextInverse : Theme.Color.appText
    }
}

extension ProfileActionButton {
    /// The same look as a tappable button. VoiceOver reads `spoken`, or the title.
    func button(spoken: String? = nil, action: @escaping @MainActor () -> Void) -> some View {
        Button(action: action) { self }
            .buttonStyle(.plain)
            .accessibilityLabel(spoken ?? title)
    }
}

/// Two buttons side by side; one above the other at the accessibility sizes.
@MainActor
struct ProfileActionRow<Content: View>: View {
    @ViewBuilder let content: () -> Content

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: Spacing.s3))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 10))
        layout { content() }
    }
}

// MARK: - Top bar

/// Back and ⋯ on the page's own background (no banner, no bar color), 44 pt
/// targets that grow a little at the larger text sizes.
@MainActor
struct ProfileTopBar: View {
    let onBack: @MainActor () -> Void
    let moreLabel: String
    let onMore: (@MainActor () -> Void)?

    @ScaledMetric(relativeTo: .body) private var side: CGFloat = 44
    @ScaledMetric(relativeTo: .body) private var chevron: CGFloat = 24

    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: min(chevron, 30), strokeWidth: 2.25, color: Theme.Color.appText)
                    .frame(width: min(side, 52), height: min(side, 52))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("publicProfileBack")
            Spacer(minLength: Spacing.s0)
            if let onMore {
                Button(action: onMore) {
                    Icon(.moreHorizontal, size: min(chevron, 30), color: Theme.Color.appText)
                        .frame(width: min(side, 52), height: min(side, 52))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(moreLabel)
                .accessibilityIdentifier("publicProfileMore")
            }
        }
        .padding(.horizontal, 6)
        .background(Theme.Color.appBg)
    }
}
