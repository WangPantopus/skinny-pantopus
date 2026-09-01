//
//  MailTranslationContent.swift
//  Pantopus
//
//  A17.13 — Translation. Projection + state vocabulary for the mail
//  Translation screen. A mail item auto-translated by Pantopus, with a
//  side-by-side comparison, a translator-notes glossary, a "listen" stub,
//  and a machine → confirmed transition.
//
//  The screen is sample-data driven (real MT / TTS is out of scope, per
//  the B2.3 brief) but ships the four DoD states off a single view-model
//  so loading / loaded / error all render cleanly.
//

import Foundation

/// Loadable state for the Translation screen.
@MainActor
public enum MailTranslationState {
    case loading
    case loaded(MailTranslationContent)
    case error(message: String)
}

/// Which body the `ViewToggle` is showing.
public enum TranslationViewMode: String, Sendable, CaseIterable, Hashable {
    /// Clean target-language reading view.
    case translated
    /// Source-language original only.
    case original
    /// Paragraph-aligned original ↔ target columns.
    case side
}

/// Detected-source / chosen-target language pair.
public struct TranslationLanguages: Sendable, Equatable {
    /// Source ISO-ish display code, e.g. `ES`.
    public let sourceCode: String
    /// Source long name, e.g. `Spanish (Mexico)`.
    public let sourceName: String
    /// Detection confidence percentage, e.g. `98`. `nil` when the
    /// translator doesn't report one — the backend's `/p3/translate`
    /// route answers `{ translated_text, from_language, to_language,
    /// cached }` with no confidence, so the badge drops the "N% match"
    /// clause rather than inventing a number.
    public let confidence: Int?
    /// Target display code, e.g. `EN`.
    public let targetCode: String
    /// Target long name, e.g. `English`.
    public let targetName: String

    public init(
        sourceCode: String,
        sourceName: String,
        confidence: Int?,
        targetCode: String,
        targetName: String
    ) {
        self.sourceCode = sourceCode
        self.sourceName = sourceName
        self.confidence = confidence
        self.targetCode = targetCode
        self.targetName = targetName
    }
}

/// One aligned paragraph of the letter (original + translation).
public struct TranslationParagraph: Identifiable, Sendable, Equatable {
    public let id: Int
    /// Source-language text.
    public let original: String
    /// Target-language text.
    public let english: String
    /// Salutation line — rendered bold.
    public let isHeading: Bool
    /// Sign-off line — rendered italic.
    public let isSignoff: Bool

    public init(
        id: Int,
        original: String,
        english: String,
        isHeading: Bool = false,
        isSignoff: Bool = false
    ) {
        self.id = id
        self.original = original
        self.english = english
        self.isHeading = isHeading
        self.isSignoff = isSignoff
    }
}

/// A translator-note glossary entry.
public struct TranslationGlossaryNote: Identifiable, Sendable, Equatable {
    public let id: Int
    /// The term, e.g. `posada` or `quiosco → gazebo`.
    public let term: String
    /// The note kind pill, e.g. `kept in Spanish` / `word choice`.
    public let kind: String
    /// The explanatory note.
    public let note: String

    public init(id: Int, term: String, kind: String, note: String) {
        self.id = id
        self.term = term
        self.kind = kind
        self.note = note
    }
}

/// The "From" sender block.
public struct TranslationSender: Sendable, Equatable {
    public let initials: String
    public let name: String
    public let meta: String
    public let kind: String
    public let proof: String

    public init(initials: String, name: String, meta: String, kind: String, proof: String) {
        self.initials = initials
        self.name = name
        self.meta = meta
        self.kind = kind
        self.proof = proof
    }
}

/// One AI-elf bullet (icon glyph name + bold label + trailing text).
public struct TranslationElfBullet: Identifiable, Sendable, Equatable {
    public let id: Int
    public let icon: TranslationElfIcon
    public let label: String
    public let text: String

    public init(id: Int, icon: TranslationElfIcon, label: String, text: String) {
        self.id = id
        self.icon = icon
        self.label = label
        self.text = text
    }
}

/// The handful of glyphs the elf bullets use — kept as a tiny enum so the
/// content layer never imports the icon set directly.
public enum TranslationElfIcon: Sendable, Equatable {
    case languages
    case notes
    case listen
    case confirmed
    case archive
    case reply
}

/// The AI-elf strip payload (headline + summary + 3 bullets).
public struct TranslationElf: Sendable, Equatable {
    public let headline: String
    public let summary: String
    public let bullets: [TranslationElfBullet]

    public init(headline: String, summary: String, bullets: [TranslationElfBullet]) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
    }
}

/// The fully-projected Translation screen content. `confirmed` and
/// `viewMode` are the only mutable fields the view-model flips.
public struct MailTranslationContent: Sendable, Equatable {
    /// Source mail id this translation belongs to.
    public let mailId: String
    /// `true` once the user has confirmed the machine translation.
    public var confirmed: Bool
    /// Which body the toggle currently shows.
    public var viewMode: TranslationViewMode
    /// Category eyebrow label — always "Translation".
    public let categoryLabel: String
    /// Relative time string, e.g. "2h ago".
    public let timeLabel: String
    public let languages: TranslationLanguages
    public let paragraphs: [TranslationParagraph]
    /// The English term highlighted inline as a glossary anchor, e.g. "posada".
    public let highlightTerm: String?
    public let glossary: [TranslationGlossaryNote]
    public let sender: TranslationSender
    /// Sub-line under the confirmed banner, e.g.
    /// "Marked trusted by you · May 28 · 2:40 PM". Stamped when the user
    /// confirms, so it is `var`.
    public var confirmedStamp: String
    public let elfMachine: TranslationElf
    public let elfConfirmed: TranslationElf

    public init(
        mailId: String,
        confirmed: Bool,
        viewMode: TranslationViewMode,
        categoryLabel: String,
        timeLabel: String,
        languages: TranslationLanguages,
        paragraphs: [TranslationParagraph],
        highlightTerm: String?,
        glossary: [TranslationGlossaryNote],
        sender: TranslationSender,
        confirmedStamp: String,
        elfMachine: TranslationElf,
        elfConfirmed: TranslationElf
    ) {
        self.mailId = mailId
        self.confirmed = confirmed
        self.viewMode = viewMode
        self.categoryLabel = categoryLabel
        self.timeLabel = timeLabel
        self.languages = languages
        self.paragraphs = paragraphs
        self.highlightTerm = highlightTerm
        self.glossary = glossary
        self.sender = sender
        self.confirmedStamp = confirmedStamp
        self.elfMachine = elfMachine
        self.elfConfirmed = elfConfirmed
    }

    /// The elf payload for the current confirmation state.
    public var elf: TranslationElf {
        confirmed ? elfConfirmed : elfMachine
    }

    /// The glossary-note count string, e.g. "2 translator notes".
    public var glossaryCountLabel: String {
        "\(glossary.count) translator note\(glossary.count == 1 ? "" : "s")"
    }
}
