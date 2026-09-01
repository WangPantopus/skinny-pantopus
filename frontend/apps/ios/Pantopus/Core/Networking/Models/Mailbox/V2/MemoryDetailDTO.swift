//
//  MemoryDetailDTO.swift
//  Pantopus
//
//  Memory-mail sub-payload decoded from `mail.object_payload` when
//  `mail_type == "memory"`. A keepsake delivery: a photograph, a
//  handwritten note, the factual context behind the moment, and the
//  "why Pantopus surfaced this" elf — plus a vault-location summary for
//  the saved state. Backend stores this as untyped JSON in S3 (route
//  handler at `backend/routes/mailboxV2.js:412`); `decode(from:)` is
//  defensive and returns nil when the payload carries no title.
//

import Foundation

/// One contextual fact behind the memory ("a year ago today", the
/// originating Pulse thread, where it happened, who else helped).
public struct MemoryFact: Sendable, Hashable, Identifiable {
    /// Drives both the leading glyph and the row's `accessibilityIdentifier`.
    public enum Kind: String, Sendable, Hashable {
        case anniversary
        case pulseThread
        case location
        case others
    }

    public let kind: Kind
    public let label: String
    public let value: String
    /// Optional link affordance ("tap to reopen the thread"). When set the
    /// row is rendered as a tappable button.
    public let linkHint: String?

    public var id: String {
        kind.rawValue
    }

    public init(kind: Kind, label: String, value: String, linkHint: String? = nil) {
        self.kind = kind
        self.label = label
        self.value = value
        self.linkHint = linkHint
    }

    static func decode(from value: JSONValue) -> MemoryFact? {
        guard let dict = value.dictValue,
              let rawKind = dict["kind"]?.stringValue,
              let kind = Kind(rawValue: rawKind),
              let label = dict["label"]?.stringValue,
              let factValue = dict["value"]?.stringValue
        else { return nil }
        return MemoryFact(
            kind: kind,
            label: label,
            value: factValue,
            linkHint: dict["link_hint"]?.stringValue
        )
    }
}

/// One bullet in the memory elf card.
public struct MemoryElfBullet: Sendable, Hashable, Identifiable {
    public enum Glyph: String, Sendable, Hashable {
        case calendar
        case image
        case shieldCheck
        case archive
        case eyeOff
        case bell
    }

    public let glyph: Glyph
    public let label: String
    public let text: String

    public var id: String {
        label
    }

    public init(glyph: Glyph, label: String, text: String) {
        self.glyph = glyph
        self.label = label
        self.text = text
    }

    static func decode(from value: JSONValue) -> MemoryElfBullet? {
        guard let dict = value.dictValue,
              let rawGlyph = dict["glyph"]?.stringValue,
              let glyph = Glyph(rawValue: rawGlyph),
              let label = dict["label"]?.stringValue,
              let text = dict["text"]?.stringValue
        else { return nil }
        return MemoryElfBullet(glyph: glyph, label: label, text: text)
    }
}

/// The "Pantopus surfaced this" elf card. Distinct copy for fresh vs
/// saved states.
public struct MemoryElfContent: Sendable, Hashable {
    public let headline: String
    public let summary: String
    public let bullets: [MemoryElfBullet]

    public init(headline: String, summary: String, bullets: [MemoryElfBullet]) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
    }

    static func decode(from value: JSONValue?) -> MemoryElfContent? {
        guard let dict = value?.dictValue,
              let headline = dict["headline"]?.stringValue,
              let summary = dict["summary"]?.stringValue
        else { return nil }
        let bullets = (dict["bullets"]?.arrayValue ?? []).compactMap(MemoryElfBullet.decode(from:))
        return MemoryElfContent(headline: headline, summary: summary, bullets: bullets)
    }
}

/// One crumb in the vault-location breadcrumb.
public struct MemoryVaultCrumb: Sendable, Hashable, Identifiable {
    public enum Glyph: String, Sendable, Hashable {
        case inbox
        case archive
        case heart
        case calendar
    }

    public let glyph: Glyph
    public let label: String
    public let isCurrent: Bool

    public var id: String {
        label
    }

    public init(glyph: Glyph, label: String, isCurrent: Bool) {
        self.glyph = glyph
        self.label = label
        self.isCurrent = isCurrent
    }

    static func decode(from value: JSONValue) -> MemoryVaultCrumb? {
        guard let dict = value.dictValue,
              let rawGlyph = dict["glyph"]?.stringValue,
              let glyph = Glyph(rawValue: rawGlyph),
              let label = dict["label"]?.stringValue
        else { return nil }
        return MemoryVaultCrumb(
            glyph: glyph,
            label: label,
            isCurrent: dict["current"]?.boolValue ?? false
        )
    }
}

/// A single counter in the vault summary row.
public struct MemoryVaultStat: Sendable, Hashable, Identifiable {
    public let value: String
    public let label: String

    public var id: String {
        label
    }

    public init(value: String, label: String) {
        self.value = value
        self.label = label
    }

    static func decode(from value: JSONValue) -> MemoryVaultStat? {
        guard let dict = value.dictValue,
              let statValue = dict["value"]?.stringValue,
              let label = dict["label"]?.stringValue
        else { return nil }
        return MemoryVaultStat(value: statValue, label: label)
    }
}

/// Where the memory is filed once kept — rendered in the saved state in
/// place of the facts grid.
public struct MemoryVaultInfo: Sendable, Hashable {
    public let trail: [MemoryVaultCrumb]
    public let stats: [MemoryVaultStat]

    public init(trail: [MemoryVaultCrumb], stats: [MemoryVaultStat]) {
        self.trail = trail
        self.stats = stats
    }

    static func decode(from value: JSONValue?) -> MemoryVaultInfo? {
        guard let dict = value?.dictValue else { return nil }
        let trail = (dict["trail"]?.arrayValue ?? []).compactMap(MemoryVaultCrumb.decode(from:))
        let stats = (dict["stats"]?.arrayValue ?? []).compactMap(MemoryVaultStat.decode(from:))
        guard !trail.isEmpty else { return nil }
        return MemoryVaultInfo(trail: trail, stats: stats)
    }
}

/// Memory detail payload — drives the A17.7 keepsake body.
public struct MemoryDetailDTO: Sendable, Hashable {
    public let title: String
    public let reference: String
    public let photoURL: URL?
    public let photoCaption: String
    public let photoLabel: String
    public let note: [String]
    public let noteSignature: String
    public let facts: [MemoryFact]
    public let elfFresh: MemoryElfContent
    public let elfSaved: MemoryElfContent
    public let vault: MemoryVaultInfo
    /// True once the user has kept this memory in their vault.
    public let isSaved: Bool

    public init(
        title: String,
        reference: String,
        photoURL: URL?,
        photoCaption: String,
        photoLabel: String,
        note: [String],
        noteSignature: String,
        facts: [MemoryFact],
        elfFresh: MemoryElfContent,
        elfSaved: MemoryElfContent,
        vault: MemoryVaultInfo,
        isSaved: Bool
    ) {
        self.title = title
        self.reference = reference
        self.photoURL = photoURL
        self.photoCaption = photoCaption
        self.photoLabel = photoLabel
        self.note = note
        self.noteSignature = noteSignature
        self.facts = facts
        self.elfFresh = elfFresh
        self.elfSaved = elfSaved
        self.vault = vault
        self.isSaved = isSaved
    }

    /// Returns a copy with `isSaved` flipped — used by the view-model's
    /// optimistic "save to vault" flow.
    public func withSaved(_ saved: Bool) -> MemoryDetailDTO {
        MemoryDetailDTO(
            title: title,
            reference: reference,
            photoURL: photoURL,
            photoCaption: photoCaption,
            photoLabel: photoLabel,
            note: note,
            noteSignature: noteSignature,
            facts: facts,
            elfFresh: elfFresh,
            elfSaved: elfSaved,
            vault: vault,
            isSaved: saved
        )
    }

    /// Best-effort decode. Returns nil when the payload is missing the
    /// bare-minimum field set (`title`) or its presentation blocks
    /// (`elf_fresh`, `elf_saved`, `vault`).
    public static func decode(from value: JSONValue?) -> MemoryDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        guard let title = dict["title"]?.stringValue, !title.isEmpty else { return nil }
        guard let elfFresh = MemoryElfContent.decode(from: dict["elf_fresh"]),
              let elfSaved = MemoryElfContent.decode(from: dict["elf_saved"]),
              let vault = MemoryVaultInfo.decode(from: dict["vault"])
        else { return nil }

        let photo = dict["photo"]?.dictValue
        let note = (dict["note"]?.arrayValue ?? []).compactMap(\.stringValue)
        let facts = (dict["facts"]?.arrayValue ?? []).compactMap(MemoryFact.decode(from:))

        return MemoryDetailDTO(
            title: title,
            reference: dict["reference"]?.stringValue ?? "",
            photoURL: photo?["url"]?.stringValue.flatMap(URL.init(string:)),
            photoCaption: photo?["caption"]?.stringValue ?? "",
            photoLabel: photo?["label"]?.stringValue ?? "",
            note: note,
            noteSignature: dict["note_signature"]?.stringValue ?? "",
            facts: facts,
            elfFresh: elfFresh,
            elfSaved: elfSaved,
            vault: vault,
            isSaved: dict["is_saved"]?.boolValue ?? false
        )
    }
}
