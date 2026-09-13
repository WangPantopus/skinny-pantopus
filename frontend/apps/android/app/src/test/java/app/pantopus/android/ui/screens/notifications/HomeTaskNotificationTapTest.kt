@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.notifications

import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.notifications.NotificationActionEcho
import app.pantopus.android.data.api.models.notifications.NotificationDto
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimScopeTestFixture
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.claim_review.claimScopeFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class HomeTaskNotificationTapTest {
    private val home = "a1000000-0000-4000-8000-000000000001"
    private val task = "b1000000-0000-4000-8000-000000000002"
    private val identity = HomeClaimScopeTestFixture()
    private val repo = mockk<NotificationsRepository>()
    private val note =
        NotificationDto(
            "note", "user-1", "task_assigned", "A task", null, null,
            "/app/homes/legacy/dashboard?tab=tasks", false, "2026-09-10T00:00:00Z", "personal",
            mapOf("home_id" to home, "task_id" to task),
        )

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        DeepLinkRouter.bindSignedInUserIdProvider { identity.accounts.value }
        DeepLinkRouter.clearPending()
        coEvery { repo.markRead(any()) } returns NetworkResult.Success(NotificationActionEcho(ok = true))
    }

    @After fun teardown() {
        DeepLinkRouter.clearPending()
        DeepLinkRouter.bindSignedInUserIdProvider { null }
        Dispatchers.resetMain()
    }

    private fun model(
        row: NotificationDto = note,
        sessions: HomeClaimSessionScopeFactory = claimScopeFactory(identity),
    ): NotificationsViewModel {
        coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(NotificationsListResponse(listOf(row), 1, false))
        return NotificationsViewModel(repo, sessions = sessions).also { it.load() }
    }

    private fun tap(model: NotificationsViewModel) {
        (model.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first().onTap()
    }

    @Test fun task_metadata_survives_mark_read_and_subsequent_tap() =
        runTest {
            val model = model()
            model.markRead(note.id)
            tap(model)
            assertEquals(DeepLinkRouter.Destination.HomeTask(home, task), DeepLinkRouter.pending.value)
            coVerify(exactly = 1) { repo.markRead(note.id) }
        }

    @Test fun old_account_row_cannot_route_or_mark_after_session_replacement() =
        runTest {
            val model = model()
            identity.accounts.value = "replacement"
            tap(model)
            assertNull(DeepLinkRouter.pending.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun same_account_new_session_cannot_reuse_old_task_row() =
        runTest {
            val model = model()
            identity.tokens.value = "replacement-session"
            tap(model)
            assertNull(DeepLinkRouter.pending.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun stored_session_replacement_denies_tap_before_token_flow_delivery() =
        runTest {
            val model = model()
            identity.storedToken = "replacement-session"
            tap(model)
            assertEquals("opening-token", identity.tokens.value)
            assertEquals("user-1", identity.accounts.value)
            assertNull(DeepLinkRouter.pending.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun stored_actor_replacement_denies_direct_mark_read_before_account_flow_delivery() =
        runTest {
            val model = model()
            identity.storedAccount = "replacement-actor"
            model.markRead(note.id)
            assertEquals("user-1", identity.accounts.value)
            assertEquals(1, model.unreadCount.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun unreadable_stored_credentials_cannot_route_or_mark_task_read() =
        runTest {
            val model = model()
            identity.storedReadFailure = IOException("Private credential fixture unavailable")
            tap(model)
            model.markRead(note.id)
            assertNull(DeepLinkRouter.pending.value)
            assertEquals(1, model.unreadCount.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun queued_task_mark_read_rechecks_stored_credentials_after_initial_confirmation() =
        runTest {
            var reads = 0
            val factory = mockk<HomeClaimSessionScopeFactory>()
            every { factory.create(any()) } answers {
                HomeClaimSessionScope(
                    firstArg<CoroutineScope>(), identity.tokens, { identity.accounts.value },
                    identity.accounts, "https://claim.example.invalid",
                ) {
                    reads += 1
                    val token = if (reads == 1) "opening-token" else "replacement-session"
                    TokenStorage.SessionCredentials("user-1", null, token)
                }
            }
            val model = model(sessions = factory)
            model.markRead(note.id)
            assertEquals(2, reads)
            assertEquals("opening-token", identity.tokens.value)
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun queued_mark_read_rechecks_identity_before_its_request() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val model = model()
            runCurrent()
            tap(model)
            identity.accounts.value = "replacement"
            runCurrent()
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun foreign_recipient_and_audience_rows_cannot_open_personal_task() =
        runTest {
            for (row in listOf(note.copy(userId = "other"), note.copy(context = "audience"))) {
                val model = model(row)
                tap(model)
                assertNull(DeepLinkRouter.pending.value)
            }
            coVerify(exactly = 0) { repo.markRead(any()) }
        }

    @Test fun legacy_task_row_without_metadata_keeps_dashboard_navigation() =
        runTest {
            val model = model(note.copy(metadata = null))
            tap(model)
            assertEquals(DeepLinkRouter.Destination.HomeDashboard("legacy"), DeepLinkRouter.pending.value)
        }
}
