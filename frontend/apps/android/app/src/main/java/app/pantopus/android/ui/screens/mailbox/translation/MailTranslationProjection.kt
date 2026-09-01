@file:Suppress("MagicNumber", "PackageNaming", "ReturnCount", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.translation

import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.v2.TranslationResult
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * A17.13 — pure projection from the two real payloads the Translation
 * screen reads:
 *
 *  - `GET api/mailbox/:id` (`backend/routes/mailbox.js:1466`) → the
 *    original letter, its sender, and its timestamp
 *  - `POST api/mailbox/v2/p3/translate`
 *    (`backend/routes/mailboxV2Phase3.js:1644`) →
 *    `{ translated_text, from_language, to_language, cached }`
 *
 * Everything the screen renders comes from those two bodies. The backend
 * carries no translator-notes glossary and no detection confidence, so
 * the glossary is empty and the confidence is null rather than invented
 * — the badge and the elf strip both degrade.
 *
 * Mirrors iOS `MailTranslationProjection.swift`.
 */
object MailTranslationProjection {
    private val stampFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("MMM d · h:mm a", Locale.US).withZone(ZoneId.systemDefault())

    private val shortDateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("MMM d", Locale.US).withZone(ZoneId.systemDefault())

    /** Build the screen content from the mail detail + translation result. */
    fun project(
        mailId: String,
        detail: MailDetail,
        translation: TranslationResult,
        now: Instant = Instant.now(),
    ): MailTranslationContent {
        val languages = makeLanguages(translation)
        val paragraphs =
            alignParagraphs(
                original = originalText(detail),
                translated = translation.translatedText.orEmpty(),
            )
        return MailTranslationContent(
            mailId = mailId,
            confirmed = false,
            viewMode = TranslationViewMode.Side,
            categoryLabel = "Translation",
            timeLabel = relativeTimeLabel(detail.createdAt, now),
            languages = languages,
            paragraphs = paragraphs,
            highlightTerm = null,
            // The translate route returns no glossary; the notes card
            // hides itself when this is empty.
            glossary = emptyList(),
            sender = makeSender(detail),
            confirmedStamp = confirmedStamp(now),
            elfMachine = machineElf(languages, translation.cached == true),
            elfConfirmed = confirmedElf(languages, now),
        )
    }

    /** "Marked trusted by you · May 28 · 2:40 PM". */
    fun confirmedStamp(now: Instant = Instant.now()): String = "Marked trusted by you · ${stampFormatter.format(now)}"

    // ─── Languages ─────────────────────────────────────────

    internal fun makeLanguages(translation: TranslationResult): TranslationLanguages {
        val from = translation.fromLanguage?.trim().orEmpty().ifEmpty { "auto" }
        val to = translation.toLanguage?.trim().orEmpty().ifEmpty { "en" }
        return TranslationLanguages(
            sourceCode = displayCode(from),
            sourceName = displayName(from),
            confidence = null,
            targetCode = displayCode(to),
            targetName = displayName(to),
        )
    }

    /**
     * The two-letter pill. `auto` has no code of its own, so the pill
     * shows "AUTO", which is what the badge reads out too.
     */
    internal fun displayCode(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty() || trimmed.equals("auto", ignoreCase = true)) return "AUTO"
        return trimmed.take(2).uppercase(Locale.US)
    }

    /**
     * Long name for the badge line. Falls back to the raw tag so an
     * unmapped language still reads sensibly.
     */
    internal fun displayName(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty() || trimmed.equals("auto", ignoreCase = true)) return "Auto-detected"
        val display =
            runCatching { Locale.forLanguageTag(trimmed).getDisplayLanguage(Locale.US) }
                .getOrNull()
                .orEmpty()
        return display.ifEmpty { trimmed.uppercase(Locale.US) }
            .replaceFirstChar { it.uppercase(Locale.US) }
    }

    // ─── Text ──────────────────────────────────────────────

    /**
     * The letter as stored on the mail row. `content` is the body;
     * `preview_text` / `subject` are the fallbacks for rows that only
     * carry a summary.
     */
    internal fun originalText(detail: MailDetail): String =
        listOfNotNull(detail.content, detail.previewText, detail.subject)
            .firstOrNull { it.isNotBlank() }
            .orEmpty()

    /**
     * Split both sides into paragraphs and pair them by index so the
     * side-by-side view can align them. Unequal counts pad with empty
     * strings rather than dropping content.
     */
    internal fun alignParagraphs(
        original: String,
        translated: String,
    ): List<TranslationParagraph> {
        val left = paragraphs(original)
        val right = paragraphs(translated)
        val count = maxOf(left.size, right.size)
        if (count == 0) return emptyList()
        return (0 until count).map { index ->
            TranslationParagraph(
                id = index,
                original = left.getOrElse(index) { "" },
                english = right.getOrElse(index) { "" },
                isHeading = index == 0 && count > 1,
                isSignoff = index == count - 1 && count > 2,
            )
        }
    }

    internal fun paragraphs(text: String): List<String> = text.split("\n").map { it.trim() }.filter { it.isNotEmpty() }

    // ─── Sender ────────────────────────────────────────────

    internal fun makeSender(detail: MailDetail): TranslationSender {
        val name =
            detail.sender?.name
                ?: detail.senderBusinessName
                ?: detail.senderAddress
                ?: "Unknown sender"
        val username = detail.sender?.username
        val meta = if (!username.isNullOrEmpty()) "@$username" else detail.senderAddress.orEmpty()
        return TranslationSender(
            initials = initials(name),
            name = name,
            meta = meta,
            kind = trustLabel(detail.senderTrust),
            proof = proofLabel(detail.senderTrust),
        )
    }

    internal fun initials(name: String): String {
        val parts = name.split(" ").mapNotNull { it.firstOrNull()?.toString() }
        if (parts.isEmpty()) return "?"
        return parts.take(2).joinToString("").uppercase(Locale.US)
    }

    /** `Mail.sender_trust` (`backend/database/schema.sql:7207`). */
    internal fun trustLabel(raw: String?): String =
        when (raw?.lowercase(Locale.US)) {
            "verified_gov" -> "Verified government"
            "verified_utility" -> "Verified utility"
            "verified_business" -> "Verified business"
            "pantopus_user" -> "Verified neighbor"
            else -> "Unverified sender"
        }

    internal fun proofLabel(raw: String?): String =
        when (raw?.lowercase(Locale.US)) {
            "verified_gov", "verified_utility", "verified_business" -> "Sender domain checked"
            "pantopus_user" -> "Address verified"
            else -> "No proof on file"
        }

    // ─── Time ──────────────────────────────────────────────

    internal fun relativeTimeLabel(
        iso: String,
        now: Instant,
    ): String {
        val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
        val seconds = ChronoUnit.SECONDS.between(instant, now)
        if (seconds < 60) return "just now"
        val minutes = seconds / 60
        if (minutes < 60) return "${minutes}m ago"
        val hours = minutes / 60
        if (hours < 24) return "${hours}h ago"
        val days = hours / 24
        if (days < 7) return "${days}d ago"
        return shortDateFormatter.format(instant)
    }

    // ─── Elf strips ────────────────────────────────────────

    internal fun machineElf(
        languages: TranslationLanguages,
        cached: Boolean,
    ): TranslationElf =
        TranslationElf(
            headline = "Pantopus translated this letter",
            summary =
                "I read the original in ${languages.sourceName} and rendered it in " +
                    "${languages.targetName}. Compare the two sides below and confirm when it " +
                    "reads right — I’ll mark the translation trusted.",
            bullets =
                listOf(
                    TranslationElfBullet(
                        id = 0,
                        icon = PantopusIcon.Globe,
                        label = "${languages.sourceName} → ${languages.targetName}",
                        text = if (cached) "served from cache" else "fresh machine translation",
                    ),
                    TranslationElfBullet(
                        id = 1,
                        icon = PantopusIcon.Play,
                        label = "Listen in either language",
                        text = "tap play on a column",
                    ),
                ),
        )

    internal fun confirmedElf(
        languages: TranslationLanguages,
        now: Instant,
    ): TranslationElf =
        TranslationElf(
            headline = "Translation confirmed",
            summary =
                "You confirmed this ${languages.targetName} translation. Pantopus keeps both " +
                    "versions in your Vault, so the original is never lost.",
            bullets =
                listOf(
                    TranslationElfBullet(
                        id = 0,
                        icon = PantopusIcon.BadgeCheck,
                        label = "Confirmed by you",
                        text = stampFormatter.format(now),
                    ),
                    TranslationElfBullet(
                        id = 1,
                        icon = PantopusIcon.Archive,
                        label = "Both versions saved",
                        text = "original + ${languages.targetName} in Vault",
                    ),
                    TranslationElfBullet(
                        id = 2,
                        icon = PantopusIcon.Reply,
                        label = "Reply in ${languages.targetName}",
                        text = "we translate back on send",
                    ),
                ),
        )
}
