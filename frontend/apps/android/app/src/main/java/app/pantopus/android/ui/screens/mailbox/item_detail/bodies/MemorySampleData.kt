@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import app.pantopus.android.data.api.models.mailbox.v2.MemoryDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.MemoryElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.MemoryElfContent
import app.pantopus.android.data.api.models.mailbox.v2.MemoryFact
import app.pantopus.android.data.api.models.mailbox.v2.MemoryVaultCrumb
import app.pantopus.android.data.api.models.mailbox.v2.MemoryVaultInfo
import app.pantopus.android.data.api.models.mailbox.v2.MemoryVaultStat

/**
 * Deterministic A17.7 keepsake fixture for previews and Paparazzi
 * snapshots. Mirrors the design's `memory.jsx` data so renders stay
 * faithful while the backend is absent.
 */
object MemorySampleData {
    const val SENDER_NAME = "Mei L."
    const val SENDER_META = "4 doors down · Just arrived"

    /** Fresh-arrival memory — not yet kept in the vault. */
    val memory =
        MemoryDetailDto(
            title = "One year ago, you found Pepper.",
            reference = "Memory MEM-0518 · marked Mon May 18",
            photoUrl = null,
            photoCaption = "Pepper, May 19 2025",
            photoLabel = "1 of 1 · sent by Mei",
            note =
                listOf(
                    "It's been a year, can you believe it.",
                    "I still think about how you walked back from the trail with Pepper under " +
                        "your arm, all muddy. He's nine now and getting slow but he still loses " +
                        "his mind when we pass your driveway.",
                    "Thank you again. I baked you a loaf — it's on the porch.",
                ),
            noteSignature = "Mei (and Pepper)",
            facts =
                listOf(
                    MemoryFact(
                        kind = MemoryFact.Kind.Anniversary,
                        label = "A year ago today",
                        value = "Mon, May 19, 2025 · 7:42 PM",
                    ),
                    MemoryFact(
                        kind = MemoryFact.Kind.PulseThread,
                        label = "Originally a Pulse post",
                        value = "“Missing — small brown dog, Pepper”",
                        linkHint = "Tap to reopen the thread",
                    ),
                    MemoryFact(
                        kind = MemoryFact.Kind.Location,
                        label = "Where it happened",
                        value = "Redwood Trail · Stop 4",
                    ),
                    MemoryFact(
                        kind = MemoryFact.Kind.Others,
                        label = "Others on the thread",
                        value = "6 neighbors helped search",
                    ),
                ),
            elfFresh =
                MemoryElfContent(
                    headline = "Pantopus surfaced this memory",
                    summary =
                        "A year ago today, Mei posted in the Pulse looking for Pepper and you " +
                            "brought him home. She marked this anniversary in her Mailbox a week " +
                            "ago — it released to you tonight.",
                    bullets =
                        listOf(
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.Calendar,
                                label = "Anniversary release",
                                text = "Mei scheduled this on May 11",
                            ),
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.Image,
                                label = "1 photograph attached",
                                text = "taken the night of, by Mei",
                            ),
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.ShieldCheck,
                                label = "Private mail",
                                text = "sent only to you, not the Pulse",
                            ),
                        ),
                ),
            elfSaved =
                MemoryElfContent(
                    headline = "Saved to your Vault",
                    summary =
                        "This memory lives in Mailbox › Vault › Memories · 2025. Only you can " +
                            "see it. Pantopus added a soft reminder for next May 18 so it can " +
                            "resurface again — you can turn that off.",
                    bullets =
                        listOf(
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.Archive,
                                label = "Mailbox › Vault › Memories",
                                text = "12 items · 2025 folder",
                            ),
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.EyeOff,
                                label = "Visible only to you",
                                text = "Mei keeps her own copy",
                            ),
                            MemoryElfBullet(
                                glyph = MemoryElfBullet.Glyph.Bell,
                                label = "Anniversary reminder set",
                                text = "Mon May 18, 2027 · 7:00 PM",
                            ),
                        ),
                ),
            vault =
                MemoryVaultInfo(
                    trail =
                        listOf(
                            MemoryVaultCrumb(MemoryVaultCrumb.Glyph.Inbox, "Mailbox", isCurrent = false),
                            MemoryVaultCrumb(MemoryVaultCrumb.Glyph.Archive, "Vault", isCurrent = false),
                            MemoryVaultCrumb(MemoryVaultCrumb.Glyph.Heart, "Memories", isCurrent = false),
                            MemoryVaultCrumb(MemoryVaultCrumb.Glyph.Calendar, "2025", isCurrent = true),
                        ),
                    stats =
                        listOf(
                            MemoryVaultStat("12", "Memories"),
                            MemoryVaultStat("2025", "Folder"),
                            MemoryVaultStat("Only you", "Visibility"),
                        ),
                ),
            isSaved = false,
        )

    /** Saved-to-vault variant of the same memory. */
    val savedMemory: MemoryDetailDto = memory.copy(isSaved = true)
}
