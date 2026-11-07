//
//  FeedSampleData.swift
//  Pantopus
//
//  Fixture posts for the A03 feed surfaces, transcribed from the design
//  frames (docs/designs/A03/feed-frames.jsx — A03.1 Pulse, and
//  beacons-frames.jsx — A03.2 Beacons). Used by SwiftUI previews and the
//  Pulse / Beacons snapshot tests. Not wired into the live view-model,
//  which fetches `/api/posts/feed`.
//

import Foundation

/// Design-frame fixtures for the Pulse and Beacons feeds.
public enum FeedSampleData {
    /// A03.1 — five mixed-intent Pulse cards (Ask · Rec · Event · Lost · Announce).
    public static let pulsePosts: [PulsePostCardContent] = [
        PulsePostCardContent(
            id: "pulse-ask",
            authorName: "Maria L.",
            authorInitials: "M",
            authorVerified: true,
            avatarTint: .sky,
            meta: "2h · Elm Park",
            intent: .ask,
            title: nil,
            body: "Anyone know a good dog-walker in Burnside? Our 1-year-old shepherd mix needs "
                + "midday walks Tue/Thu and our regular just moved. References appreciated.",
            reaction: emoji([.like: 7, .thanks: 5]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "pulse-rec",
            authorName: "Jordan A.",
            authorInitials: "J",
            authorVerified: false,
            avatarTint: .green,
            meta: "5h · Elm Park",
            intent: .recommend,
            title: nil,
            body: "Sourdough at 4th & Market is legit — family-run, opens at 7. "
                + "The country loaf is gone by 10. Cash only.",
            reaction: emoji([.love: 14, .like: 11, .haha: 5]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "pulse-event",
            authorName: "Anika R.",
            authorInitials: "A",
            authorVerified: true,
            avatarTint: .violet,
            meta: "Yesterday · Elm Park",
            intent: .event,
            title: "Playground cleanup Saturday",
            body: "9–11am at Burnside Park. Bring gloves; we'll have bags + coffee. "
                + "Kids welcome — there's a craft table by the slide.",
            reaction: PulseReaction(kind: .going, likeCount: 14),
            attendees: PulseAttendeeStrip(avatars: ["K", "P", "S", "T"], goingCount: 14, userIsGoing: false),
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "pulse-lost",
            authorName: "Devon S.",
            authorInitials: "D",
            authorVerified: false,
            avatarTint: .rose,
            meta: "Yesterday · Burnside",
            intent: .lost,
            title: nil,
            body: "Tortoiseshell cat missing near Maple & 8th. Tag says \"Pippin\". Reward — please DM.",
            reaction: emoji([.sad: 18, .like: 14, .thanks: 10]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "pulse-announce",
            authorName: "Elm Park Council",
            authorInitials: "E",
            authorVerified: true,
            avatarTint: .slate,
            meta: "2d · Elm Park",
            intent: .announce,
            title: nil,
            body: "Street sweeping shifts to Thursdays starting next week. "
                + "Move vehicles by 7am or get ticketed. Posted signs go up Wednesday.",
            reaction: emoji([.like: 98, .wow: 29]),
            attendees: nil,
            userHasReacted: false
        )
    ]

    /// A03.2 — five verified beacon broadcasts. Every author is verified.
    public static let beaconPosts: [PulsePostCardContent] = [
        PulsePostCardContent(
            id: "beacon-bakery",
            authorName: "Maple Bakery",
            authorInitials: "M",
            authorVerified: true,
            avatarTint: .amber,
            meta: "1h · Burnside",
            intent: .announce,
            title: nil,
            body: "Croissants are back tomorrow at 7am — we finally have the oven part. "
                + "First 30 are half-off for followers; just show this post at the counter.",
            reaction: emoji([.love: 40, .celebrate: 24]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "beacon-library",
            authorName: "Burnside Library",
            authorInitials: "B",
            authorVerified: true,
            avatarTint: .violet,
            meta: "3h · Burnside",
            intent: .event,
            title: "Toddler story time — Saturday",
            body: "10am sharp in the kids' room. Bring a snack. New title this week: "
                + "\"How to Be a Lion.\" Free, no RSVP needed.",
            reaction: PulseReaction(kind: .going, likeCount: 22),
            attendees: PulseAttendeeStrip(avatars: ["R", "M", "L"], goingCount: 22, userIsGoing: false),
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "beacon-plumber",
            authorName: "Rae the Plumber",
            authorInitials: "R",
            authorVerified: true,
            avatarTint: .green,
            meta: "Yesterday · Elm Park",
            intent: .recommend,
            title: nil,
            body: "Quick tip — if your shower's dripping right after you turn it off, it's almost always "
                + "a 4-dollar cartridge. Don't pay anyone 300 to swap one. Reply if you want the part number.",
            reaction: emoji([.thanks: 30, .like: 18]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "beacon-council",
            authorName: "Elm Park Council",
            authorInitials: "E",
            authorVerified: true,
            avatarTint: .slate,
            meta: "2d · Elm Park",
            intent: .announce,
            title: nil,
            body: "Street sweeping shifts to Thursdays starting next week. "
                + "Move vehicles by 7am or get ticketed. Signs go up Wednesday.",
            reaction: emoji([.like: 300, .wow: 40]),
            attendees: nil,
            userHasReacted: false
        ),
        PulsePostCardContent(
            id: "beacon-sami",
            authorName: "Sami Kim",
            authorInitials: "S",
            authorVerified: true,
            avatarTint: .sky,
            meta: "3d · Burnside",
            intent: .recommend,
            title: nil,
            body: "The new ramen place on 8th is worth the hype. Tonkotsu is the move; skip the spicy miso. "
                + "Tip: order at the counter, not the QR — it's faster.",
            reaction: emoji([.love: 60, .like: 32]),
            attendees: nil,
            userHasReacted: false
        )
    ]

    /// A card's emoji reactions in the frames: each emoji's count, shown most used first.
    private static func emoji(_ counts: [PostReactionEmoji: Int]) -> PulseReaction {
        PulseReaction(emoji: PostReactions(counts: counts.map { PostReactionCount(emoji: $0.key, count: $0.value) }))
    }
}
