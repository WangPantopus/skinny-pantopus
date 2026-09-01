@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** P6.6 — covers the "Print emergency card" content projection (pure). */
class EmergencyCardPdfTest {
    private fun dto(
        id: String,
        type: String,
        label: String,
        pinned: Boolean = false,
        detail: String = "info",
    ): HomeEmergencyDto {
        val details =
            buildMap {
                put("detail", detail)
                if (pinned) put("pinned", "1")
            }
        return HomeEmergencyDto(
            id = id,
            homeId = "h",
            type = type,
            label = label,
            location = null,
            details = details,
            createdAt = null,
            updatedAt = null,
        )
    }

    @Test
    fun groupsByCategoryInCanonicalOrder() {
        val content =
            EmergencyCardPdf.content(
                listOf(
                    dto("m", "first_aid", "Allergies"),
                    dto("s", "shutoff_water", "Water shutoff"),
                    dto("c", "emergency_contacts", "Dr. Lin"),
                ),
                homeLabel = "412 Elm St",
            )
        assertEquals(listOf("Shutoffs", "Contacts", "Medical"), content.sections.map { it.heading })
        assertEquals("412 Elm St", content.homeLabel)
        assertFalse(content.isEmpty)
        assertEquals("Water shutoff", content.sections.first().items.first().title)
    }

    @Test
    fun pinnedSectionLeads() {
        val content =
            EmergencyCardPdf.content(
                listOf(
                    dto("s", "shutoff_water", "Water shutoff"),
                    dto("p", "emergency_contacts", "911", pinned = true),
                ),
                homeLabel = "Home",
            )
        assertEquals("Pinned · Quick access", content.sections.first().heading)
    }

    @Test
    fun emptyInputProducesEmptyContent() {
        val content = EmergencyCardPdf.content(emptyList(), homeLabel = "Home")
        assertTrue(content.isEmpty)
    }
}
