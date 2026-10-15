//
//  PostAuthorHeader.swift
//  Pantopus
//
//  `post_author` slot for the Pulse post detail. 44pt avatar + verified
//  badge, two-line identity stack, right-aligned intent chip.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

/// One of the six intent buckets the design draws for a post. Source:
/// A10.4 `post_author`. The backend's `purpose` enum is wider; the
/// view-model collapses those onto these intents for display.
public enum PostIntent: String, Sendable, CaseIterable, Identifiable {
    case lostFound
    case ask
    case offer
    case event
    case share
    case alert
    /// A post whose type this build doesn't know (Pulse S2): a plain "Post" chip.
    case generic

    public var id: String {
        rawValue
    }

    /// Display label.
    public var label: String {
        switch self {
        case .lostFound: "Lost & Found"
        case .ask: "Ask"
        case .offer: "Offer"
        case .event: "Event"
        case .share: "Share"
        case .alert: "Alert"
        case .generic: "Post"
        }
    }

    /// Maps to a semantic `StatusChip` variant.
    public var chipVariant: StatusChipVariant {
        switch self {
        case .lostFound: .error
        case .ask: .info
        case .offer: .success
        case .event: .personal
        case .share: .home
        case .alert: .warning
        case .generic: .neutral
        }
    }

    /// Leading chip icon from the A10.4 frame.
    public var icon: PantopusIcon {
        switch self {
        case .lostFound: .search
        case .ask: .helpCircle
        case .offer: .hand
        case .event: .calendar
        case .share: .messageCircle
        case .alert: .alertCircle
        case .generic: .messageSquare
        }
    }

    /// Convert a backend `Post.post_type` / `Post.purpose` token into the
    /// nearest UI intent. `post_type` is the canonical column and wins;
    /// `purpose` is a backend-derived rollup (e.g. lost_found posts get
    /// `purpose: "ask"`) so it's only a fallback. Returns `.share` for the
    /// older general types, and `.generic` for a type this build doesn't
    /// know (one added later), so it never wears another type's label.
    public static func from(purpose: String?, postType: String?) -> PostIntent {
        if let mapped = map(postType) { return mapped }
        if !PulseIntent.knows(postType: postType) { return .generic }
        return map(purpose) ?? .share
    }

    private static func map(_ token: String?) -> PostIntent? {
        switch (token ?? "").lowercased() {
        case "lost_found", "lost", "found": .lostFound
        case "ask", "ask_local": .ask
        case "offer", "service_offer": .offer
        case "event": .event
        case "alert", "safety", "heads_up": .alert
        case "deal", "recommend", "recommendation", "share", "showcase", "story",
             "neighborhood_win", "visitor_guide", "local_update", "learn",
             "announcement", "general":
            .share
        default: nil
        }
    }
}

/// Pulse post header. Renders the author identity row + intent chip used
/// in the design's `FramePost` slot.
@MainActor
public struct PostAuthorHeader: View {
    private let displayName: String
    private let avatarURL: URL?
    private let isVerified: Bool
    private let identity: IdentityPillar
    private let timeAndLocality: String
    private let intent: PostIntent
    private let onAvatarTap: (@MainActor () -> Void)?
    private let pulseCard: PulsePageCard?

    public init(
        displayName: String,
        avatarURL: URL?,
        isVerified: Bool,
        identity: IdentityPillar,
        timeAndLocality: String,
        intent: PostIntent,
        onAvatarTap: (@MainActor () -> Void)? = nil,
        pulseCard: PulsePageCard? = nil
    ) {
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.isVerified = isVerified
        self.identity = identity
        self.timeAndLocality = timeAndLocality
        self.intent = intent
        self.onAvatarTap = onAvatarTap
        self.pulseCard = pulseCard
    }

    public var body: some View {
        if let pulseCard { pulseHeader(pulseCard) } else { legacyHeader }
    }

    private func pulseHeader(_ card: PulsePageCard) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            avatarTile
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PlanFlowLayout(spacing: Spacing.s2) {
                    Text(displayName).pulseFont(.button)
                    if let label = card.label { PulseAuthorLabelChip(label: label) }
                    Text(card.typeName).pulseFont(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if !timeAndLocality.isEmpty {
                    Text(timeAndLocality).pulseFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .foregroundStyle(Theme.Color.appText)
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .contain)
    }

    private var legacyHeader: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            avatarTile
            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(timeAndLocality)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            StatusChip(intent.label.uppercased(), variant: intent.chipVariant, icon: intent.icon)
                // "Share post" would read like the top bar's Share button.
                .accessibilityLabel(intent == .generic ? intent.label : "Post type: \(intent.label)")
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var avatarTile: some View {
        if let onAvatarTap {
            Button(action: { onAvatarTap() }) {
                avatarStack
            }
            .buttonStyle(.plain)
            .frame(minWidth: 44, minHeight: 44)
            .accessibilityIdentifier("pulsePostDetail-authorAvatar")
            .accessibilityLabel("Open \(displayName)'s profile")
        } else {
            avatarStack
        }
    }

    private var avatarStack: some View {
        ZStack(alignment: .bottomTrailing) {
            AvatarWithIdentityRing(
                name: displayName,
                imageURL: avatarURL,
                identity: identity,
                ringProgress: 1,
                size: 44
            )
            if isVerified {
                VerifiedBadge(size: 16)
                    .offset(x: 2, y: 2)
            }
        }
        .frame(width: 48, height: 48, alignment: .topLeading)
    }
}

#Preview("All intents") {
    VStack(alignment: .leading, spacing: Spacing.s4) {
        ForEach(PostIntent.allCases) { intent in
            PostAuthorHeader(
                displayName: "Alex Rivera",
                avatarURL: nil,
                isVerified: intent == .ask || intent == .offer,
                identity: .personal,
                timeAndLocality: "12m ago · Cambridge, MA",
                intent: intent
            )
        }
    }
    .padding(.vertical, Spacing.s4)
    .background(Theme.Color.appBg)
}
