@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.identity_center.view_as

import app.pantopus.android.data.api.models.identity.ViewAsContextDto
import app.pantopus.android.data.api.models.identity.ViewAsLocality
import app.pantopus.android.data.api.models.identity.ViewAsResponse
import app.pantopus.android.data.api.models.identity.ViewAsStats
import app.pantopus.android.data.api.models.identity.ViewAsViewerRelationship
import app.pantopus.android.data.api.models.identity.ViewAsVisibleProfile
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.IdentityCenterRepository
import app.pantopus.android.ui.components.ViewerAudience
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * B5.2 (A18.5) / P1-F — covers the "View as" preview: the local privacy
 * matrix (Public redacts most, Connection least; instant re-resolve on chip
 * change) and the live `view-as` projection / error fallback.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ViewAsViewModelTest {
    private val repository: IdentityCenterRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun sampleVm(): ViewAsViewModel = ViewAsViewModel(repository, useSample = true)

    private fun render(vm: ViewAsViewModel): ViewAsRender? = (vm.state.value as? ViewAsUiState.Loaded)?.render

    private fun disclosure(
        render: ViewAsRender,
        fieldId: String,
    ): ViewAsFieldDisclosure? = render.fields.firstOrNull { it.id == fieldId }?.disclosure

    // Sample matrix

    @Test
    fun startsLoading_thenLoadResolvesSelectedRender() {
        val vm = sampleVm()
        assertTrue(vm.state.value is ViewAsUiState.Loading)
        vm.load()
        assertEquals(ViewerAudience.Connection, render(vm)?.viewer)
    }

    @Test
    fun publicRedactsMutualsAndContact() {
        val vm = sampleVm()
        vm.load()
        vm.select(ViewerAudience.Public)
        val render = render(vm)!!
        assertEquals(true, disclosure(render, "mutuals")?.isHidden)
        assertEquals(true, disclosure(render, "contact")?.isHidden)
        assertEquals("Maple Heights district", disclosure(render, "location")?.shownValue)
        assertEquals(2, render.badges.count { !it.isOn })
        assertEquals(ViewAsTone.Restricted, render.banner.tone)
    }

    @Test
    fun connectionRedactsNothing() {
        val vm = sampleVm()
        vm.load()
        val render = render(vm)!!
        assertFalse(render.fields.any { it.disclosure.isHidden })
        assertTrue(render.badges.all { it.isOn })
        assertEquals("Available on request", disclosure(render, "contact")?.shownValue)
        assertEquals(ViewAsTone.Info, render.banner.tone)
    }

    @Test
    fun selectReResolvesRenderInPlace() {
        val vm = sampleVm()
        vm.load()
        assertEquals(false, disclosure(render(vm)!!, "contact")?.isHidden)

        vm.select(ViewerAudience.Public)

        assertEquals(ViewerAudience.Public, vm.selected.value)
        assertEquals(ViewerAudience.Public, render(vm)?.viewer)
        assertEquals(true, disclosure(render(vm)!!, "contact")?.isHidden)
    }

    @Test
    fun everyAudienceResolvesWithFiveFields() {
        val vm = sampleVm()
        vm.load()
        ViewerAudience.entries.forEach { audience ->
            vm.select(audience)
            assertEquals(audience, render(vm)?.viewer)
            assertEquals(5, render(vm)?.fields?.size)
        }
    }

    // Live read-path

    @Test
    fun liveLoadResolvesRender() =
        runTest {
            coEvery { repository.viewAs(any(), any(), any()) } returns
                NetworkResult.Success(
                    ViewAsResponse(
                        viewer = "connection",
                        viewerLabel = "a connection",
                        visible =
                            ViewAsVisibleProfile(
                                handle = "dana.o",
                                displayName = "Dana Okafor",
                                badges = listOf("verified_resident"),
                                locality = ViewAsLocality(city = "Maple Heights", state = "NY", neighborhood = "Maple Heights"),
                                stats = ViewAsStats(reviews = 38),
                                viewer =
                                    ViewAsViewerRelationship(
                                        canMessage = true,
                                        isFollowingLocal = true,
                                        relationshipStatus = "accepted",
                                    ),
                            ),
                        hidden = emptyList(),
                        context = ViewAsContextDto(isNeighbor = true, isConnection = true),
                    ),
                )

            val vm = ViewAsViewModel(repository)
            vm.load()

            val render = render(vm)!!
            assertEquals("Dana Okafor", render.head.name)
            assertEquals(false, disclosure(render, "contact")?.isHidden)
        }

    @Test
    fun liveLoadErrorFallsBackToSample() =
        runTest {
            coEvery { repository.viewAs(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = ViewAsViewModel(repository)
            vm.load()

            assertEquals(ViewerAudience.Connection, render(vm)?.viewer)
        }
}
