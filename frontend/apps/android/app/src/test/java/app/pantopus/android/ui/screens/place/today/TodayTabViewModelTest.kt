package app.pantopus.android.ui.screens.place.today

import android.app.KeyguardManager
import android.content.Context
import androidx.lifecycle.ViewModelStore
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesDto
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.hub.TodayLocationDto
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Exercises the address Today caller, distinct from the Hub briefing's TodayDetailViewModel. */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayTabViewModelTest {
    private val homes = mockk<HomesRepository>()
    private val saved = mockk<SavedPlacesRepository>()
    private val hub = mockk<HubRepository>()
    private val preferences = mockk<NotificationPreferencesRepository>()
    private val identity = HomeClaimScopeTestFixture()
    private val store = ViewModelStore()
    private var stored = NotificationPreferences.from(NotificationPreferencesDto(dailyBriefingEnabled = false))
    private val prompted = NotificationPreferencesPatch(dailyBriefingPrompted = true)
    private val place = SavedPlaceDto("saved", label = "Saved address", latitude = 0.0, longitude = 0.0)

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { homes.myHomes() } returns NetworkResult.Success(MyHomesResponse(emptyList(), null))
        coEvery { saved.list() } returns NetworkResult.Success(SavedPlacesListResponse(listOf(place)))
        coEvery { saved.today(place.id) } returns NetworkResult.Success(mockk<PlaceIntelligence>())
        coEvery { hub.todayDetail() } returns
            NetworkResult.Success(HubTodayPayload(location = TodayLocationDto(source = "saved_place", latitude = 0.0, longitude = 0.0)))
        coEvery { preferences.preferences() } answers { NetworkResult.Success(stored) }
    }

    @After fun teardown() {
        store.clear()
        Dispatchers.resetMain()
    }

    private fun viewModel(): TodayTabViewModel {
        val context = mockk<Context>()
        val keyguard = mockk<KeyguardManager>()
        val lock = mockk<AppLockManager>()
        every { context.getSystemService(KeyguardManager::class.java) } returns keyguard
        every { keyguard.isDeviceLocked } returns false
        every { lock.isLocked } returns MutableStateFlow(false)
        return TodayTabViewModel(homes, mockk(), saved, hub, preferences, claimScopeFactory(identity), lock, context, mockk()).also {
            store.put("today", it)
            it.load()
            assertTrue(it.showMorningCard.value == (stored.dailyBriefingPromptedAt == null))
        }
    }

    private fun acceptStamp() {
        coEvery { preferences.updatePreferences(any(), any()) } coAnswers {
            assertEquals(prompted, firstArg<NotificationPreferencesPatch>())
            checkNotNull(arg<AuthenticatedDispatchGuard?>(1)).verify(TokenStorage.SessionCredentials("user-1", null, "opening-token"))
            stored = stored.copy(dailyBriefingPromptedAt = "2026-10-05T17:00:00Z")
            NetworkResult.Success(stored)
        }
    }

    @Test fun failedDisplayStampThenNotNowPersistsWithoutOptInAndDoesNotReask() =
        runTest {
            coEvery { preferences.updatePreferences(any(), any()) } returns NetworkResult.Failure(NetworkError.RetriesExhausted)
            val model = viewModel()
            model.markPromptDisplayed()
            assertNotNull(model.preferenceError.value)
            assertTrue(model.showMorningCard.value)

            acceptStamp()
            model.hideMorningCard()
            assertFalse(model.showMorningCard.value)
            assertFalse(stored.dailyBriefingEnabled)
            coVerify(exactly = 2) { preferences.updatePreferences(prompted, any()) }
            model.load()
            assertFalse(model.showMorningCard.value)
            assertFalse(viewModel().showMorningCard.value)
        }

    @Test fun acknowledgedDisplayThenNotNowDoesNotWriteAgain() =
        runTest {
            acceptStamp()
            val model = viewModel()
            model.markPromptDisplayed()
            model.hideMorningCard()
            assertFalse(model.showMorningCard.value)
            coVerify(exactly = 1) { preferences.updatePreferences(prompted, any()) }
        }

    @Test fun missingServerTimestampKeepsPromptAvailableForRetry() =
        runTest {
            coEvery { preferences.updatePreferences(any(), any()) } returns NetworkResult.Success(stored)
            val model = viewModel()
            model.markPromptDisplayed()
            model.hideMorningCard()
            assertTrue(model.showMorningCard.value)
            assertNotNull(model.preferenceError.value)
            acceptStamp()
            model.hideMorningCard()
            assertFalse(model.showMorningCard.value)
        }

    @Test fun repeatedNotNowWhileRetryPendingDoesNotDuplicateRequest() =
        runTest {
            coEvery { preferences.updatePreferences(any(), any()) } returns NetworkResult.Failure(NetworkError.RetriesExhausted)
            val model = viewModel()
            model.markPromptDisplayed()
            val response = CompletableDeferred<NetworkResult<NotificationPreferences>>()
            coEvery { preferences.updatePreferences(any(), any()) } coAnswers { response.await() }
            model.hideMorningCard()
            model.hideMorningCard()
            assertTrue(model.preferenceBusy.value)
            assertTrue(model.showMorningCard.value)
            coVerify(exactly = 2) { preferences.updatePreferences(prompted, any()) }
            response.complete(NetworkResult.Success(stored.copy(dailyBriefingPromptedAt = "2026-10-05T17:00:00Z")))
            assertFalse(model.showMorningCard.value)
            assertFalse(model.preferenceBusy.value)
        }

    @Test fun oldRetryCannotDismissAReopenedPrompt() =
        runTest {
            val response = CompletableDeferred<NetworkResult<NotificationPreferences>>()
            coEvery { preferences.updatePreferences(any(), any()) } coAnswers { response.await() }
            val model = viewModel()
            model.hideMorningCard()
            model.markPromptDisplayed()
            coVerify(exactly = 1) { preferences.updatePreferences(prompted, any()) }
            model.load()
            response.complete(NetworkResult.Success(stored.copy(dailyBriefingPromptedAt = "2026-10-05T17:00:00Z")))
            assertTrue(model.showMorningCard.value)
            assertFalse(model.preferenceBusy.value)
        }
}
