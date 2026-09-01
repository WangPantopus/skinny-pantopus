//
//  ComposeBroadcastSampleData.swift
//  Pantopus
//
//  A.7 (A22.2) — Deterministic seed data for the Compose Broadcast
//  surface. Backend has been removed, so the persona, per-audience
//  reach, recent-broadcast analytics, and the demo draft all live here
//  and feed the route wiring, SwiftUI previews, and snapshot baselines.
//

import Foundation

public enum ComposeBroadcastSampleData {
    public static let persona = BroadcastPersona(
        id: "persona_maria",
        handle: "@mariak",
        displayName: "Maria K",
        kind: .personal,
        avatarInitial: "M"
    )

    /// Reach per targeting option — drives the "All beacons · 1,247"
    /// chip annotation and the audience picker rows.
    public static let audienceReach: [BroadcastAudience: Int] = [
        .allBeacons: 1247,
        .followersOnly: 1247,
        .bronzePlus: 518,
        .silverPlus: 212,
        .goldOnly: 64
    ]

    public static let draftText =
        "Today's loaf has a crumb you could read poetry through. " +
        "I'll set a few aside if you want to swing by the stoop between 4–6."

    public static let mediaPreview = ComposeMediaPreview(
        id: "media_boule",
        kind: .image,
        caption: "boule-crumb.jpg",
        data: nil
    )

    /// Deterministic "scheduled" instant so the scheduled-state baseline
    /// is stable: 2025-10-16 19:00 UTC.
    public static let scheduledAt = Date(timeIntervalSince1970: 1_760_641_200)

    public static let recentBroadcasts: [RecentBroadcastContent] = [
        RecentBroadcastContent(
            id: "bc_1",
            timeLabel: "Yesterday",
            audience: .bronzePlus,
            body: "Full hydration chart for the country boule. Six months of " +
                "notebook scans + my fold timing for high-humidity weeks.",
            reach: "284",
            read: "221",
            readPct: "78%",
            reactions: "42",
            replies: "7",
            hasMedia: false
        ),
        RecentBroadcastContent(
            id: "bc_2",
            timeLabel: "3d ago",
            audience: .allBeacons,
            body: "Tuesday market field notes — that new cheese stall is the " +
                "real deal. Avoid the third tomato bin from the left.",
            reach: "1.1K",
            read: "804",
            readPct: "73%",
            reactions: "51",
            replies: "12",
            hasMedia: true
        ),
        RecentBroadcastContent(
            id: "bc_3",
            timeLabel: "1w ago",
            audience: .silverPlus,
            body: "Silver+ Q&A recording is up. Trimmed to 22 min, timestamps " +
                "in the notes. Next live: Thursday 7pm.",
            reach: "78",
            read: "64",
            readPct: "82%",
            reactions: "19",
            replies: "4",
            hasMedia: false
        )
    ]
}

public extension ComposeBroadcastViewModel {
    /// Production wiring: the composer starts empty and `load()` (kicked
    /// from the View's `.task`) fills the persona, per-tier reach, and
    /// recent broadcasts from the backend. `performSend` publishes for real
    /// via `POST /api/broadcast/channels/:id/messages`.
    static func live(
        personaId: String,
        onSent: @escaping @MainActor () -> Void = {}
    ) -> ComposeBroadcastViewModel {
        let placeholder = BroadcastPersona(
            id: personaId,
            handle: "",
            displayName: "",
            kind: .personal,
            avatarInitial: ""
        )
        let viewModel = ComposeBroadcastViewModel(
            personaId: personaId,
            persona: placeholder,
            recentBroadcasts: [],
            audienceReach: [:],
            onSent: onSent
        )
        viewModel.performSend = { [weak viewModel] draft, _ in
            try await viewModel?.publish(draft)
        }
        return viewModel
    }

    /// FRAME 1 — drafted broadcast with body + attached media + recents.
    static func previewPopulated() -> ComposeBroadcastViewModel {
        ComposeBroadcastViewModel(
            personaId: ComposeBroadcastSampleData.persona.id,
            persona: ComposeBroadcastSampleData.persona,
            recentBroadcasts: ComposeBroadcastSampleData.recentBroadcasts,
            audienceReach: ComposeBroadcastSampleData.audienceReach,
            draft: ComposeBroadcastDraft(
                body: ComposeBroadcastSampleData.draftText,
                audience: .allBeacons,
                media: [ComposeBroadcastSampleData.mediaPreview]
            )
        )
    }

    /// FRAME 2 — first-broadcast prompt: empty composer, no recents.
    static func previewEmpty() -> ComposeBroadcastViewModel {
        ComposeBroadcastViewModel(
            personaId: ComposeBroadcastSampleData.persona.id,
            persona: ComposeBroadcastSampleData.persona,
            recentBroadcasts: [],
            audienceReach: ComposeBroadcastSampleData.audienceReach
        )
    }

    /// Scheduled variant — drafted broadcast pinned to a future instant.
    static func previewScheduled() -> ComposeBroadcastViewModel {
        ComposeBroadcastViewModel(
            personaId: ComposeBroadcastSampleData.persona.id,
            persona: ComposeBroadcastSampleData.persona,
            recentBroadcasts: ComposeBroadcastSampleData.recentBroadcasts,
            audienceReach: ComposeBroadcastSampleData.audienceReach,
            draft: ComposeBroadcastDraft(
                body: ComposeBroadcastSampleData.draftText,
                audience: .bronzePlus,
                media: [ComposeBroadcastSampleData.mediaPreview]
            ),
            scheduledAt: ComposeBroadcastSampleData.scheduledAt
        )
    }
}
