package app.pantopus.android.ui.screens.place

import app.pantopus.android.core.routing.PlacePendingStore
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.models.saved_places.SavedPlaceResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.InMemorySharedPreferences
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
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

@OptIn(ExperimentalCoroutinesApi::class)
class PlaceArrivalTest {
    private val dispatcher = StandardTestDispatcher()
    private val storage = InMemorySharedPreferences()
    private val homes: HomesRepository = mockk()
    private val saves: SavedPlacesRepository = mockk()
    private val places: PlaceRepository = mockk()
    private val auth: AuthRepository = mockk()
    private val signedIn = MutableStateFlow<AuthRepository.State>(session("a"))
    private val suggestion =
        GeoSuggestion(
            suggestionId = "address",
            primaryText = "12 Example St",
            label = "12 Example St, Camas, WA 98607",
            center = listOf(-122.4, 45.6),
            kind = "address",
        )

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        PlacePendingStore.useStorage(storage)
        every { auth.state } returns signedIn
        coEvery { places.publicPreview(any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
        coEvery { homes.myHomes() } returns NetworkResult.Failure(NetworkError.Server(503, null))
    }

    @After fun tearDown() {
        PlacePendingStore.clear()
        PlacePendingStore.useStorage(null)
        Dispatchers.resetMain()
    }

    @Test fun draftSurvivesReadsAndExpiresAt24Hours() {
        val now = 1_800_000_000_000L
        assertTrue(PlacePendingStore.stash(suggestion, now))
        val draft = requireNotNull(PlacePendingStore.read(now))
        assertEquals(suggestion.label, draft.label)
        assertEquals(45.6, draft.latitude, 0.0)
        assertEquals(draft, PlacePendingStore.read(now))
        assertNull(PlacePendingStore.read(now + PlacePendingStore.TTL_MS))
        assertTrue(storage.all.isEmpty())
    }

    @Test fun bindingDoesNotExtendExpiryAndRejectsOtherAccount() {
        val now = 1_800_000_000_000L
        PlacePendingStore.stash(suggestion, now)
        val draft = requireNotNull(PlacePendingStore.bind("a", now + 60_000))
        assertEquals(now + PlacePendingStore.TTL_MS, draft.expiresAt)
        assertEquals("a", draft.userId)
        assertNull(PlacePendingStore.bind("b", now + 120_000))
        assertTrue(storage.all.isEmpty())
    }

    @Test fun rejectsLegacyDraftAndInvalidCoordinates() {
        storage.edit().putString("street", "Old address").apply()
        assertNull(PlacePendingStore.read())
        assertTrue(storage.all.isEmpty())
        assertFalse(PlacePendingStore.stash(suggestion.copy(center = listOf(0.0, Double.NaN))))
        assertFalse(PlacePendingStore.stash(suggestion.copy(center = listOf(0.0, 91.0))))
    }

    @Test fun lateCompletionCannotClearNewDraft() {
        PlacePendingStore.stash(suggestion)
        val old = requireNotNull(PlacePendingStore.read())
        PlacePendingStore.stash(suggestion)
        PlacePendingStore.clear(old.id)
        assertNotNull(PlacePendingStore.read())
    }

    @Test fun noAutomaticSaveAndFailureSurvivesRestartBeforeRetry() =
        runTest {
            PlacePendingStore.stash(suggestion)
            coEvery { saves.save(any()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)),
                    NetworkResult.Success(SavedPlaceResponse(savedPlace("a"))),
                )
            val vm = model()
            advanceUntilIdle()
            assertEquals(HomeLanding.Review, vm.landing.value)
            assertTrue(vm.arrival.value.previewError)
            coVerify(exactly = 0) { saves.save(any()) }
            coVerify(exactly = 0) { homes.create(any()) }
            vm.save()
            advanceUntilIdle()
            assertNotNull(vm.arrival.value.error)
            assertNotNull(PlacePendingStore.read())
            val restarted = model()
            restarted.save()
            advanceUntilIdle()
            assertEquals("saved-1", restarted.arrival.value.saved?.id)
            assertNull(PlacePendingStore.read())
            coVerify(exactly = 2) { saves.save(match { it.expectedUserId == "a" && it.label == suggestion.label }) }
            coVerify(exactly = 0) { homes.create(any()) }
        }

    @Test fun duplicateTapStartsOneSave() =
        runTest {
            PlacePendingStore.stash(suggestion)
            val result = CompletableDeferred<NetworkResult<SavedPlaceResponse>>()
            coEvery { saves.save(any()) } coAnswers { result.await() }
            val vm = model()
            vm.save()
            vm.save()
            runCurrent()
            coVerify(exactly = 1) { saves.save(any()) }
            result.complete(NetworkResult.Success(SavedPlaceResponse(savedPlace("a"))))
            advanceUntilIdle()
            assertNotNull(vm.arrival.value.saved)
        }

    @Test fun changedSessionPreventsSaveAndWrongResponseKeepsDraft() =
        runTest {
            PlacePendingStore.stash(suggestion)
            coEvery { saves.save(any()) } returns NetworkResult.Success(SavedPlaceResponse(savedPlace("b")))
            val vm = model()
            signedIn.value = session("b")
            vm.save()
            advanceUntilIdle()
            coVerify(exactly = 0) { saves.save(any()) }
            signedIn.value = session("a")
            vm.save()
            advanceUntilIdle()
            assertNull(vm.arrival.value.saved)
            assertNotNull(PlacePendingStore.read())
        }

    @Test fun notNowClearsOnlyDraftAndNeverCreatesHome() =
        runTest {
            PlacePendingStore.stash(suggestion)
            val vm = model()
            vm.finish()
            advanceUntilIdle()
            assertNull(PlacePendingStore.read())
            assertEquals(HomeLanding.Hub, vm.landing.value)
            coVerify(exactly = 0) { saves.save(any()) }
            coVerify(exactly = 0) { homes.create(any()) }
        }

    @Test fun savedPlaceWireContractCarriesAccountGuard() {
        val moshi = com.squareup.moshi.Moshi.Builder().build()
        val body =
            SavePlaceBody(
                label = "Example",
                placeType = "searched",
                latitude = 45.6,
                longitude = -122.4,
                expectedUserId = "a",
            )
        val encoded = moshi.adapter(SavePlaceBody::class.java).toJson(body)
        assertTrue(encoded.contains("\"expectedUserId\":\"a\""))
        val response =
            moshi.adapter(SavedPlaceResponse::class.java).fromJson(
                """{"savedPlace":{"id":"saved-1","user_id":"a","label":"Example",
                    "place_type":"searched","latitude":45.6,"longitude":-122.4}}""",
            )
        assertEquals("a", response?.savedPlace?.userId)
    }

    private fun model() = HomeTabHostViewModel(homes, saves, places, auth)

    private fun savedPlace(userId: String) =
        SavedPlaceDto(
            id = "saved-1",
            userId = userId,
            label = suggestion.label,
            latitude = 45.6,
            longitude = -122.4,
        )

    private fun session(id: String) = AuthRepository.State.SignedIn(UserDto(id, "test@example.com", null, null))
}
