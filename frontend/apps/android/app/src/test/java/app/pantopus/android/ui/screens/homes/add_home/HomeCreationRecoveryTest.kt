@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.PendingHomeCreation
import app.pantopus.android.data.homes.PendingHomeCreationStore
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeCreationRecoveryTest {
    private val fixture = HomeCreationTestFixture()
    private val form =
        AddHomeFormState(
            address = AddHomeAddressFields("12 Example St", "301", "Portland", "OR", "97214"),
            role = AddHomeRole.Owner,
        )
    private val request =
        CreateHomeRequest(
            address = form.address.street, unitNumber = form.address.unit,
            city = form.address.city, state = form.address.state, zipCode = form.address.zipCode,
            latitude = 45.51, longitude = -122.6, homeType = "house", role = "owner", isOwner = true,
            addressId = "ddc24200-0000-4000-8000-000000000010",
            accessSecrets = listOf(CreateAccessSecretRequest("wifi", "Example network", "synthetic-test-password", visibility = "members")),
        )

    @Test
    fun lost_reply_and_restart_retry_the_exact_retained_command() =
        runTest {
            val first = fixture.coordinator()
            first.prepare(request, form.creationSnapshot())
            val original = checkNotNull(fixture.saved)
            fixture.failTransport = true
            assertTrue(runCatching { first.resolve(HomeCreationAction.Submit) }.isFailure)
            val reopened = fixture.coordinator()
            reopened.restore()
            assertEquals(original, reopened.pending)
            assertEquals(1, fixture.calls.size)
            fixture.failTransport = false
            reopened.resolve(HomeCreationAction.Submit)
            assertEquals(listOf(original.requestJson, original.requestJson), fixture.calls.map { it.second.requestJson })
            assertEquals("completed", reopened.outcome?.state)
            assertNotNull(fixture.saved)
            reopened.acknowledge()
            assertNull(fixture.saved)
        }

    @Test
    fun unavailable_storage_blocks_new_requests_without_sending() =
        runTest {
            val subject = fixture.coordinator()
            fixture.failWrite = true
            assertTrue(runCatching { subject.prepare(request, form.creationSnapshot()) }.isFailure)
            fixture.failWrite = false
            fixture.failRead = true
            assertTrue(runCatching { subject.prepare(request, form.creationSnapshot()) }.isFailure)
            assertTrue(runCatching { subject.restore() }.isFailure)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test
    fun failed_outcome_write_keeps_known_completion_and_never_reposts() =
        runTest {
            val subject = fixture.coordinator()
            subject.prepare(request, form.creationSnapshot())
            fixture.response = { draft, _ ->
                fixture.failWrite = true
                fixture.completed(draft)
            }
            assertTrue(runCatching { subject.resolve(HomeCreationAction.Submit) }.isFailure)
            assertEquals("completed", subject.outcome?.state)
            assertNull(fixture.saved?.outcome)
            assertTrue(runCatching { subject.acknowledge() }.isFailure)
            subject.hide()
            fixture.failWrite = false
            subject.resolve(HomeCreationAction.Cancel)
            assertEquals(1, fixture.calls.size)
            assertEquals("completed", fixture.saved?.outcome?.state)
        }

    @Test
    fun cancellation_needs_bound_terminal_proof_before_original_details_can_be_cleared() =
        runTest {
            val subject = fixture.coordinator()
            subject.prepare(request, form.creationSnapshot())
            fixture.response = { draft, _ ->
                fixture.completed(draft).let { app.pantopus.android.data.homes.HomeCreationOutcome("pending", it.command) }
            }
            subject.resolve(HomeCreationAction.Cancel)
            assertTrue(runCatching { subject.acknowledge() }.isFailure)
            fixture.response = { draft, _ ->
                fixture.completed(draft).let { app.pantopus.android.data.homes.HomeCreationOutcome("cancelled", it.command) }
            }
            subject.resolve(HomeCreationAction.Cancel)
            val retained = subject.acknowledge()
            assertEquals(form.creationSnapshot(), restoreHomeCreationForm(retained.form).creationSnapshot())
            assertEquals(request.accessSecrets, fixture.codec.request(retained).accessSecrets)
            assertNull(fixture.saved)
        }

    @Test
    fun background_during_protected_write_cannot_start_a_post_or_publish_details() =
        runTest {
            lateinit var subject: HomeCreationCoordinator
            val store =
                object : PendingHomeCreationStore by fixture.store {
                    override suspend fun replace(
                        scope: HomeCreationScope,
                        expected: PendingHomeCreation?,
                        next: PendingHomeCreation?,
                    ) {
                        fixture.store.replace(scope, expected, next)
                        subject.hide()
                    }
                }
            subject = HomeCreationCoordinator(fixture.scope, store, fixture.codec, { draft, _ -> fixture.completed(draft) }, {})
            assertTrue(runCatching { subject.prepare(request, form.creationSnapshot()) }.isFailure)
            assertNull(subject.pending)
            assertNotNull(fixture.saved)
            val reopened = fixture.coordinator()
            reopened.restore()
            assertEquals(fixture.saved, reopened.pending)
            assertTrue(fixture.calls.isEmpty())
        }

    @Test
    fun background_and_account_changes_retire_late_outcomes_but_preserve_original() =
        runTest {
            var current = true
            val subject = fixture.coordinator { check(current) }
            subject.prepare(request, form.creationSnapshot())
            fixture.response = { draft, _ ->
                subject.hide()
                fixture.completed(draft)
            }
            assertTrue(runCatching { subject.resolve(HomeCreationAction.Submit) }.isFailure)
            assertNull(subject.pending)
            assertNull(fixture.saved?.outcome)
            fixture.response = { draft, _ ->
                current = false
                fixture.completed(draft)
            }
            assertTrue(runCatching { subject.resolve(HomeCreationAction.Check) }.isFailure)
            assertNull(fixture.saved?.outcome)
        }

    @Test
    fun wrong_actor_missing_access_and_changed_original_cannot_authorize_acknowledgment() =
        runTest {
            val subject = fixture.coordinator()
            subject.prepare(request, form.creationSnapshot())
            val original = checkNotNull(fixture.saved)
            val result = fixture.completed(original)
            assertFalse(result.copy(accessSecretIds = emptyList()).matches(original, request))
            assertFalse(result.copy(command = result.command.copy(actorId = HomeCreationTestFixture.HOME_ID)).matches(original, request))
            assertFalse(fixture.codec.valid(original.copy(form = original.form - "homeType"), fixture.scope))
            subject.resolve(HomeCreationAction.Submit)
            val changed = fixture.codec.encode(request.copy(requestId = original.requestId, name = "Changed"))
            fixture.saved = checkNotNull(fixture.saved).copy(requestJson = changed)
            assertTrue(runCatching { subject.acknowledge() }.isFailure)
            assertNotNull(fixture.saved)
        }
}
