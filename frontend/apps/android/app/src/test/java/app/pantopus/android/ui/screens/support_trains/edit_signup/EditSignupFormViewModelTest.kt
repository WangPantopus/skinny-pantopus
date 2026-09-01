@file:Suppress("LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.edit_signup

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.support_trains.SupportTrainHelperDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P3.7 — Edit Signup form ViewModel. Covers:
 *  - prefill: contribution / drop-off time / dietary notes seed
 *    from the staged reservation
 *  - dirty/valid bookkeeping (Save disabled until a real change)
 *  - contribution-mode label & wire-field swap (takeout → restaurant)
 *  - drop-off time validator rejects nonsense, accepts HH:mm
 *  - successful save patches the shared store and flips
 *    `shouldDismiss` after the toast holds
 *  - missing seed (no stage call) surfaces the recovery CTA state
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EditSignupFormViewModelTest {
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

    private fun reservation(
        mode: String = "cook",
        dish: String? = "Veggie chili",
        restaurant: String? = null,
        privateNote: String? = null,
        arrival: String? = "2026-05-22T22:00:00Z",
    ) = SupportTrainReservationDto(
        id = "r1",
        slotId = "s1",
        userId = "u1",
        guestName = null,
        status = "pending",
        contributionMode = mode,
        dishTitle = dish,
        restaurantName = restaurant,
        estimatedArrivalAt = arrival,
        noteToRecipient = "Knock on the door.",
        privateNoteToOrganizer = privateNote,
        createdAt = "2026-05-15T10:00:00Z",
        updatedAt = "2026-05-15T10:00:00Z",
        canceledAt = null,
        helper =
            SupportTrainHelperDto(
                id = "u1",
                username = "lena",
                name = "Lena Park",
                profilePictureUrl = null,
            ),
    )

    private fun savedState(reservationId: String = "r1"): SavedStateHandle =
        SavedStateHandle(
            mapOf(EditSignupFormViewModel.RESERVATION_ID_KEY to reservationId),
        )

    private fun stageAndMake(
        seed: SupportTrainReservationDto = reservation(),
        savedState: SavedStateHandle = savedState(seed.id),
    ): EditSignupFormViewModel {
        store.stage(seed)
        return EditSignupFormViewModel(store, savedState)
    }

    // MARK: - Prefill

    @Test
    fun prefills_contribution_from_dish_title_for_cook_mode() =
        runTest {
            val vm = stageAndMake()
            val state = vm.state.value
            assertEquals("Meal description", state.contributionLabel)
            assertEquals("Veggie chili", state.fields[EditSignupField.Contribution]?.value)
            assertFalse(state.contributionMapsToRestaurant)
        }

    @Test
    fun prefills_contribution_from_restaurant_for_takeout_mode() =
        runTest {
            val vm =
                stageAndMake(seed = reservation(mode = "takeout", dish = null, restaurant = "Sweetgreen"))
            val state = vm.state.value
            assertEquals("Restaurant", state.contributionLabel)
            assertEquals("Sweetgreen", state.fields[EditSignupField.Contribution]?.value)
            assertTrue(state.contributionMapsToRestaurant)
        }

    @Test
    fun prefills_dietary_notes_from_private_note() =
        runTest {
            val vm = stageAndMake(seed = reservation(privateNote = "Strictly vegetarian."))
            val state = vm.state.value
            assertEquals(
                "Strictly vegetarian.",
                state.fields[EditSignupField.DietaryNotes]?.value,
            )
        }

    // MARK: - Dirty / valid

    @Test
    fun initial_state_is_clean_and_valid() =
        runTest {
            val vm = stageAndMake()
            val state = vm.state.value
            assertFalse(state.isDirty)
            assertTrue(state.isValid)
        }

    @Test
    fun editing_contribution_flips_dirty() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.Contribution, "Veggie chili + cornbread")
            val state = vm.state.value
            assertTrue(state.isDirty)
            assertTrue(state.isValid)
        }

    @Test
    fun too_long_contribution_marks_invalid() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.Contribution, "x".repeat(201))
            val state = vm.state.value
            assertNotNull(state.fields[EditSignupField.Contribution]?.error)
            assertFalse(state.isValid)
        }

    // MARK: - Drop-off time validator

    @Test
    fun dropoff_time_rejects_garbage() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.DropoffTime, "two pm")
            val state = vm.state.value
            assertNotNull(state.fields[EditSignupField.DropoffTime]?.error)
            assertFalse(state.isValid)
        }

    @Test
    fun dropoff_time_accepts_HHmm() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.DropoffTime, "18:30")
            val state = vm.state.value
            assertNull(state.fields[EditSignupField.DropoffTime]?.error)
            assertTrue(state.isValid)
        }

    // MARK: - Save → store

    @Test
    fun submit_patches_store_with_dish_title_for_cook_mode() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.Contribution, "Veggie chili + cornbread")
            vm.update(EditSignupField.DropoffTime, "18:30")
            vm.update(EditSignupField.DietaryNotes, "Strictly vegetarian.")
            vm.submit()
            val patch = store.consumePatch("r1")
            assertNotNull(patch)
            assertEquals("Veggie chili + cornbread", patch?.dishTitle)
            assertEquals("Strictly vegetarian.", patch?.privateNoteToOrganizer)
            assertNull(patch?.restaurantName)
            assertTrue(vm.state.value.toast?.isError == false)
        }

    @Test
    fun submit_maps_contribution_to_restaurant_for_takeout_mode() =
        runTest {
            val vm =
                stageAndMake(seed = reservation(mode = "takeout", dish = null, restaurant = "Sweetgreen"))
            vm.update(EditSignupField.Contribution, "Sage & Stone")
            vm.submit()
            val patch = store.consumePatch("r1")
            assertEquals("Sage & Stone", patch?.restaurantName)
            assertNull(patch?.dishTitle)
        }

    @Test
    fun submit_with_invalid_field_short_circuits_with_error_toast() =
        runTest {
            val vm = stageAndMake()
            vm.update(EditSignupField.DropoffTime, "midnight-ish")
            vm.submit()
            assertEquals(true, vm.state.value.toast?.isError)
            assertNull(store.consumePatch("r1"))
        }

    // MARK: - Missing seed

    @Test
    fun missing_seed_surfaces_recovery_state() =
        runTest {
            // No stage() — VM init draws from an empty store.
            val vm = EditSignupFormViewModel(store, savedState())
            assertTrue(vm.state.value.isMissingSeed)
        }

    @Test
    fun mismatched_seed_id_surfaces_recovery_state() =
        runTest {
            store.stage(reservation())
            val vm =
                EditSignupFormViewModel(
                    store,
                    SavedStateHandle(
                        mapOf(EditSignupFormViewModel.RESERVATION_ID_KEY to "different"),
                    ),
                )
            assertTrue(vm.state.value.isMissingSeed)
        }

    // MARK: - Store revision

    @Test
    fun store_revision_bumps_on_each_patch() =
        runTest {
            val before = store.revision.value
            store.applyPatch(reservation())
            assertEquals(before + 1, store.revision.value)
            store.applyPatch(reservation(dish = "Different"))
            assertEquals(before + 2, store.revision.value)
        }

    @Test
    fun consume_patch_removes_it() =
        runTest {
            store.applyPatch(reservation())
            assertNotNull(store.consumePatch("r1"))
            assertNull(store.consumePatch("r1"))
        }
}
