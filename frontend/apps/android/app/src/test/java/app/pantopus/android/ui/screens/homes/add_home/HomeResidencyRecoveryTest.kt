@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.api.models.homes.HomeResidencyAddressSnapshot
import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.PendingHomeCreation
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeResidencyRecoveryTest {
    private val fixture = HomeCreationTestFixture()
    private val address = HomeResidencyAddressSnapshot("12 Example St", "301", "Portland", "OR", "97214", "US")
    private val form =
        AddHomeFormState(
            address = AddHomeAddressFields(address.line1, address.line2, address.city, address.state, address.postalCode),
            role = AddHomeRole.HouseholdMember,
        )

    private fun completion(draft: PendingHomeCreation) =
        HomeCreationOutcome(
            state = "completed",
            command = HomeCreationOutcome.Command(fixture.scope.actorId, draft.requestId, "2026-09-12T00:00:00Z", "2026-09-12T00:00:01Z"),
            residencyHomeId = HomeCreationTestFixture.HOME_ID,
            claimId = "ddc24200-0000-4000-8000-000000000020", occupancyId = "ddc24200-0000-4000-8000-000000000021",
            claimedRole = "household", routing = "household_review", nextStep = "household_review",
            requiresVerification = true, currentAccess = "not_checked", postcardRequested = false,
        )

    @Test
    fun restart_recovers_original_joining_after_failed_transport_and_proof_write() =
        runTest {
            val subject = fixture.coordinator()
            subject.prepareResidency(HomeCreationTestFixture.HOME_ID, address, form.creationSnapshot())
            val original = checkNotNull(fixture.saved)
            fixture.failTransport = true
            assertTrue(runCatching { subject.resolve(HomeCreationAction.Submit) }.isFailure)
            val reopened = fixture.coordinator()
            reopened.restore()
            assertEquals(original, reopened.pending)
            fixture.failTransport = false
            fixture.response = { draft, _ ->
                fixture.failWrite = true
                completion(draft)
            }
            assertTrue(runCatching { reopened.resolve(HomeCreationAction.Check) }.isFailure)
            assertEquals("completed", reopened.outcome?.state)
            assertNull(fixture.saved?.outcome)
            fixture.failWrite = false
            reopened.resolve(HomeCreationAction.Submit)
            assertEquals(listOf(HomeCreationAction.Submit, HomeCreationAction.Check), fixture.calls.map { it.first })
            assertEquals(original.requestJson, fixture.saved?.requestJson)
            reopened.acknowledge()
            assertNull(fixture.saved)
        }

    @Test
    fun retained_join_rejects_changed_unit_other_actor_and_access_grant() =
        runTest {
            val subject = fixture.coordinator()
            subject.prepareResidency(HomeCreationTestFixture.HOME_ID, address, form.creationSnapshot())
            val original = checkNotNull(fixture.saved)
            val result = completion(original)
            assertTrue(fixture.codec.matches(result, original))
            assertFalse(fixture.codec.valid(original.copy(form = original.form + ("unit" to "302")), fixture.scope))
            assertFalse(fixture.codec.matches(result.copy(residencyHomeId = result.claimId), original))
            assertFalse(fixture.codec.matches(result.copy(command = result.command.copy(actorId = result.claimId!!)), original))
            assertFalse(fixture.codec.matches(result.copy(currentAccess = "shared"), original))
            assertFalse(fixture.codec.matches(result.copy(postcardRequested = true), original))
            assertFalse(fixture.codec.matches(result.copy(home = HomeCreationOutcome.Home(HomeCreationTestFixture.HOME_ID)), original))
        }
}
