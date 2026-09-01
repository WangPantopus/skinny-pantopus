@file:Suppress("LongMethod", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.review_signups

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.support_trains.SupportTrainHelperDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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

@OptIn(ExperimentalCoroutinesApi::class)
class ReviewSignupsViewModelTest {
    private val repo: SupportTrainsRepository = mockk()
    private lateinit var store: SupportTrainReservationsStore

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        store = SupportTrainReservationsStore()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVM(savedState: SavedStateHandle = savedState()): ReviewSignupsViewModel =
        ReviewSignupsViewModel(repo, store, savedState)

    private fun savedState(trainId: String = "st1"): SavedStateHandle =
        SavedStateHandle(mapOf(ReviewSignupsViewModel.SUPPORT_TRAIN_ID_KEY to trainId))

    private fun reservation(
        id: String,
        status: String = "pending",
        dishTitle: String? = "Veggie chili",
        restaurantName: String? = null,
        contributionMode: String? = "meal",
        note: String? = "I'll knock when I'm there",
        helperName: String? = "Lena Park",
        guestName: String? = null,
        estimatedArrivalAt: String? = "2026-05-22T22:00:00Z",
        createdAt: String = "2026-05-15T10:00:00Z",
        updatedAt: String = "2026-05-15T10:00:00Z",
    ) = SupportTrainReservationDto(
        id = id,
        slotId = "s_$id",
        userId = "u_$id",
        guestName = guestName,
        status = status,
        contributionMode = contributionMode,
        dishTitle = dishTitle,
        restaurantName = restaurantName,
        estimatedArrivalAt = estimatedArrivalAt,
        noteToRecipient = note,
        privateNoteToOrganizer = null,
        createdAt = createdAt,
        updatedAt = updatedAt,
        canceledAt = if (status == "canceled") updatedAt else null,
        helper =
            helperName?.let {
                SupportTrainHelperDto(
                    id = "u_$id",
                    username = it.lowercase().replace(" ", ""),
                    name = it,
                    profilePictureUrl = null,
                )
            },
    )

    // MARK: - Lifecycle

    @Test
    fun load_populated_hides_canceled_by_default() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations =
                            listOf(
                                reservation("r1", status = "pending"),
                                reservation("r2", status = "confirmed"),
                                reservation("r3", status = "canceled"),
                            ),
                    ),
                )
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("r1", "r2"), state.sections.first().rows.map { it.id })
        }

    @Test
    fun load_empty_shows_share_train_cta() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(SupportTrainReservationsResponse(reservations = emptyList()))
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No signups yet", state.headline)
            assertEquals("Share train", state.ctaTitle)
        }

    @Test
    fun load_failure_transitions_to_error() =
        runTest {
            coEvery { repo.reservations(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVM()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test
    fun missing_support_train_id_surfaces_error_without_fetch() =
        runTest {
            val vm = makeVM(savedState(trainId = ""))
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    // MARK: - Filter chips

    @Test
    fun pending_filter_projects_pending_rows_only() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations = listOf(reservation("r1", "pending"), reservation("r2", "confirmed")),
                    ),
                )
            val vm = makeVM()
            vm.load()
            vm.selectFilter(ReviewSignupsFilter.PENDING)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("r1"), state.sections.first().rows.map { it.id })
        }

    @Test
    fun edited_filter_includes_rows_where_updated_differs_from_created() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations =
                            listOf(
                                reservation("r1", status = "confirmed"),
                                reservation(
                                    "r2",
                                    status = "confirmed",
                                    createdAt = "2026-05-14T10:00:00Z",
                                    updatedAt = "2026-05-15T11:00:00Z",
                                ),
                                reservation("r3", status = "canceled"),
                            ),
                    ),
                )
            val vm = makeVM()
            vm.load()
            vm.selectFilter(ReviewSignupsFilter.EDITED)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("r2"), state.sections.first().rows.map { it.id })
        }

    @Test
    fun canceled_filter_surfaces_canceled_rows() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations = listOf(reservation("r1", "pending"), reservation("r3", "canceled")),
                    ),
                )
            val vm = makeVM()
            vm.load()
            vm.selectFilter(ReviewSignupsFilter.CANCELED)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("r3"), state.sections.first().rows.map { it.id })
        }

    // MARK: - Row mapping

    @Test
    fun display_name_falls_back_through_chain() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations =
                            listOf(
                                reservation(
                                    "r99",
                                    contributionMode = "restaurant",
                                    dishTitle = null,
                                    restaurantName = "Sage & Stone",
                                    helperName = null,
                                    guestName = "Block Neighbor",
                                ),
                            ),
                    ),
                )
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("Block Neighbor", state.sections.first().rows.first().title)
            assertEquals("Sage & Stone", state.sections.first().rows.first().subtitle)
        }

    @Test
    fun body_wraps_note_in_smart_quotes() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(reservations = listOf(reservation("r1"))),
                )
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("“I'll knock when I'm there”", state.sections.first().rows.first().body)
        }

    @Test
    fun edited_confirmed_row_shows_edited_chip() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(
                        reservations =
                            listOf(
                                reservation(
                                    "r2",
                                    status = "confirmed",
                                    createdAt = "2026-05-14T10:00:00Z",
                                    updatedAt = "2026-05-15T11:00:00Z",
                                ),
                            ),
                    ),
                )
            val vm = makeVM()
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val trailing = state.sections.first().rows.first().trailing as RowTrailing.Status
            assertEquals("Edited", trailing.text)
            assertEquals(StatusChipVariant.Info, trailing.variant)
        }

    // MARK: - Optimistic confirm

    @Test
    fun confirm_optimistically_bumps_status_and_fires_callback() =
        runTest {
            coEvery { repo.reservations("st1") } returns
                NetworkResult.Success(
                    SupportTrainReservationsResponse(reservations = listOf(reservation("r1", "pending"))),
                )
            // S1 — confirm now also fires the real POST alongside the
            // optimistic row flip.
            coEvery { repo.confirmDelivery("st1", "r1") } returns NetworkResult.Success(Unit)
            val vm = makeVM()
            var captured: String? = null
            vm.onConfirmReservation = { captured = it }
            vm.load()
            vm.confirm("r1")
            assertEquals("r1", captured)
            vm.selectFilter(ReviewSignupsFilter.CONFIRMED)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(listOf("r1"), state.sections.first().rows.map { it.id })
        }
}
