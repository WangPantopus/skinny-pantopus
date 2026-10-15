//
//  PulseComposerDraft.swift
//  Pantopus
//
//  What the one-box composer is writing (Pulse S8), kept per account on
//  this device so a draft survives switching apps, a relaunch and signing
//  out and back in (build spec §5). Photos are kept beside it as files.
//

import Foundation

/// The six kinds of Pulse post (contract §1), in the composer's words.
public enum PulsePostKind: String, CaseIterable, Codable, Sendable, Identifiable {
    case ask = "ask_local"
    case share
    case offer
    case headsUp = "alert"
    case event
    case lostFound = "lost_found"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .ask: "Ask"
        case .share: "Share"
        case .offer: "Offer"
        case .headsUp: "Heads-up"
        case .event: "Event"
        case .lostFound: "Lost and found"
        }
    }
}

/// One draft. Everything but the photos, which live in files beside it.
struct PulseComposerDraft: Codable, Equatable {
    var text = ""
    var kind: PulsePostKind = .ask
    /// One of the twelve topics; nil is none.
    var topic: String?
    /// The street, neighborhood or town it's about; nil is the home town.
    var areaId: String?
    /// The place named for it ("Crown Park"); a Share needs one in a town.
    var placeName = ""
    /// A town post read by verified neighbors only (`verified_town`).
    var townVerifiedOnly = false
    var claimMode = "choose"
    var headsUpKind = PulseSafetyAlertKind.hazard.rawValue
    var headsUpEnds: Date?
    var eventStarts: Date?
    var lostFound = "lost"
    /// One id per post, kept across retries so a retry never posts twice.
    var clientRequestId = UUID().uuidString

    var isBlank: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && placeName.isEmpty
    }
}

/// The current account's draft and its photos, in Application Support.
struct PulseComposerDraftStore {
    let userId: String

    private var folder: URL? {
        guard !userId.isEmpty,
              let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        else { return nil }
        return base.appendingPathComponent("PulseComposerDrafts/\(userId)", isDirectory: true)
    }

    func load() -> (draft: PulseComposerDraft, photos: [PulseComposePhoto])? {
        guard let folder,
              let data = try? Data(contentsOf: folder.appendingPathComponent("draft.json")),
              let draft = try? JSONDecoder().decode(PulseComposerDraft.self, from: data) else { return nil }
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        let photos = names.filter { $0.hasPrefix("photo-") }.sorted().compactMap { name in
            (try? Data(contentsOf: folder.appendingPathComponent(name))).map { PulseComposePhoto(data: $0) }
        }
        return (draft, photos)
    }

    func save(_ draft: PulseComposerDraft, photos: [PulseComposePhoto]) {
        guard let folder else { return }
        let manager = FileManager.default
        try? manager.removeItem(at: folder)
        guard !draft.isBlank || !photos.isEmpty,
              (try? manager.createDirectory(at: folder, withIntermediateDirectories: true)) != nil,
              let data = try? JSONEncoder().encode(draft) else { return }
        try? data.write(to: folder.appendingPathComponent("draft.json"), options: [.atomic, .completeFileProtection])
        for (index, photo) in photos.enumerated() {
            try? photo.data.write(to: folder.appendingPathComponent(String(format: "photo-%02d", index)), options: .atomic)
        }
    }

    func clear() {
        guard let folder else { return }
        try? FileManager.default.removeItem(at: folder)
    }
}
