//
//  RecordsDetailDTO.swift
//  Pantopus
//
//  Records-mail sub-payload decoded from `mail.object_payload` when
//  `mail_type == "records"`. An archival delivery: a financial /
//  medical / legal document with an issuer, a per-document fact set
//  (account / period / balance / change), a cover-letter excerpt, the
//  destination Vault path, retention policy, and the related-record
//  siblings shown once filed. Backend stores this as untyped JSON in S3
//  (route handler at `backend/routes/mailboxV2.js:412`); `decode(from:)`
//  is defensive and returns nil when the payload lacks a title.
//

import Foundation

/// Issuer of the record (institution + dept + regulated identifier).
public struct RecordsIssuer: Sendable, Hashable {
    public let initials: String
    public let name: String
    public let dept: String
    public let identifier: String
    public let trustNote: String

    public init(initials: String, name: String, dept: String, identifier: String, trustNote: String) {
        self.initials = initials
        self.name = name
        self.dept = dept
        self.identifier = identifier
        self.trustNote = trustNote
    }

    static func decode(from value: JSONValue?) -> RecordsIssuer? {
        guard let dict = value?.dictValue,
              let initials = dict["initials"]?.stringValue,
              let name = dict["name"]?.stringValue,
              let dept = dict["dept"]?.stringValue,
              let identifier = dict["identifier"]?.stringValue,
              let trustNote = dict["trust_note"]?.stringValue
        else { return nil }
        return RecordsIssuer(
            initials: initials,
            name: name,
            dept: dept,
            identifier: identifier,
            trustNote: trustNote
        )
    }
}

/// One row in the records key-facts grid.
public struct RecordsFact: Sendable, Hashable, Identifiable {
    /// Drives the leading glyph.
    public enum Kind: String, Sendable, Hashable {
        case account
        case period
        case balance
        case change
        case statementDate
        case status
    }

    /// Tone for the value text (positive net change shows in success
    /// emerald, status row in success when filed).
    public enum Tone: String, Sendable, Hashable {
        case neutral
        case positive
    }

    public let kind: Kind
    public let label: String
    public let value: String
    public let note: String?
    public let mono: Bool
    public let tone: Tone
    public let emphasis: Bool

    public var id: String {
        kind.rawValue
    }

    public init(
        kind: Kind,
        label: String,
        value: String,
        note: String? = nil,
        mono: Bool = false,
        tone: Tone = .neutral,
        emphasis: Bool = false
    ) {
        self.kind = kind
        self.label = label
        self.value = value
        self.note = note
        self.mono = mono
        self.tone = tone
        self.emphasis = emphasis
    }

    static func decode(from value: JSONValue) -> RecordsFact? {
        guard let dict = value.dictValue,
              let rawKind = dict["kind"]?.stringValue,
              let kind = Kind(rawValue: rawKind),
              let label = dict["label"]?.stringValue,
              let factValue = dict["value"]?.stringValue
        else { return nil }
        let toneRaw = dict["tone"]?.stringValue ?? "neutral"
        return RecordsFact(
            kind: kind,
            label: label,
            value: factValue,
            note: dict["note"]?.stringValue,
            mono: dict["mono"]?.boolValue ?? false,
            tone: Tone(rawValue: toneRaw) ?? .neutral,
            emphasis: dict["emphasis"]?.boolValue ?? false
        )
    }
}

/// One bullet in the records-elf card (DKIM-verified, +4.2%, suggested path).
public struct RecordsElfBullet: Sendable, Hashable, Identifiable {
    /// Drives the leading glyph.
    public enum Glyph: String, Sendable, Hashable {
        case fileCheck
        case trendingUp
        case archive
        case lock
        case calendarClock
        case search
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

    static func decode(from value: JSONValue) -> RecordsElfBullet? {
        guard let dict = value.dictValue,
              let rawGlyph = dict["glyph"]?.stringValue,
              let glyph = Glyph(rawValue: rawGlyph),
              let label = dict["label"]?.stringValue,
              let text = dict["text"]?.stringValue
        else { return nil }
        return RecordsElfBullet(glyph: glyph, label: label, text: text)
    }
}

/// The "Pantopus opened this for you" elf card. Distinct copy for open
/// vs filed states.
public struct RecordsElfContent: Sendable, Hashable {
    public let headline: String
    public let summary: String
    public let bullets: [RecordsElfBullet]

    public init(headline: String, summary: String, bullets: [RecordsElfBullet]) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
    }

    static func decode(from value: JSONValue?) -> RecordsElfContent? {
        guard let dict = value?.dictValue,
              let headline = dict["headline"]?.stringValue,
              let summary = dict["summary"]?.stringValue
        else { return nil }
        let bullets = (dict["bullets"]?.arrayValue ?? []).compactMap(RecordsElfBullet.decode(from:))
        return RecordsElfContent(headline: headline, summary: summary, bullets: bullets)
    }
}

/// One crumb in the Vault destination breadcrumb.
public struct RecordsVaultCrumb: Sendable, Hashable, Identifiable {
    /// Drives the leading glyph.
    public enum Glyph: String, Sendable, Hashable {
        case inbox
        case archive
        case landmark
        case fileText
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

    static func decode(from value: JSONValue) -> RecordsVaultCrumb? {
        guard let dict = value.dictValue,
              let rawGlyph = dict["glyph"]?.stringValue,
              let glyph = Glyph(rawValue: rawGlyph),
              let label = dict["label"]?.stringValue
        else { return nil }
        return RecordsVaultCrumb(
            glyph: glyph,
            label: label,
            isCurrent: dict["current"]?.boolValue ?? false
        )
    }
}

/// One row in the related-records strip (sibling quarterlies, filed state).
public struct RelatedRecord: Sendable, Hashable, Identifiable {
    public let id: String
    public let period: String
    public let amount: String
    public let filedWhen: String

    public init(id: String = UUID().uuidString, period: String, amount: String, filedWhen: String) {
        self.id = id
        self.period = period
        self.amount = amount
        self.filedWhen = filedWhen
    }

    static func decode(from value: JSONValue) -> RelatedRecord? {
        guard let dict = value.dictValue,
              let period = dict["period"]?.stringValue,
              let amount = dict["amount"]?.stringValue,
              let filedWhen = dict["filed_when"]?.stringValue
        else { return nil }
        return RelatedRecord(
            id: dict["id"]?.stringValue ?? period,
            period: period,
            amount: amount,
            filedWhen: filedWhen
        )
    }
}

/// Records detail payload — drives the A17.10 archival body.
public struct RecordsDetailDTO: Sendable, Hashable {
    public let title: String
    public let reference: String
    public let docKind: String
    public let docClassLabel: String
    public let retentionLine: String
    public let issuer: RecordsIssuer
    public let openingFacts: [RecordsFact]
    public let bodyParagraphs: [String]
    public let coverPageHint: String
    public let pageCount: Int
    public let vaultTrail: [RecordsVaultCrumb]
    public let related: [RelatedRecord]
    public let elfOpen: RecordsElfContent
    public let elfFiled: RecordsElfContent
    public let filedAtLabel: String?
    /// True once the user has filed the record in their Vault.
    public let isFiled: Bool

    public init(
        title: String,
        reference: String,
        docKind: String,
        docClassLabel: String,
        retentionLine: String,
        issuer: RecordsIssuer,
        openingFacts: [RecordsFact],
        bodyParagraphs: [String],
        coverPageHint: String,
        pageCount: Int,
        vaultTrail: [RecordsVaultCrumb],
        related: [RelatedRecord],
        elfOpen: RecordsElfContent,
        elfFiled: RecordsElfContent,
        filedAtLabel: String? = nil,
        isFiled: Bool = false
    ) {
        self.title = title
        self.reference = reference
        self.docKind = docKind
        self.docClassLabel = docClassLabel
        self.retentionLine = retentionLine
        self.issuer = issuer
        self.openingFacts = openingFacts
        self.bodyParagraphs = bodyParagraphs
        self.coverPageHint = coverPageHint
        self.pageCount = pageCount
        self.vaultTrail = vaultTrail
        self.related = related
        self.elfOpen = elfOpen
        self.elfFiled = elfFiled
        self.filedAtLabel = filedAtLabel
        self.isFiled = isFiled
    }

    /// Facts ordered for the KeyFacts panel. In filed state the
    /// `Status · Filed in Vault` row is prepended.
    public func factsForState(filed: Bool) -> [RecordsFact] {
        guard filed else { return openingFacts }
        let statusRow = RecordsFact(
            kind: .status,
            label: "Status",
            value: "Filed in Vault",
            note: "Locked · indexed · searchable",
            tone: .positive,
            emphasis: true
        )
        return [statusRow] + openingFacts
    }

    /// Returns a copy with `isFiled` flipped — used by the view-model's
    /// optimistic "file in vault" flow.
    public func withFiled(_ filed: Bool, filedAtLabel: String? = nil) -> RecordsDetailDTO {
        RecordsDetailDTO(
            title: title,
            reference: reference,
            docKind: docKind,
            docClassLabel: docClassLabel,
            retentionLine: retentionLine,
            issuer: issuer,
            openingFacts: openingFacts,
            bodyParagraphs: bodyParagraphs,
            coverPageHint: coverPageHint,
            pageCount: pageCount,
            vaultTrail: vaultTrail,
            related: related,
            elfOpen: elfOpen,
            elfFiled: elfFiled,
            filedAtLabel: filedAtLabel ?? self.filedAtLabel,
            isFiled: filed
        )
    }

    /// Best-effort decode. Returns nil when the payload is missing the
    /// bare-minimum field set (`title`) or its presentation blocks
    /// (`issuer`, `elf_open`, `elf_filed`).
    public static func decode(from value: JSONValue?) -> RecordsDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        guard let title = dict["title"]?.stringValue, !title.isEmpty else { return nil }
        guard let issuer = RecordsIssuer.decode(from: dict["issuer"]),
              let elfOpen = RecordsElfContent.decode(from: dict["elf_open"]),
              let elfFiled = RecordsElfContent.decode(from: dict["elf_filed"])
        else { return nil }

        let trail = (dict["vault_trail"]?.arrayValue ?? []).compactMap(RecordsVaultCrumb.decode(from:))
        guard !trail.isEmpty else { return nil }

        let related = (dict["related"]?.arrayValue ?? []).compactMap(RelatedRecord.decode(from:))
        let facts = (dict["facts"]?.arrayValue ?? []).compactMap(RecordsFact.decode(from:))
        let body = (dict["body"]?.arrayValue ?? []).compactMap(\.stringValue)

        return RecordsDetailDTO(
            title: title,
            reference: dict["reference"]?.stringValue ?? "",
            docKind: dict["doc_kind"]?.stringValue ?? "Records",
            docClassLabel: dict["doc_class_label"]?.stringValue ?? "Record",
            retentionLine: dict["retention_line"]?.stringValue ?? "",
            issuer: issuer,
            openingFacts: facts,
            bodyParagraphs: body,
            coverPageHint: dict["cover_page_hint"]?.stringValue ?? "p. 1 / 1",
            pageCount: dict["page_count"]?.numberValue.map(Int.init) ?? 1,
            vaultTrail: trail,
            related: related,
            elfOpen: elfOpen,
            elfFiled: elfFiled,
            filedAtLabel: dict["filed_at_label"]?.stringValue,
            isFiled: dict["is_filed"]?.boolValue ?? false
        )
    }
}
