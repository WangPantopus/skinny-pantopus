@file:Suppress("LongParameterList", "PackageNaming")

package app.pantopus.android.ui.screens.homes.pets

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.PetDeleteResponse
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.data.api.models.homes.PetsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailSize
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PetsListViewModelTest {
    private val repo: HomePetsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): PetsListViewModel =
        PetsListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(PETS_LIST_HOME_ID_KEY to "home_1")),
        )

    private fun pet(
        id: String = "p1",
        name: String = "Mango",
        species: String = "dog",
        breed: String? = "Golden Retriever",
        notes: String? = "Allergic to chicken.",
        photoUrl: String? = null,
        vetName: String? = null,
        vetPhone: String? = null,
    ): PetDto =
        PetDto(
            id = id,
            homeId = "home_1",
            name = name,
            species = species,
            breed = breed,
            notes = notes,
            photoUrl = photoUrl,
            vetName = vetName,
            vetPhone = vetPhone,
        )

    @Test
    fun vet_contact_renders_as_a_chip_and_is_absent_when_unset() {
        val vm = makeVm()
        val withVet =
            vm.rowForTest(pet(vetName = "Bay Area Animal Hospital", vetPhone = "(415) 555-0142"))
        assertEquals(
            "Bay Area Animal Hospital · (415) 555-0142",
            withVet.chips?.single()?.text,
        )
        assertNull(vm.rowForTest(pet()).chips)
    }

    // MARK: - Lifecycle

    @Test
    fun load_empty_response_surfaces_empty_state() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Success(PetsResponse(pets = emptyList()))
            val vm = makeVm()
            vm.state.test {
                assertEquals(ListOfRowsUiState.Loading, awaitItem())
                vm.load()
                val empty = awaitItem() as ListOfRowsUiState.Empty
                assertEquals("No pets yet", empty.headline)
                assertEquals("Add a pet", empty.ctaTitle)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_populated_response_surfaces_loaded_rows() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(
                    PetsResponse(
                        pets =
                            listOf(
                                pet(id = "p1", name = "Mango", species = "dog"),
                                pet(
                                    id = "p2",
                                    name = "Biscuit",
                                    species = "cat",
                                    breed = "Maine Coon",
                                    notes = "Skittish.",
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.state.test {
                awaitItem() // Loading
                vm.load()
                val loaded = awaitItem() as ListOfRowsUiState.Loaded
                val rows = loaded.sections.first().rows
                assertEquals(2, rows.size)
                assertEquals("Mango", rows[0].title)
                assertEquals("Golden Retriever", rows[0].subtitle)
                assertEquals("Biscuit", rows[1].title)
                assertEquals("Cat", rows[1].inlineChip?.text)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun load_failure_surfaces_error_state() =
        runTest {
            coEvery { repo.list("home_1") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.state.test {
                awaitItem()
                vm.load()
                assertTrue(awaitItem() is ListOfRowsUiState.Error)
                cancelAndConsumeRemainingEvents()
            }
        }

    // MARK: - Row mapping

    @Test
    fun row_uses_64dp_thumbnail_with_icon_when_no_photo() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(PetsResponse(pets = listOf(pet(photoUrl = null))))
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val leading = rows.first().leading as RowLeading.Thumbnail
            assertEquals(ThumbnailSize.Large, leading.size)
            assertTrue(leading.image is ThumbnailImage.IconOnGradient)
        }

    @Test
    fun row_uses_remote_thumbnail_when_photo_url_present() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(
                    PetsResponse(pets = listOf(pet(photoUrl = "https://example.com/m.jpg"))),
                )
            val vm = makeVm()
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val leading = rows.first().leading as RowLeading.Thumbnail
            assertTrue(leading.image is ThumbnailImage.Remote)
        }

    @Test
    fun row_kebab_emits_confirm_delete_event() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(PetsResponse(pets = listOf(pet(id = "p1", name = "Mango"))))
            val vm = makeVm()
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            row.onSecondary?.invoke()
            val event = vm.pendingEvent.value as PetsListEvent.ConfirmDelete
            assertEquals("p1", event.petId)
            assertEquals("Mango", event.name)
        }

    @Test
    fun row_tap_emits_open_edit_event() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(PetsResponse(pets = listOf(pet(id = "p1"))))
            val vm = makeVm()
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            row.onTap()
            val event = vm.pendingEvent.value as PetsListEvent.OpenEdit
            assertEquals("p1", event.pet.id)
        }

    // MARK: - Mutations

    @Test
    fun handle_created_inserts_at_top() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(PetsResponse(pets = listOf(pet(id = "p1", name = "Mango"))))
            val vm = makeVm()
            vm.load()
            vm.handleCreated(pet(id = "p_new", name = "Pickle", species = "bird"))
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals("Pickle", rows.first().title)
            assertEquals(2, rows.size)
        }

    @Test
    fun handle_updated_replaces_in_place() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(PetsResponse(pets = listOf(pet(id = "p1", name = "Mango"))))
            val vm = makeVm()
            vm.load()
            vm.handleUpdated(pet(id = "p1", name = "Mango (updated)", breed = "Labrador"))
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals("Mango (updated)", rows.first().title)
            assertEquals("Labrador", rows.first().subtitle)
        }

    @Test
    fun delete_optimistically_removes_then_persists() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(
                    PetsResponse(
                        pets = listOf(pet(id = "p1", name = "Mango"), pet(id = "p2", name = "Biscuit")),
                    ),
                )
            coEvery { repo.delete("home_1", "p1") } returns
                NetworkResult.Success(PetDeleteResponse(message = "Pet deleted"))
            val vm = makeVm()
            vm.load()
            vm.deletePet("p1")
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals(1, rows.size)
            assertEquals("Biscuit", rows.first().title)
            coVerify { repo.delete("home_1", "p1") }
        }

    @Test
    fun delete_failure_rolls_back() =
        runTest {
            coEvery { repo.list("home_1") } returns
                NetworkResult.Success(
                    PetsResponse(
                        pets = listOf(pet(id = "p1"), pet(id = "p2")),
                    ),
                )
            coEvery { repo.delete("home_1", "p1") } returns
                NetworkResult.Failure(NetworkError.Server(code = 500, body = "boom"))
            val vm = makeVm()
            vm.load()
            vm.deletePet("p1")
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals(2, rows.size)
            assertNotNull(rows.firstOrNull { it.id == "p1" })
        }

    // MARK: - Chrome

    @Test
    fun fab_is_secondary_create_variant() {
        val vm = makeVm()
        assertEquals(FabVariant.SecondaryCreate, vm.fab.variant)
        assertEquals("Add a pet", vm.fab.contentDescription)
    }

    @Test
    fun request_add_emits_open_add_event() {
        val vm = makeVm()
        vm.requestAdd()
        assertEquals(PetsListEvent.OpenAdd, vm.pendingEvent.value)
    }

    @Test
    fun acknowledge_event_clears_pending() {
        val vm = makeVm()
        vm.requestAdd()
        assertNotNull(vm.pendingEvent.value)
        vm.acknowledgeEvent()
        assertNull(vm.pendingEvent.value)
    }
}
