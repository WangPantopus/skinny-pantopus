@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import app.pantopus.android.data.api.models.mailbox.v2.RecordsDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.RecordsElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.RecordsElfContent
import app.pantopus.android.data.api.models.mailbox.v2.RecordsFact
import app.pantopus.android.data.api.models.mailbox.v2.RecordsIssuer
import app.pantopus.android.data.api.models.mailbox.v2.RecordsVaultCrumb
import app.pantopus.android.data.api.models.mailbox.v2.RelatedRecord

/**
 * Deterministic A17.10 records fixture for previews and Paparazzi
 * snapshots. Mirrors the design's `records.jsx` data (Q1 2026 Meridian
 * Wealth Roth IRA statement + 3 quarterly siblings) so renders stay
 * faithful while the backend is absent.
 */
object RecordsSampleData {
    const val SENDER_NAME = "Meridian Wealth Management"
    const val SENDER_META = "Retirement Services · 9h ago"
    const val RECORD_TITLE = "Q1 2026 Investment Statement — Roth IRA"

    /** Fresh-arrival record — not yet filed in the vault. */
    val record =
        RecordsDetailDto(
            title = RECORD_TITLE,
            reference = "Statement MWM-2026-Q1-9981842 · 4 pages · PDF + structured data",
            docKind = "Financial · Statement",
            docClassLabel = "Quarterly Statement",
            retentionLine = "Pantopus keeps this 7 years (IRS §6501)",
            issuer =
                RecordsIssuer(
                    initials = "MW",
                    name = "Meridian Wealth Management",
                    dept = "Retirement Services · Roth IRA division",
                    identifier = "CRD# 814-2257 · FINRA member",
                    trustNote = "Sender domain DKIM-verified · matches SEC registration",
                ),
            openingFacts =
                listOf(
                    RecordsFact(
                        kind = RecordsFact.Kind.Account,
                        label = "Account",
                        value = "Roth IRA ····4421",
                        note = "Holder: you · individual",
                        mono = true,
                    ),
                    RecordsFact(
                        kind = RecordsFact.Kind.Period,
                        label = "Period covered",
                        value = "Jan 1 – Mar 31, 2026",
                        note = "Q1 2026 · 90 days",
                    ),
                    RecordsFact(
                        kind = RecordsFact.Kind.Balance,
                        label = "Ending balance",
                        value = "$84,237.16",
                        note = "As of Mar 31, 4:00 PM ET",
                        emphasis = true,
                    ),
                    RecordsFact(
                        kind = RecordsFact.Kind.Change,
                        label = "Net change",
                        value = "+$3,419.08",
                        note = "+4.23% · contributions $1,500 · market $1,919",
                        tone = RecordsFact.Tone.Positive,
                        emphasis = true,
                    ),
                    RecordsFact(
                        kind = RecordsFact.Kind.StatementDate,
                        label = "Statement date",
                        value = "Apr 4, 2026",
                        note = "Delivered to Pantopus Apr 4 · 9:12 AM",
                    ),
                ),
            bodyParagraphs =
                listOf(
                    "This statement reports activity in your Roth IRA for the quarter ended " +
                        "March 31, 2026. It includes the account summary, positions, dividends, " +
                        "contributions, and performance attribution required under FINRA Rule 2231.",
                    "Two contributions totalling $1,500.00 were credited during the quarter. " +
                        "No withdrawals were taken. Market appreciation accounted for the balance " +
                        "of the $3,419.08 net change.",
                ),
            coverPageHint = "p. 1 / 4",
            pageCount = 4,
            vaultTrail =
                listOf(
                    RecordsVaultCrumb(RecordsVaultCrumb.Glyph.Inbox, "Mailbox", isCurrent = false),
                    RecordsVaultCrumb(RecordsVaultCrumb.Glyph.Archive, "Vault", isCurrent = false),
                    RecordsVaultCrumb(RecordsVaultCrumb.Glyph.Landmark, "Finance", isCurrent = false),
                    RecordsVaultCrumb(RecordsVaultCrumb.Glyph.FileText, "Statements", isCurrent = false),
                    RecordsVaultCrumb(RecordsVaultCrumb.Glyph.Calendar, "2026", isCurrent = true),
                ),
            related =
                listOf(
                    RelatedRecord("q4-2025", "Q4 2025", "$80,818.08", "Filed Jan 7"),
                    RelatedRecord("q3-2025", "Q3 2025", "$78,902.41", "Filed Oct 6"),
                    RelatedRecord("q2-2025", "Q2 2025", "$76,118.66", "Filed Jul 8"),
                ),
            elfOpen =
                RecordsElfContent(
                    headline = "Pantopus opened this for you",
                    summary =
                        "Standard quarterly statement from Meridian. Balance is up 4.2% on the " +
                            "quarter — that's in line with your other accounts. No action needed; " +
                            "just file it for tax season.",
                    bullets =
                        listOf(
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.FileCheck,
                                label = "Authentic statement",
                                text = "DKIM + FINRA registry match",
                            ),
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.TrendingUp,
                                label = "Up 4.2% on the quarter",
                                text = "matches your other accounts",
                            ),
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.Archive,
                                label = "Suggested: Vault › Finance › Statements › 2026",
                                text = "where last 3 quarters live",
                            ),
                        ),
                ),
            elfFiled =
                RecordsElfContent(
                    headline = "Filed · here's where it lives",
                    summary =
                        "Stored in Vault › Finance › Statements › 2026 with the rest of your " +
                            "Roth IRA quarterlies. Pantopus will keep it for 7 years per IRS " +
                            "§6501 and surface it during tax prep.",
                    bullets =
                        listOf(
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.Lock,
                                label = "Read-only copy locked",
                                text = "original PDF + structured JSON · checksummed",
                            ),
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.CalendarClock,
                                label = "Retention: 7 years",
                                text = "auto-delete prompt Apr 2033",
                            ),
                            RecordsElfBullet(
                                glyph = RecordsElfBullet.Glyph.Search,
                                label = "Indexed and searchable",
                                text = "find it by account, ticker, or amount",
                            ),
                        ),
                ),
            filedAtLabel = null,
            isFiled = false,
        )

    /** Filed-to-vault variant of the same record. */
    val filedRecord: RecordsDetailDto =
        record.copy(isFiled = true, filedAtLabel = "Today 2:14 PM · retention 7y")
}
