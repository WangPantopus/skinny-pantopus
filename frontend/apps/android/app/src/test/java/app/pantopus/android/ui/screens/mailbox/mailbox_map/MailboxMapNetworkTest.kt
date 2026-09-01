@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import app.pantopus.android.data.api.models.mailbox.v2.MapPinDto
import app.pantopus.android.data.api.models.mailbox.v2.MapPinsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A11.4 — coverage for the live `/map/pins` wiring (BLOCK 3E). `HomeMapPin`
 * rows project into `MailboxSpot` lossily; an empty list stays empty and a
 * failure surfaces the Error frame. The sample directory is never shown as
 * if it were live data (mirrors iOS `MailboxMapViewModel`).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailboxMapNetworkTest {
    private val repository: MailboxRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun load_projectsPinsIntoSpots() =
        runTest {
            coEvery { repository.mapPins(any(), any()) } returns
                NetworkResult.Success(
                    MapPinsResponse(
                        pins =
                            listOf(
                                MapPinDto(id = "pin_1", pinType = "civic", title = "Hydrant flush", body = "Open hydrant"),
                            ),
                    ),
                )
            val vm = MailboxMapViewModel(repository)

            vm.load()

            val state = vm.state.value
            assertTrue(state is MailboxMapUiState.Populated)
            val spots = (state as MailboxMapUiState.Populated).spots
            assertEquals(1, spots.size)
            assertEquals("Hydrant flush", spots.first().name)
            assertEquals(MailboxSpotKind.Civic, spots.first().kind)
        }

    @Test
    fun load_withNoPins_staysEmpty() =
        runTest {
            coEvery { repository.mapPins(any(), any()) } returns NetworkResult.Success(MapPinsResponse(pins = emptyList()))
            val vm = MailboxMapViewModel(repository)

            vm.load()

            val state = vm.state.value
            assertTrue(state is MailboxMapUiState.Populated)
            assertEquals(0, (state as MailboxMapUiState.Populated).spots.size)
        }

    @Test
    fun load_failure_surfacesErrorFrame() =
        runTest {
            coEvery { repository.mapPins(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = MailboxMapViewModel(repository)

            vm.load()

            assertTrue(vm.state.value is MailboxMapUiState.Error)
        }
}
