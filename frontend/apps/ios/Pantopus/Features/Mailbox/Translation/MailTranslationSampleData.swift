//
//  MailTranslationSampleData.swift
//  Pantopus
//
//  Deterministic fixtures for the A17.13 Translation screen. Mirrors the
//  vendored design spec (docs/designs/A17/translation.jsx) word-for-word so
//  iOS, Android, and the design frames stay identical. Real machine
//  translation is out of scope (B2.3) — these drive both the previews and
//  the snapshot baselines.
//

import Foundation

public enum MailTranslationSampleData {
    /// The canonical letter from Lucía Herrera (ES → EN).
    public static func letter(mailId: String = "mail-translation-sample") -> MailTranslationContent {
        MailTranslationContent(
            mailId: mailId,
            confirmed: false,
            viewMode: .side,
            categoryLabel: "Translation",
            timeLabel: "2h ago",
            languages: TranslationLanguages(
                sourceCode: "ES",
                sourceName: "Spanish (Mexico)",
                confidence: 98,
                targetCode: "EN",
                targetName: "English"
            ),
            paragraphs: paragraphs,
            highlightTerm: "posada",
            glossary: glossary,
            sender: sender,
            confirmedStamp: "Marked trusted by you · May 28 · 2:40 PM",
            elfMachine: elfMachine,
            elfConfirmed: elfConfirmed
        )
    }

    /// The same letter in its confirmed state (toggle defaults to translated).
    public static func confirmedLetter(mailId: String = "mail-translation-sample") -> MailTranslationContent {
        var content = letter(mailId: mailId)
        content.confirmed = true
        content.viewMode = .translated
        return content
    }

    private static let paragraphs: [TranslationParagraph] = [
        TranslationParagraph(
            id: 0,
            original: "Querida vecina,",
            english: "Dear neighbor,",
            isHeading: true
        ),
        TranslationParagraph(
            id: 1,
            original: "Le escribo para invitarla a la posada del sábado en el parque Elm. "
                + "Habrá tamales, ponche y música para las familias.",
            english: "I\u{2019}m writing to invite you to Saturday\u{2019}s posada at Elm Park. "
                + "There will be tamales, punch, and music for the families."
        ),
        TranslationParagraph(
            id: 2,
            original: "Si puede, traiga una vela para la procesión. "
                + "Empezamos a las seis de la tarde, junto al quiosco.",
            english: "If you can, bring a candle for the procession. "
                + "We start at six in the evening, by the gazebo."
        ),
        TranslationParagraph(
            id: 3,
            original: "Con cariño, su vecina Lucía.",
            english: "With love, your neighbor Lucía.",
            isSignoff: true
        )
    ]

    private static let glossary: [TranslationGlossaryNote] = [
        TranslationGlossaryNote(
            id: 0,
            term: "posada",
            kind: "kept in Spanish",
            note: "A traditional neighborhood gathering in the weeks before Christmas — "
                + "no single English word captures it."
        ),
        TranslationGlossaryNote(
            id: 1,
            term: "quiosco → gazebo",
            kind: "word choice",
            note: "Rendered as \u{201C}gazebo\u{201D} for the bandstand on the park lawn."
        )
    ]

    private static let sender = TranslationSender(
        initials: "LH",
        name: "Lucía Herrera",
        meta: "Neighbor · Elm Park · 3 doors down",
        kind: "Verified neighbor",
        proof: "Address verified"
    )

    private static let elfMachine = TranslationElf(
        headline: "Pantopus translated this letter",
        summary: "I auto-detected Spanish (Mexico) and rendered it in English with high confidence. "
            + "Two terms were judgment calls — I kept \u{201C}posada\u{201D} as-is and noted both below. "
            + "Confirm when it reads right and I\u{2019}ll mark the translation trusted.",
        bullets: [
            TranslationElfBullet(
                id: 0,
                icon: .languages,
                label: "Spanish → English",
                text: "98% confidence"
            ),
            TranslationElfBullet(
                id: 1,
                icon: .notes,
                label: "2 translator notes",
                text: "see the glossary below"
            ),
            TranslationElfBullet(
                id: 2,
                icon: .listen,
                label: "Listen in either language",
                text: "tap play on a column"
            )
        ]
    )

    private static let elfConfirmed = TranslationElf(
        headline: "Translation confirmed",
        summary: "You confirmed this English translation on May 28. Pantopus keeps both versions in "
            + "your Vault, so the original Spanish is never lost. Any reply you send can "
            + "auto-translate back for Lucía.",
        bullets: [
            TranslationElfBullet(
                id: 0,
                icon: .confirmed,
                label: "Confirmed by you",
                text: "May 28 · 2:40 PM"
            ),
            TranslationElfBullet(
                id: 1,
                icon: .archive,
                label: "Both versions saved",
                text: "original + English in Vault"
            ),
            TranslationElfBullet(
                id: 2,
                icon: .reply,
                label: "Reply in English",
                text: "we translate to Spanish on send"
            )
        ]
    )
}
