@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.RecordsSampleData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A17.10 — JVM coverage for the records DTO: the `factsForState` status-row
 * prepend, the open/filed fixture shape, and the [MailboxCategoryPayload]
 * decode path. Mirrors iOS `RecordsDetailSnapshotTests` invariants.
 */
class RecordsDetailDtoTest {
    @Test fun openFixture_shape() {
        val record = RecordsSampleData.record
        assertFalse(record.isFiled)
        assertEquals(4, record.pageCount)
        assertEquals(5, record.openingFacts.size)
        assertEquals(3, record.elfOpen.bullets.size)
        assertEquals(3, record.related.size) // three quarterly siblings
        assertEquals(5, record.vaultTrail.size)
        // The breadcrumb terminates on the current folder (2026).
        assertEquals("2026", record.vaultTrail.last().label)
        assertTrue(record.vaultTrail.last().isCurrent)
        assertEquals(1, record.vaultTrail.count { it.isCurrent })
        // Net change is the lone positive-tone emphasis fact.
        val positive = record.openingFacts.filter { it.tone == RecordsFact.Tone.Positive }
        assertEquals(1, positive.size)
        assertEquals(RecordsFact.Kind.Change, positive.first().kind)
        assertEquals("+\$3,419.08", positive.first().value)
        // Account is the mono fact.
        assertEquals(RecordsFact.Kind.Account, record.openingFacts.first { it.mono }.kind)
    }

    @Test fun factsForState_open_omitsStatusRow() {
        val facts = RecordsSampleData.record.factsForState(filed = false)
        assertEquals(5, facts.size)
        assertNull(facts.firstOrNull { it.kind == RecordsFact.Kind.Status })
    }

    @Test fun factsForState_filed_prependsStatusRow() {
        val facts = RecordsSampleData.filedRecord.factsForState(filed = true)
        assertEquals(6, facts.size)
        assertEquals(RecordsFact.Kind.Status, facts.first().kind)
        assertEquals("Filed in Vault", facts.first().value)
        assertEquals(RecordsFact.Tone.Positive, facts.first().tone)
    }

    @Test fun filedFixture_shape() {
        val record = RecordsSampleData.filedRecord
        assertTrue(record.isFiled)
        assertEquals(3, record.elfFiled.bullets.size)
        assertNotNull(record.filedAtLabel)
    }

    @Test fun resolve_decodesRecordsPayload() {
        val payload =
            mapOf(
                "title" to "Q1 2026 Statement",
                "reference" to "MWM-2026-Q1",
                "issuer" to
                    mapOf(
                        "initials" to "MW",
                        "name" to "Meridian Wealth",
                        "dept" to "Retirement Services",
                        "identifier" to "CRD# 814-2257",
                        "trust_note" to "DKIM-verified",
                    ),
                "elf_open" to mapOf("headline" to "Opened", "summary" to "s", "bullets" to emptyList<Any>()),
                "elf_filed" to mapOf("headline" to "Filed", "summary" to "s", "bullets" to emptyList<Any>()),
                "vault_trail" to listOf(mapOf("glyph" to "calendar", "label" to "2026", "current" to true)),
                "facts" to
                    listOf(
                        mapOf("kind" to "account", "label" to "Account", "value" to "····4421", "mono" to true),
                    ),
                "page_count" to 4,
            )
        val resolved = MailboxCategoryPayload.resolve(MailItemCategory.Records, payload)
        assertTrue(resolved is MailboxCategoryPayload.Records)
        val record = (resolved as MailboxCategoryPayload.Records).detail
        assertEquals("Q1 2026 Statement", record.title)
        assertEquals(4, record.pageCount)
        assertEquals(1, record.openingFacts.size)
        assertTrue(record.openingFacts.first().mono)
        assertTrue(record.vaultTrail.first().isCurrent)
    }

    @Test fun resolve_missingTitle_fallsBackToOther() {
        val payload = mapOf("reference" to "no-title")
        assertEquals(
            MailboxCategoryPayload.Other,
            MailboxCategoryPayload.resolve(MailItemCategory.Records, payload),
        )
    }
}
