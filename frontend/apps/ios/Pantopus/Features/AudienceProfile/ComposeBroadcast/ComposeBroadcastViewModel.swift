//
//  ComposeBroadcastViewModel.swift
//  Pantopus
//
//  A.7 (A22.2) — Backs the full-screen Compose Broadcast surface. The
//  editor fields (body / audience / media / schedule) are stored and
//  bound directly; `state` is derived from them plus the send `phase`
//  so it always matches the prompt's
//  `.empty / .composing / .scheduled / .sending / .error` contract.
//
//  Wiring: `load()` resolves the owner's persona + broadcast channel from
//  `GET /api/personas/me`, the per-tier reach from
//  `GET /api/personas/:id/membership-stats`, and the recent broadcasts from
//  `GET /api/broadcast/channels/:id/messages` (history). `send()` publishes
//  via `POST /api/broadcast/channels/:id/messages` — injected through
//  `performSend` by the `.live` factory. The default `performSend` stays a
//  no-op success so unit tests drive the state machine without a network;
//  `ComposeBroadcastSampleData` remains the preview/snapshot seam.
//

// swiftlint:disable type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class ComposeBroadcastViewModel {
    /// Send lifecycle, kept separate from the editable draft so the
    /// draft survives a `.sending` / `.error` round-trip.
    enum Phase: Equatable {
        case idle
        case sending
        case error(String)
    }

    public let personaId: String
    public private(set) var persona: BroadcastPersona
    public private(set) var recentBroadcasts: [RecentBroadcastContent]
    public let maxCharacterCount: Int

    public private(set) var draft: ComposeBroadcastDraft
    public private(set) var scheduledAt: Date?

    /// Instagram-style place tag picked in the shared `PlacePickerSheet`.
    /// An explicitly picked venue is intentional public disclosure; the
    /// backend still strips all auto GPS / home context from Beacon posts.
    public private(set) var selectedPlaceTag: PostPlaceTag?
    private var phase: Phase = .idle
    private var lastSavedDraft: ComposeBroadcastDraft

    /// Recents-section fetch state (the composer itself is always live).
    public private(set) var recentsLoading = false
    public private(set) var recentsError: String?

    private var audienceReach: [BroadcastAudience: Int]
    private let onSent: @MainActor () -> Void
    private let api: APIClient
    private let uploader: MultipartUploader

    /// The persona's broadcast channel id, resolved by `load()`; the send
    /// path needs it. Nil until `load()` resolves it.
    private var channelId: String?

    /// Stubbed network call. Default is an immediate no-op success; the
    /// `.live` factory swaps in the real publish, and the test suite injects
    /// a thrower / state-capture closure. `var` so it can be swapped post-init.
    var performSend: @MainActor (ComposeBroadcastDraft, Date?) async throws -> Void

    init(
        personaId: String,
        persona: BroadcastPersona,
        recentBroadcasts: [RecentBroadcastContent],
        audienceReach: [BroadcastAudience: Int] = [:],
        draft: ComposeBroadcastDraft = ComposeBroadcastDraft(),
        scheduledAt: Date? = nil,
        maxCharacterCount: Int = 1000,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        onSent: @escaping @MainActor () -> Void = {},
        performSend: @escaping @MainActor (ComposeBroadcastDraft, Date?) async throws -> Void = { _, _ in }
    ) {
        self.personaId = personaId
        self.persona = persona
        self.recentBroadcasts = recentBroadcasts
        self.audienceReach = audienceReach
        self.draft = draft
        self.scheduledAt = scheduledAt
        self.maxCharacterCount = maxCharacterCount
        self.api = api
        self.uploader = uploader
        self.onSent = onSent
        self.performSend = performSend
        lastSavedDraft = draft
    }

    // MARK: - Loading

    /// Resolve the owner's persona + channel, per-tier reach, and recent
    /// broadcasts. Best-effort: a failure on any leg leaves the composer
    /// usable; only the recents surface shows an inline error.
    public func load() async {
        recentsLoading = true
        recentsError = nil

        var resolvedPersonaId = personaId
        do {
            let me: PersonaMeResponse = try await api.request(AudienceProfileEndpoints.me)
            if let summary = me.persona {
                resolvedPersonaId = summary.id
                persona = Self.persona(from: summary, fallback: persona)
            }
            channelId = me.channel?.id
        } catch {
            // Composer still works; send resolves the channel lazily.
        }

        if let stats = try? await api.request(
            AudienceProfileEndpoints.membershipStats(personaId: resolvedPersonaId),
            as: MembershipStatsResponse.self
        ) {
            audienceReach = Self.reach(from: stats.counts)
        }

        if let channelId {
            do {
                let history: BroadcastHistoryResponse = try await api.request(
                    AudienceProfileEndpoints.broadcastHistory(channelId: channelId)
                )
                recentBroadcasts = history.messages.compactMap(Self.recentBroadcast)
                recentsError = nil
            } catch {
                recentsError = (error as? APIError)?.errorDescription
                    ?? "Couldn't load recent broadcasts."
            }
        }
        recentsLoading = false
    }

    /// The real publish call, invoked through `performSend` by `.live`.
    ///
    /// Two legs, mirroring RN `broadcast.tsx:118-145`:
    ///   1. `POST /api/broadcast/channels/:id/messages` creates the
    ///      broadcast — which is a `Post` row.
    ///   2. `POST /api/upload/post-media/:messageId` attaches the picked
    ///      files (field `files`, ≤9) to that row. The upload route is the
    ///      only way regular media reaches a post, and it needs the id the
    ///      first leg returns.
    ///
    /// A failed upload does **not** unpublish the broadcast; it surfaces
    /// RN's "your update was posted, but some media failed" warning.
    func publish(_ draft: ComposeBroadcastDraft) async throws {
        guard let channelId else {
            throw ComposeBroadcastError(message: "Your broadcast channel isn't ready yet. Try again in a moment.")
        }
        let trimmed = draft.body.trimmingCharacters(in: .whitespacesAndNewlines)
        let files = draft.media.compactMap(\.uploadFile)
        // `createBroadcastMessageSchema` rejects a payload with neither text
        // nor already-hosted media, and locally-picked files can only be
        // attached after the post exists — so text is required when the
        // only media is local.
        guard !trimmed.isEmpty || !preUploadedMedia(for: draft).isEmpty else {
            throw ComposeBroadcastError(message: "Add a message to go with your media.")
        }
        let wire = Self.wire(for: draft.audience)
        let body = PublishUpdateBody(
            body: trimmed,
            visibility: wire.visibility,
            targetTierRank: wire.rank,
            media: preUploadedMedia(for: draft),
            latitude: selectedPlaceTag?.latitude,
            longitude: selectedPlaceTag?.longitude,
            locationName: selectedPlaceTag?.name,
            locationAddress: selectedPlaceTag?.address,
            placeId: selectedPlaceTag?.placeId
        )
        let response: PublishUpdateResponse = try await api.request(
            AudienceProfileEndpoints.publishUpdate(channelId: channelId, body: body)
        )

        guard !files.isEmpty else { return }
        guard let messageId = response.message?.id else {
            throw ComposeBroadcastError(
                message: "Your update was posted, but some media failed to upload."
            )
        }
        do {
            _ = try await uploader.uploadPostMedia(postId: messageId, files: files)
        } catch {
            throw ComposeBroadcastError(
                message: "Your update was posted, but some media failed to upload."
            )
        }
    }

    /// Attachments that are already hosted — they ride the publish body's
    /// `media[]` field (`backend/routes/broadcastChannels.js:113`) rather
    /// than the post-media upload leg.
    private func preUploadedMedia(for draft: ComposeBroadcastDraft) -> [BroadcastMediaPayload] {
        draft.media.compactMap { item in
            guard let url = item.remoteURL, !url.isEmpty else { return nil }
            return BroadcastMediaPayload(url: url, type: item.kind.rawValue)
        }
    }

    // MARK: - Derived state

    public var state: ComposeBroadcastState {
        switch phase {
        case .sending:
            return .sending
        case let .error(message):
            return .error(message: message)
        case .idle:
            if let sendAt = scheduledAt {
                return .scheduled(draft, sendAt: sendAt)
            }
            return draft.isEmpty ? .empty : .composing(draft)
        }
    }

    public var characterCount: Int {
        draft.body.count
    }

    public var isOverLimit: Bool {
        characterCount > maxCharacterCount
    }

    public var hasRecentBroadcasts: Bool {
        !recentBroadcasts.isEmpty
    }

    public var isSending: Bool {
        phase == .sending
    }

    /// Send is allowed once there's content, we're under the character
    /// limit, and a send isn't already in flight.
    public var canSend: Bool {
        guard phase != .sending else { return false }
        guard !draft.isEmpty else { return false }
        return !isOverLimit
    }

    /// Drives the top-bar unsaved-draft chip — content exists and it
    /// diverges from the last saved snapshot.
    public var isDirty: Bool {
        !draft.isEmpty && draft != lastSavedDraft
    }

    /// CTA copy flips to first-run when the persona has never broadcast.
    public var primaryActionTitle: String {
        hasRecentBroadcasts ? "Send broadcast" : "Send your first broadcast"
    }

    public func reach(for audience: BroadcastAudience) -> Int? {
        audienceReach[audience]
    }

    // MARK: - Editing intents

    public func updateBody(_ text: String) {
        draft.body = text
        recoverFromError()
    }

    public func setAudience(_ audience: BroadcastAudience) {
        draft.audience = audience
        recoverFromError()
    }

    /// Append one attachment, respecting the nine-item cap.
    public func attachMedia(_ media: ComposeMediaPreview) {
        attachMedia([media])
    }

    /// Append a multi-select batch, truncated to the remaining slots —
    /// RN parity (`broadcast.tsx:92` `appendMediaFiles`).
    public func attachMedia(_ items: [ComposeMediaPreview]) {
        guard !items.isEmpty else { return }
        draft.media = Array((draft.media + items).prefix(ComposeBroadcastDraft.mediaLimit))
        recoverFromError()
    }

    public func removeMedia(id: String) {
        draft.media.removeAll { $0.id == id }
        recoverFromError()
    }

    /// Clear every attachment.
    public func removeMedia() {
        draft.media = []
        recoverFromError()
    }

    public func selectPlaceTag(_ tag: PostPlaceTag) {
        selectedPlaceTag = tag
        recoverFromError()
    }

    public func clearPlaceTag() {
        selectedPlaceTag = nil
        recoverFromError()
    }

    /// How many more attachments the composer will accept.
    public var remainingMediaSlots: Int {
        draft.remainingMediaSlots
    }

    /// Capture location of the first geotagged attachment — stills in
    /// attach order first, then videos — passed to `PlacePickerSheet`
    /// as its "Photo location" anchor. Derived from the draft's media,
    /// so it recomputes on every add / remove. PRIVACY: a local picker
    /// anchor ONLY — the publish body carries just the explicitly
    /// picked venue, never this coordinate.
    public var mediaCaptureLocation: MediaCaptureLocation? {
        let stills = draft.media.filter { $0.kind == .image }
        let videos = draft.media.filter { $0.kind == .video }
        for item in stills + videos {
            if let latitude = item.capturedLatitude, let longitude = item.capturedLongitude {
                return MediaCaptureLocation(latitude: latitude, longitude: longitude)
            }
        }
        return nil
    }

    public func schedule(at date: Date) {
        scheduledAt = date
        recoverFromError()
    }

    public func sendNow() {
        scheduledAt = nil
        recoverFromError()
    }

    /// Persist the current draft. No backend — we just snapshot it so the
    /// unsaved-draft chip clears.
    public func saveDraft() {
        lastSavedDraft = draft
    }

    /// Leave the error phase and return to the live composer.
    public func retry() {
        if case .error = phase { phase = .idle }
    }

    public func send() async {
        guard canSend else { return }
        let snapshot = draft
        let sendAt = scheduledAt
        phase = .sending
        do {
            try await performSend(snapshot, sendAt)
            // Reset the composer but keep the chosen audience as the
            // default for the next broadcast.
            draft = ComposeBroadcastDraft(audience: snapshot.audience)
            selectedPlaceTag = nil
            scheduledAt = nil
            lastSavedDraft = draft
            phase = .idle
            onSent()
        } catch {
            phase = .error(Self.message(for: error))
        }
    }

    // MARK: - Helpers

    /// Any edit clears a prior send error so the composer is live again.
    private func recoverFromError() {
        if case .error = phase { phase = .idle }
    }

    private static func message(for error: any Error) -> String {
        if let localized = error as? any LocalizedError, let description = localized.errorDescription {
            return description
        }
        return "Couldn't send broadcast. Try again."
    }

    /// Map the targeting chip onto the broadcast `visibility` +
    /// `target_tier_rank` wire contract (`broadcastChannels.js`).
    static func wire(for audience: BroadcastAudience) -> (visibility: String, rank: Int?) {
        switch audience {
        case .allBeacons: ("public", nil)
        case .followersOnly: ("followers", nil)
        case .bronzePlus: ("tier_or_above", 2)
        case .silverPlus: ("tier_or_above", 3)
        case .goldOnly: ("tier_or_above", 4)
        }
    }

    /// Map a broadcast message back onto a targeting chip for the recents
    /// list. The inverse of `wire(for:)`.
    static func audience(visibility: String?, targetTierRank: Int?) -> BroadcastAudience {
        switch visibility {
        case "public": .allBeacons
        case "followers": .followersOnly
        case "tier_or_above", "subscribers":
            switch targetTierRank ?? 2 {
            case ...2: .bronzePlus
            case 3: .silverPlus
            default: .goldOnly
            }
        default: .allBeacons
        }
    }

    /// Cumulative per-tier counts → per-chip reach. `allBeacons` /
    /// `followersOnly` both reach the full follower base.
    static func reach(from counts: MembershipStatsCounts) -> [BroadcastAudience: Int] {
        [
            .allBeacons: counts.followers ?? 0,
            .followersOnly: counts.followers ?? 0,
            .bronzePlus: counts.members ?? 0,
            .silverPlus: counts.insiders ?? 0,
            .goldOnly: counts.direct ?? 0
        ]
    }

    static func persona(from summary: PersonaSummaryDTO, fallback: BroadcastPersona) -> BroadcastPersona {
        let name = summary.displayName ?? summary.handle ?? fallback.displayName
        let handle = summary.handle.map { "@\($0)" } ?? fallback.handle
        return BroadcastPersona(
            id: summary.id,
            handle: handle,
            displayName: name,
            kind: fallback.kind,
            avatarInitial: name.first.map { String($0).uppercased() } ?? fallback.avatarInitial
        )
    }

    static func recentBroadcast(_ dto: BroadcastHistoryMessageDTO) -> RecentBroadcastContent? {
        guard dto.locked != true, let id = dto.id else { return nil }
        let delivered = dto.deliveredCount ?? 0
        let read = dto.readCount ?? 0
        let readPct = delivered > 0 ? "\(Int((Double(read) / Double(delivered) * 100).rounded()))%" : "—"
        return RecentBroadcastContent(
            id: id,
            timeLabel: relativeTime(from: dto.publishedAt ?? dto.createdAt),
            audience: audience(visibility: dto.visibility, targetTierRank: dto.targetTierRank),
            body: dto.body ?? "",
            reach: shortCount(delivered),
            read: shortCount(read),
            readPct: readPct,
            // The broadcast serializer carries no reaction / reply counts.
            reactions: "—",
            replies: "—",
            hasMedia: !(dto.media?.isEmpty ?? true)
        )
    }

    static func shortCount(_ count: Int) -> String {
        if count < 1000 { return "\(count)" }
        let thousands = Double(count) / 1000.0
        if count < 10000 { return String(format: "%.1fK", thousands) }
        return "\(Int(thousands.rounded()))K"
    }

    static func relativeTime(from iso: String?) -> String {
        guard let iso, let date = parseDate(iso) else { return "" }
        let minutes = Int(Date().timeIntervalSince(date) / 60)
        if minutes < 1 { return "Just now" }
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return hours == 1 ? "1h ago" : "\(hours)h ago" }
        let days = hours / 24
        if days == 1 { return "Yesterday" }
        if days < 7 { return "\(days)d ago" }
        return "\(days / 7)w ago"
    }

    private static func parseDate(_ iso: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }
}

/// Client-side compose failure (e.g. the channel hasn't resolved yet).
/// `LocalizedError` so the composer's error banner shows the message.
struct ComposeBroadcastError: LocalizedError {
    let message: String
    var errorDescription: String? {
        message
    }
}
