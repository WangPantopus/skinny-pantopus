@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.identity_center.view_as

import app.pantopus.android.data.api.models.identity.ViewAsContextDto
import app.pantopus.android.data.api.models.identity.ViewAsLocality
import app.pantopus.android.data.api.models.identity.ViewAsResponse
import app.pantopus.android.data.api.models.identity.ViewAsStats
import app.pantopus.android.data.api.models.identity.ViewAsViewerRelationship
import app.pantopus.android.data.api.models.identity.ViewAsVisibleProfile
import app.pantopus.android.ui.components.ViewerAudience
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P1-F — pure `ViewAsResponse → ViewAsRender` projection (mirrors iOS
 * `ViewAsMappingTests`).
 */
class ViewAsMapperTest {
    @Suppress("LongParameterList")
    private fun response(
        viewerLabel: String,
        displayName: String? = "Dana Okafor",
        badges: List<String> = listOf("verified_resident"),
        neighborhood: String? = "Maple Heights",
        reviews: Int? = 38,
        canMessage: Boolean = true,
        hidden: List<String> = emptyList(),
        isConnection: Boolean = true,
    ) = ViewAsResponse(
        viewer = null,
        viewerLabel = viewerLabel,
        visible =
            ViewAsVisibleProfile(
                handle = "dana.o",
                displayName = displayName,
                badges = badges,
                locality = ViewAsLocality(city = "Maple Heights", state = "NY", neighborhood = neighborhood),
                stats = ViewAsStats(reviews = reviews, gigsCompleted = 12),
                viewer = ViewAsViewerRelationship(relationshipStatus = "accepted", isFollowingLocal = true, canMessage = canMessage),
            ),
        hidden = hidden,
        context = ViewAsContextDto(isNeighbor = true, isConnection = isConnection),
    )

    private fun disclosure(
        render: ViewAsRender,
        id: String,
    ): ViewAsFieldDisclosure? = render.fields.firstOrNull { it.id == id }?.disclosure

    @Test
    fun backend_params() {
        assertEquals("public", ViewAsMapper.backendParams(ViewerAudience.Public).second)
        assertEquals("connection", ViewAsMapper.backendParams(ViewerAudience.Connection).second)
        assertEquals("household_member", ViewAsMapper.backendParams(ViewerAudience.Household).second)
        assertEquals("persona", ViewAsMapper.backendParams(ViewerAudience.PersonaAudience).first)
    }

    @Test
    fun connection_render_is_rich() {
        val render = ViewAsMapper.render(response("a connection"), ViewerAudience.Connection)
        assertEquals(ViewerAudience.Connection, render.viewer)
        assertEquals(5, render.fields.size)
        assertEquals("Dana Okafor", render.head.name)
        assertEquals("@dana.o", render.head.handle)
        assertTrue(render.head.verified)
        assertEquals("Maple Heights", disclosure(render, "location")?.shownValue)
        assertEquals("Available on request", disclosure(render, "contact")?.shownValue)
        assertEquals("38 reviews", disclosure(render, "rating")?.shownValue)
        assertEquals(true, disclosure(render, "memberSince")?.isHidden)
        assertEquals(ViewAsTone.Info, render.banner.tone)
    }

    @Test
    fun public_render_redacts_heavily() {
        val render =
            ViewAsMapper.render(
                response(
                    "the public",
                    badges = emptyList(),
                    reviews = 0,
                    canMessage = false,
                    hidden = listOf("locality", "contact", "mutuals"),
                    isConnection = false,
                ),
                ViewerAudience.Public,
            )
        assertEquals(ViewAsTone.Restricted, render.banner.tone)
        assertEquals(ViewAsAvatarTone.Masked, render.head.avatarTone)
        assertTrue(render.fields.all { it.disclosure.isHidden })
        assertTrue(render.badges.none { it.isOn })
    }

    @Test
    fun initials_from_name() {
        val render = ViewAsMapper.render(response("x"), ViewerAudience.Connection)
        assertEquals("DO", render.head.initials)
    }
}
