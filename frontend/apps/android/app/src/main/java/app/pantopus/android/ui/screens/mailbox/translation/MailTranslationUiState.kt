@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.translation

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

/** Nav arg key for the A17.13 Translation route. Mirrors iOS. */
const val TRANSLATION_MAIL_ID_KEY = "mailId"

/**
 * A17.13 — Translation. Lifecycle state for the mail-translation screen.
 * Mirrors iOS `MailTranslationState`.
 */
sealed interface MailTranslationUiState {
    data object Loading : MailTranslationUiState

    data class Loaded(val content: MailTranslationContent) : MailTranslationUiState

    data class Error(val message: String) : MailTranslationUiState
}

/** Which body the [TranslationViewToggle] is showing. */
enum class TranslationViewMode {
    /** Clean target-language reading view. */
    Translated,

    /** Source-language original only. */
    Original,

    /** Paragraph-aligned original ↔ target columns. */
    Side,
}

/** Which column the "Listen" stub reads. */
enum class TranslationListenColumn { Original, Translated }

/** Detected-source / chosen-target language pair. */
@Immutable
data class TranslationLanguages(
    val sourceCode: String,
    val sourceName: String,
    /**
     * Detection confidence percentage, e.g. `98`. Null when the
     * translator doesn't report one — the backend's `/p3/translate` route
     * answers `{ translated_text, from_language, to_language, cached }`
     * with no confidence, so the badge drops the "N% match" clause
     * rather than inventing a number.
     */
    val confidence: Int?,
    val targetCode: String,
    val targetName: String,
)

/** One aligned paragraph of the letter (original + translation). */
@Immutable
data class TranslationParagraph(
    val id: Int,
    val original: String,
    val english: String,
    val isHeading: Boolean = false,
    val isSignoff: Boolean = false,
)

/** A translator-note glossary entry. */
@Immutable
data class TranslationGlossaryNote(
    val id: Int,
    val term: String,
    val kind: String,
    val note: String,
)

/** The "From" sender block. */
@Immutable
data class TranslationSender(
    val initials: String,
    val name: String,
    val meta: String,
    val kind: String,
    val proof: String,
) {
    /** First name for the "Reply to {name}" CTA, e.g. "Lucía". */
    val replyName: String
        get() = name.substringBefore(' ').ifEmpty { name }
}

/** One AI-elf bullet (icon + bold label + trailing text). */
@Immutable
data class TranslationElfBullet(
    val id: Int,
    val icon: PantopusIcon,
    val label: String,
    val text: String,
)

/** The AI-elf strip payload (headline + summary + 3 bullets). */
@Immutable
data class TranslationElf(
    val headline: String,
    val summary: String,
    val bullets: List<TranslationElfBullet>,
)

/**
 * The fully-projected Translation screen content. `confirmed` and
 * `viewMode` are the only mutable fields the view-model flips. Mirrors iOS
 * `MailTranslationContent`.
 */
@Immutable
data class MailTranslationContent(
    val mailId: String,
    val confirmed: Boolean,
    val viewMode: TranslationViewMode,
    val categoryLabel: String,
    val timeLabel: String,
    val languages: TranslationLanguages,
    val paragraphs: List<TranslationParagraph>,
    /** The English term highlighted inline as a glossary anchor, e.g. "posada". */
    val highlightTerm: String?,
    val glossary: List<TranslationGlossaryNote>,
    val sender: TranslationSender,
    /** Sub-line under the confirmed banner. */
    val confirmedStamp: String,
    val elfMachine: TranslationElf,
    val elfConfirmed: TranslationElf,
) {
    /** The elf payload for the current confirmation state. */
    val elf: TranslationElf
        get() = if (confirmed) elfConfirmed else elfMachine

    /** The glossary-note count string, e.g. "2 translator notes". */
    val glossaryCountLabel: String
        get() = "${glossary.size} translator note${if (glossary.size == 1) "" else "s"}"
}
