package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardCountsDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
                HomeAccessDto(hasAccess = true, isOwner = true) to false,
                HomeAccessDto(hasAccess = true, isOwner = true, permissions = listOf("docs.view")) to true,
            )
        for ((access, expected) in cases) {
            val tile =
                HomeDashboardProjection.quickActions(HomeDashboardCountsDto.empty().copy(documents = 2), access)
                    .firstOrNull { it.id == "view_docs" }
            assertEquals(expected, tile != null)
            if (expected) assertEquals("2", tile?.badge)
        }
    }

    @Test
    fun `missing access and recorded roles do not grant actions`() {
        val cases =
            listOf(
                null,
                HomeAccessDto(hasAccess = true),
                HomeAccessDto(hasAccess = true, isOwner = true, roleBase = "owner"),
                HomeAccessDto(hasAccess = true, roleBase = "admin"),
                HomeAccessDto(hasAccess = false, permissions = listOf("finance.view", "members.manage")),
            )
        for (access in cases) {
            assertEquals(listOf("overview"), HomeDashboardProjection.gatedTabs(access).map { it.id })
            assertTrue(HomeDashboardProjection.quickActions(null, access).isEmpty())
            assertFalse(access?.canManageMembers ?: false)
        }
    }

    @Test
    fun `finance viewer can open bills without mutation rights`() {
        val access = HomeAccessDto(hasAccess = true, permissions = listOf("finance.view"))
        assertEquals(listOf("overview", "bills"), HomeDashboardProjection.gatedTabs(access).map { it.id })
        assertEquals(listOf("view_bills"), HomeDashboardProjection.quickActions(null, access).map { it.id })
        assertFalse(access.can("finance.manage"))
    }

    @Test
    fun `package navigation requires package read not mailbox read`() {
        val mailbox = HomeAccessDto(hasAccess = true, permissions = listOf("mailbox.view"))
        assertTrue(HomeDashboardProjection.quickActions(null, mailbox).isEmpty())
        val packages = HomeAccessDto(hasAccess = true, permissions = listOf("packages.view"))
        assertEquals(listOf("view_packages"), HomeDashboardProjection.quickActions(null, packages).map { it.id })
    }

    @Test
    fun `member viewing and management remain separate`() {
        val viewer = HomeAccessDto(hasAccess = true, permissions = listOf("members.view"))
        assertFalse(viewer.canManageMembers)
        assertEquals(listOf("add_member"), HomeDashboardProjection.quickActions(null, viewer).map { it.id })
        assertTrue(HomeAccessDto(hasAccess = true, permissions = listOf("members.manage")).canManageMembers)
    }
}
