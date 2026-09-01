@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.documents

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * P2.10 — Pure tests for the document-detail helpers that pull tags and
 * the linked-entity tuple out of the free-form `details` map.
 */
class DocumentDetailHelpersTest {
    @Test fun `parseTags returns empty when the details map has no tags`() {
        assertEquals(emptyList<String>(), parseTags(emptyMap()))
        assertEquals(emptyList<String>(), parseTags(mapOf("tags" to "")))
    }

    @Test fun `parseTags trims and filters comma separated values`() {
        val tags = parseTags(mapOf("tags" to " renewal,  signed, 2024  ,"))
        assertEquals(listOf("renewal", "signed", "2024"), tags)
    }

    @Test fun `parseLinkedEntity reads kind id and title`() {
        val link =
            parseLinkedEntity(
                mapOf(
                    "linked_entity_kind" to "bill",
                    "linked_entity_id" to "bill-9",
                    "linked_entity_title" to "Con Edison",
                ),
            )
        assertEquals(DocumentLinkedEntity.Kind.Bill, link?.kind)
        assertEquals("Con Edison", link?.title)
    }

    @Test fun `parseLinkedEntity returns null when fields are missing`() {
        assertNull(parseLinkedEntity(emptyMap()))
        assertNull(
            parseLinkedEntity(
                mapOf(
                    "linked_entity_kind" to "bill",
                    "linked_entity_title" to "",
                ),
            ),
        )
        assertNull(
            parseLinkedEntity(
                mapOf(
                    "linked_entity_kind" to "unknown",
                    "linked_entity_title" to "X",
                ),
            ),
        )
    }
}
