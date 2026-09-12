package app.pantopus.android.ui.screens.homes.postal

import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.HomePostalCodec
import app.pantopus.android.data.homes.HomePostalOutcome
import app.pantopus.android.data.homes.HomePostalScope
import app.pantopus.android.data.homes.PendingHomePostalCommand
import app.pantopus.android.data.homes.PendingHomePostalStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomePostalRecoveryTest {
    private val codec = HomePostalCodec(Moshi.Builder().build())
    private val scope =
        HomePostalScope(
            "http://127.0.0.1:18084/",
            "ddc24200-0000-4000-8000-000000000001",
            "ddc24200-0000-4000-8000-000000000003",
        )
    private val card = "ddc24200-0000-4000-8000-000000000004"
    private var saved: PendingHomePostalCommand? = null
    private var failProofWrite = false
    private var cancelAfterClear = false
    private val calls = mutableListOf<Pair<HomePostalAction, PendingHomePostalCommand>>()
    private val store =
        object : PendingHomePostalStore {
            override suspend fun read(scope: HomePostalScope): PendingHomePostalCommand? = saved

            override suspend fun replace(
                scope: HomePostalScope,
                expected: PendingHomePostalCommand?,
                next: PendingHomePostalCommand?,
            ) {
                check(saved == expected)
                check(!failProofWrite || next?.outcome == null)
                saved = next
                if (next == null && cancelAfterClear) throw CancellationException("Screen retired after IO commit")
            }
        }

    private fun coordinator(transport: HomePostalTransport) =
        HomePostalCoordinator(scope, store, codec, { draft, action ->
            calls += action to draft
            transport.resolve(draft, action)
        }, {})

    private fun completed(draft: PendingHomePostalCommand) =
        HomePostalOutcome(
            "completed",
            scope.homeId,
            HomeCreationOutcome.Command(scope.actorId, draft.requestId, "2026-09-12T00:00:00Z", "2026-09-12T00:00:01Z"),
            card,
            verificationStatus = "provisional",
            recordedAt = "2026-09-12T00:00:01Z",
            challengeWindowEndsAt = "2026-09-19T00:00:01Z",
            currentAccess = "not_checked",
        )

    @Test fun lost_code_reply_then_failed_proof_save_reuses_original_without_another_submission() =
        runTest {
            val first = coordinator { _, _ -> error("Reply lost after SQL decided the attempt") }
            first.prepareCode("ABC123", card)
            val original = checkNotNull(saved)
            assertTrue(runCatching { first.resolve(HomePostalAction.Submit) }.isFailure)
            val reopened =
                coordinator { draft, _ ->
                    failProofWrite = true
                    completed(draft)
                }
            reopened.restore()
            assertEquals(original, reopened.pending)
            assertTrue(runCatching { reopened.resolve(HomePostalAction.Check) }.isFailure)
            assertEquals("completed", reopened.outcome?.state)
            assertNull(saved?.outcome)
            failProofWrite = false
            reopened.resolve(HomePostalAction.Submit)
            assertEquals(listOf(HomePostalAction.Submit, HomePostalAction.Check), calls.map { it.first })
            assertEquals(original.requestJson, saved?.requestJson)
            reopened.acknowledge()
            assertNull(saved)
        }

    @Test fun confirmed_acknowledgement_survives_cancellation_after_storage_removed_the_original() =
        runTest {
            val subject = coordinator { draft, _ -> completed(draft) }
            subject.prepareCode("ABC123", card)
            subject.resolve(HomePostalAction.Submit)
            cancelAfterClear = true
            assertTrue(runCatching { subject.acknowledge() }.exceptionOrNull() is CancellationException)
            assertNull(saved)
            subject.hide()
            subject.restore()
            assertNull(subject.pending)
            assertNull(subject.outcome)
            subject.prepareCode("DEF456", card)
            assertTrue(checkNotNull(saved).requestJson.contains("DEF456"))
            assertEquals(1, calls.size)
        }

    @Test fun missing_unacknowledged_original_cannot_be_replaced_after_a_completed_response() =
        runTest {
            val subject = coordinator { draft, _ -> completed(draft) }
            subject.prepareCode("ABC123", card)
            subject.resolve(HomePostalAction.Submit)
            val retained = saved
            saved = null // An unexpected missing slot is different from an explicit acknowledgement.
            subject.hide()
            assertTrue(runCatching { subject.restore() }.isFailure)
            assertTrue(runCatching { subject.prepareCode("DEF456", card) }.isFailure)
            saved = retained
            subject.restore()
            assertEquals(retained, subject.pending)
        }

    @Test fun original_code_proof_rejects_other_actor_home_card_and_historical_access_grant() =
        runTest {
            val subject = coordinator { draft, _ -> completed(draft) }
            subject.prepareCode("ABC123", card)
            val original = checkNotNull(saved)
            val result = completed(original)
            assertTrue(result.matches(original))
            assertFalse(result.copy(homeId = card).matches(original))
            assertFalse(result.copy(postcardId = scope.homeId).matches(original))
            assertFalse(result.copy(command = result.command.copy(actorId = scope.homeId)).matches(original))
            assertFalse(result.copy(currentAccess = "shared").matches(original))
            assertFalse(result.sameDecision(result.copy(recordedAt = "2026-09-13T00:00:01Z")))
        }
}
