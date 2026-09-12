@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * A12.1 Paparazzi snapshots for the search-first Add Home step:
 * nearby-result selection and focused autocomplete.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AddHomeWizardSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 1800, softButtons = false),
        )

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun find_home_nearby_selection() {
        val vm = makeViewModel()
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
        paparazzi.snapshot {
            PantopusTheme {
                AddHomeWizardScreen(
                    onDismiss = {},
                    onOpenHomes = {},
                    viewModel = vm,
                )
            }
        }
    }

    @Test
    fun find_home_autocomplete() {
        val vm = makeViewModel()
        vm.updateSearchQuery("412 Elm")
        paparazzi.snapshot {
            PantopusTheme {
                AddHomeWizardScreen(
                    onDismiss = {},
                    onOpenHomes = {},
                    viewModel = vm,
                )
            }
        }
    }

    @Test
    fun add_home_geocoded_ready() {
        paparazzi.snapshot {
            Frame {
                AddHomeWizardConfirmPreview(state = AddHomeSampleData.geocodedReadyState())
            }
        }
    }

    @Test
    fun add_home_zip_mismatch_apply() {
        paparazzi.snapshot {
            Frame {
                AddHomeWizardConfirmPreview(state = AddHomeSampleData.zipMismatchState())
            }
        }
    }

    private fun makeViewModel(): AddHomeWizardViewModel {
        val networkMonitor =
            mockk<NetworkMonitor>(relaxed = true).also {
                every { it.isOnline } returns MutableStateFlow(true)
            }
        val session = mockk<HomeClaimSessionScope>(relaxed = true)
        every { session.isCurrent } returns true
        every { session.invalidated } returns MutableStateFlow(false)
        every { session.storageIdentityHash } returns "a".repeat(64)
        val sessions = mockk<HomeClaimSessionScopeFactory>()
        every { sessions.create(any()) } returns session
        val creations = mockk<HomeCreationFactory>()
        val fixture = HomeCreationTestFixture()
        every { creations.create(any()) } answers { fixture.coordinator(session::requireCurrent) }
        return AddHomeWizardViewModel(
            repository = mockk<HomesRepository>(relaxed = true),
            savedStateHandle = SavedStateHandle(),
            networkMonitor = networkMonitor,
            geoApi = mockk(relaxed = true),
            locationProvider = mockk(relaxed = true),
            sessions = sessions,
            creations = creations,
        )
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                content()
            }
        }
    }
}
