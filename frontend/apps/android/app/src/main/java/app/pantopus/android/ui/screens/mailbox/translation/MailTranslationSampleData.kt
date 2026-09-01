@file:Suppress("PackageNaming", "MaxLineLength")

package app.pantopus.android.ui.screens.mailbox.translation

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Deterministic fixtures for the A17.13 Translation screen. Mirrors the
 * vendored design spec (`docs/designs/A17/translation.jsx`) word-for-word
 * so iOS, Android, and the design frames stay identical. Real machine
 * translation is out of scope (B2.3) — these drive both the previews and
 * the Paparazzi baselines. Mirrors iOS `MailTranslationSampleData`.
 */
object MailTranslationSampleData {
    /** The canonical letter from Lucía Herrera (ES → EN), machine state. */
    fun letter(mailId: String = "mail-translation-sample"): MailTranslationContent =
        MailTranslationContent(
            mailId = mailId,
            confirmed = false,
            viewMode = TranslationViewMode.Side,
            categoryLabel = "Translation",
            timeLabel = "2h ago",
            languages =
                TranslationLanguages(
                    sourceCode = "ES",
                    sourceName = "Spanish (Mexico)",
                    confidence = 98,
                    targetCode = "EN",
                    targetName = "English",
                ),
            paragraphs = paragraphs,
            highlightTerm = "posada",
            glossary = glossary,
            sender = sender,
            confirmedStamp = "Marked trusted by you · May 28 · 2:40 PM",
            elfMachine = elfMachine,
            elfConfirmed = elfConfirmed,
        )

    /** The same letter in its confirmed state (toggle defaults to translated). */
    fun confirmedLetter(mailId: String = "mail-translation-sample"): MailTranslationContent =
        letter(mailId).copy(confirmed = true, viewMode = TranslationViewMode.Translated)

    private val paragraphs =
        listOf(
            TranslationParagraph(
                id = 0,
                original = "Querida vecina,",
                english = "Dear neighbor,",
                isHeading = true,
            ),
            TranslationParagraph(
                id = 1,
                original =
                    "Le escribo para invitarla a la posada del sábado en el parque Elm. " +
                        "Habrá tamales, ponche y música para las familias.",
                english =
                    "I’m writing to invite you to Saturday’s posada at Elm Park. " +
                        "There will be tamales, punch, and music for the families.",
            ),
            TranslationParagraph(
                id = 2,
                original =
                    "Si puede, traiga una vela para la procesión. " +
                        "Empezamos a las seis de la tarde, junto al quiosco.",
                english =
                    "If you can, bring a candle for the procession. " +
                        "We start at six in the evening, by the gazebo.",
            ),
            TranslationParagraph(
                id = 3,
                original = "Con cariño, su vecina Lucía.",
                english = "With love, your neighbor Lucía.",
                isSignoff = true,
            ),
        )

    private val glossary =
        listOf(
            TranslationGlossaryNote(
                id = 0,
                term = "posada",
                kind = "kept in Spanish",
                note =
                    "A traditional neighborhood gathering in the weeks before Christmas — " +
                        "no single English word captures it.",
            ),
            TranslationGlossaryNote(
                id = 1,
                term = "quiosco → gazebo",
                kind = "word choice",
                note = "Rendered as “gazebo” for the bandstand on the park lawn.",
            ),
        )

    private val sender =
        TranslationSender(
            initials = "LH",
            name = "Lucía Herrera",
            meta = "Neighbor · Elm Park · 3 doors down",
            kind = "Verified neighbor",
            proof = "Address verified",
        )

    private val elfMachine =
        TranslationElf(
            headline = "Pantopus translated this letter",
            summary =
                "I auto-detected Spanish (Mexico) and rendered it in English with high confidence. " +
                    "Two terms were judgment calls — I kept “posada” as-is and noted both below. " +
                    "Confirm when it reads right and I’ll mark the translation trusted.",
            bullets =
                listOf(
                    TranslationElfBullet(0, PantopusIcon.Globe, "Spanish → English", "98% confidence"),
                    TranslationElfBullet(1, PantopusIcon.FileText, "2 translator notes", "see the glossary below"),
                    TranslationElfBullet(2, PantopusIcon.Play, "Listen in either language", "tap play on a column"),
                ),
        )

    private val elfConfirmed =
        TranslationElf(
            headline = "Translation confirmed",
            summary =
                "You confirmed this English translation on May 28. Pantopus keeps both versions in " +
                    "your Vault, so the original Spanish is never lost. Any reply you send can " +
                    "auto-translate back for Lucía.",
            bullets =
                listOf(
                    TranslationElfBullet(0, PantopusIcon.BadgeCheck, "Confirmed by you", "May 28 · 2:40 PM"),
                    TranslationElfBullet(1, PantopusIcon.Archive, "Both versions saved", "original + English in Vault"),
                    TranslationElfBullet(2, PantopusIcon.Reply, "Reply in English", "we translate to Spanish on send"),
                ),
        )
}
