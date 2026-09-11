package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardCountsDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeDocumentEntryTest {
    @Test
    fun `documents entry requires confirmed read access`() {
        val cases =
            listOf(
                null to false,
                HomeAccessDto(hasAccess = true) to false,
                HomeAccessDto(hasAccess = false, permissions = listOf("docs.view")) to false,
                HomeAccessDto(hasAccess = true, permissions = listOf("docs.upload")) to false,
                HomeAccessDto(hasAccess = true, permissions = listOf("docs.view")) to true,
                HomeAccessDto(hasAccess = true, isOwner = true) to true,
            )
        for ((access, expected) in cases) {
            val tile =
                HomeDashboardProjection.quickActions(HomeDashboardCountsDto(documents = 2), access)
                    .firstOrNull { it.id == "view_docs" }
            assertEquals(expected, tile != null)
            if (expected) assertEquals("2", tile?.badge)
        }
    }
}
