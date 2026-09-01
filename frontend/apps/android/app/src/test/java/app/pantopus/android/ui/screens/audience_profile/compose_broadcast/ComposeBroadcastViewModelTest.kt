@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.audience_profile.compose_broadcast

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.audience.BroadcastChannelDto
import app.pantopus.android.data.api.models.audience.BroadcastHistoryResponse
import app.pantopus.android.data.api.models.audience.BroadcastMessageDto
import app.pantopus.android.data.api.models.audience.MembershipStatsResponse
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PublishUpdateBody
import app.pantopus.android.data.api.models.audience.PublishUpdateResponse
import app.pantopus.android.data.api.models.posts.PostMediaUploadResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A.7 (A22.2) — Behavioral coverage for the Compose Broadcast VM, mirroring
 * the iOS `ComposeBroadcastViewModelTests`: derived composeState
 * (empty / composing / scheduled / sending / error), live counter,
 * over-limit guard, audience + media + send reset, the unsaved-draft
 * indicator, and the first-run CTA copy.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ComposeBroadcastViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    // The behavioral tests never call load() or the real publish path
    // (send-success uses the default no-op performSend, send-failure overrides
    // it), so an unstubbed mock repository is never invoked.
    private val repository: AudienceProfileRepository = mockk()
    private val uploadRepository: UploadRepository = mockk()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun buildVm(personaId: String = "p1"): ComposeBroadcastViewModel =
        ComposeBroadcastViewModel(
            SavedStateHandle(mapOf(COMPOSE_BROADCAST_PERSONA_ID_KEY to personaId)),
            repository,
            uploadRepository,
        )

    @Test
    fun `initial state is empty`() {
        val vm = buildVm()
        assertEquals(ComposeBroadcastState.Empty, vm.state.value.composeState())
        assertFalse(vm.state.value.canSend)
        assertEquals(0, vm.state.value.characterCount)
        assertFalse(vm.state.value.isDirty)
    }

    @Test
    fun `typing transitions to composing and counts live`() {
        val vm = buildVm()
        vm.updateBody("Hello beacons")
        assertEquals(ComposeBroadcastState.Composing(vm.state.value.draft), vm.state.value.composeState())
        assertEquals(13, vm.state.value.characterCount)
        assertTrue(vm.state.value.canSend)
        assertTrue(vm.state.value.isDirty)
    }

    @Test
    fun `over character limit blocks send`() {
        val vm = buildVm()
        vm.updateBody("a".repeat(1001))
        assertTrue(vm.state.value.isOverLimit)
        assertFalse(vm.state.value.canSend)
    }

    @Test
    fun `media without body still allows send`() {
        val vm = buildVm()
        vm.attachMedia(ComposeMediaPreview(id = "m", kind = ComposeMediaPreview.Kind.Image, caption = "boule.jpg"))
        assertFalse(vm.state.value.draft.isEmpty)
        assertTrue(vm.state.value.canSend)
        vm.removeMedia()
        assertTrue(vm.state.value.draft.media.isEmpty())
        assertEquals(ComposeBroadcastState.Empty, vm.state.value.composeState())
    }

    @Test
    fun `multi select appends up to nine attachments`() {
        val vm = buildVm()
        vm.attachMedia(
            (0 until 5).map {
                ComposeMediaPreview(id = "a$it", kind = ComposeMediaPreview.Kind.Image, caption = null)
            },
        )
        assertEquals(5, vm.state.value.draft.media.size)
        assertEquals(4, vm.state.value.draft.remainingMediaSlots)

        // Overflowing batch is truncated at the cap, not rejected.
        vm.attachMedia(
            (0 until 6).map {
                ComposeMediaPreview(id = "b$it", kind = ComposeMediaPreview.Kind.Video, caption = null)
            },
        )
        assertEquals(ComposeBroadcastDraft.MEDIA_LIMIT, vm.state.value.draft.media.size)
        assertEquals(0, vm.state.value.draft.remainingMediaSlots)

        vm.removeMedia("a0")
        assertEquals(8, vm.state.value.draft.media.size)
        assertFalse(vm.state.value.draft.media.any { it.id == "a0" })
    }

    @Test
    fun `picked media becomes a multipart upload file`() {
        val picked =
            ComposeMediaPreview(
                id = "content://media/42",
                kind = ComposeMediaPreview.Kind.Image,
                caption = "boule.jpg",
                bytes = byteArrayOf(1, 2, 3),
                mimeType = "image/heic",
            )
        val file = uploadFileFor(picked)
        assertEquals("image/heic", file?.mimeType)
        assertFalse(file?.filename?.contains("IMG_") ?: true)
        assertNull(
            uploadFileFor(
                ComposeMediaPreview(id = "sample", kind = ComposeMediaPreview.Kind.Image, caption = null),
            ),
        )
    }

    @Test
    fun `set audience updates draft and reach`() {
        val vm = buildVm()
        assertEquals(BroadcastAudience.AllBeacons, vm.state.value.draft.audience)
        vm.setAudience(BroadcastAudience.BronzePlus)
        assertEquals(BroadcastAudience.BronzePlus, vm.state.value.draft.audience)
        assertEquals(518, vm.state.value.reach(BroadcastAudience.BronzePlus))
    }

    @Test
    fun `schedule and send now toggle state`() {
        val vm = buildVm()
        vm.updateBody("Loaf drop at 4")
        vm.schedule(ComposeBroadcastSampleData.SCHEDULED_AT_MILLIS)
        val scheduled = vm.state.value.composeState()
        assertTrue(scheduled is ComposeBroadcastState.Scheduled)
        assertEquals(ComposeBroadcastSampleData.SCHEDULED_AT_MILLIS, vm.state.value.scheduledAtMillis)
        vm.sendNow()
        assertNull(vm.state.value.scheduledAtMillis)
        assertEquals(ComposeBroadcastState.Composing(vm.state.value.draft), vm.state.value.composeState())
    }

    @Test
    fun `save draft clears unsaved indicator`() {
        val vm = buildVm()
        vm.updateBody("draft")
        assertTrue(vm.state.value.isDirty)
        vm.saveDraft()
        assertFalse(vm.state.value.isDirty)
        vm.updateBody("draft and more")
        assertTrue(vm.state.value.isDirty)
    }

    @Test
    fun `send passes through sending then resets`() =
        runTest(dispatcher) {
            val vm = buildVm()
            vm.updateBody("Going live")
            vm.send()
            // StandardTestDispatcher defers the launched body, so the
            // synchronous phase flip is observable here.
            assertEquals(ComposeBroadcastState.Sending, vm.state.value.composeState())
            advanceUntilIdle()
            assertEquals(ComposeBroadcastState.Empty, vm.state.value.composeState())
        }

    @Test
    fun `send success calls onSent and keeps audience`() =
        runTest(dispatcher) {
            val vm = buildVm()
            var sent = false
            vm.setAudience(BroadcastAudience.SilverPlus)
            vm.updateBody("Q&A recording is up")
            vm.send(onSent = { sent = true })
            advanceUntilIdle()
            assertTrue(sent)
            assertEquals(ComposeBroadcastState.Empty, vm.state.value.composeState())
            assertEquals(BroadcastAudience.SilverPlus, vm.state.value.draft.audience)
            assertFalse(vm.state.value.isDirty)
        }

    @Test
    fun `send failure surfaces error and preserves draft`() =
        runTest(dispatcher) {
            val vm = buildVm()
            vm.performSend = { _, _ -> throw SendFailure("Network down") }
            vm.updateBody("keep me")
            vm.send()
            advanceUntilIdle()
            assertEquals(ComposeBroadcastState.Error("Network down"), vm.state.value.composeState())
            assertEquals("keep me", vm.state.value.draft.body)
            vm.retry()
            assertEquals(
                ComposeBroadcastState.Composing(ComposeBroadcastDraft(body = "keep me")),
                vm.state.value.composeState(),
            )
        }

    @Test
    fun `editing clears prior send error`() =
        runTest(dispatcher) {
            val vm = buildVm()
            vm.performSend = { _, _ -> throw SendFailure("Oops") }
            vm.updateBody("first")
            vm.send()
            advanceUntilIdle()
            assertEquals(ComposeBroadcastState.Error("Oops"), vm.state.value.composeState())
            vm.updateBody("first edited")
            assertEquals(ComposeBroadcastState.Composing(vm.state.value.draft), vm.state.value.composeState())
        }

    @Test
    fun `primary action title reflects first run`() {
        val withRecents = ComposeBroadcastSampleData.populated()
        assertEquals("Send broadcast", withRecents.primaryActionTitle)
        val firstRun = ComposeBroadcastSampleData.empty()
        assertEquals("Send your first broadcast", firstRun.primaryActionTitle)
    }

    @Test
    fun `sample data provides at least three recent broadcasts with stats`() {
        val recents = ComposeBroadcastSampleData.recentBroadcasts
        assertTrue(recents.size >= 3)
        recents.forEach {
            assertTrue(it.reach.isNotEmpty())
            assertTrue(it.read.isNotEmpty())
            assertTrue(it.reactions.isNotEmpty())
            assertTrue(it.replies.isNotEmpty())
        }
    }

    // MARK: - Place tag

    @Test
    fun `select and clear place tag mutate the draft`() {
        val vm = buildVm()
        vm.selectPlaceTag(placeTag())
        assertEquals(placeTag(), vm.state.value.draft.placeTag)
        vm.clearPlaceTag()
        assertNull(vm.state.value.draft.placeTag)
    }

    @Test
    fun `publish threads the place tag onto the wire body`() =
        runTest(dispatcher) {
            val body = slot<PublishUpdateBody>()
            stubPublishLegs(body)
            val vm = buildVm()
            vm.load()
            advanceUntilIdle()
            vm.updateBody("Pop-up tonight!")
            vm.selectPlaceTag(placeTag())
            vm.send()
            advanceUntilIdle()
            assertEquals(45.52, body.captured.latitude!!, 0.0)
            assertEquals(-122.68, body.captured.longitude!!, 0.0)
            assertEquals("Blue Bottle", body.captured.locationName)
            assertEquals("123 Main St", body.captured.locationAddress)
            assertEquals("poi.123", body.captured.placeId)
            // Send resets the draft — the tag can't leak onto the next one.
            assertNull(vm.state.value.draft.placeTag)
        }

    @Test
    fun `publish without a place tag keeps the location keys off the wire`() =
        runTest(dispatcher) {
            val body = slot<PublishUpdateBody>()
            stubPublishLegs(body)
            val vm = buildVm()
            vm.load()
            advanceUntilIdle()
            vm.updateBody("No venue this time.")
            vm.send()
            advanceUntilIdle()
            assertNull(body.captured.latitude)
            assertNull(body.captured.longitude)
            assertNull(body.captured.locationName)
            assertNull(body.captured.locationAddress)
            assertNull(body.captured.placeId)
        }

    // MARK: - Media capture location (ADDENDUM 2)

    @Test
    fun `media capture location prefers stills over earlier videos`() {
        val vm = buildVm()
        assertNull(vm.mediaCaptureLocation)
        vm.attachMedia(
            ComposeMediaPreview(
                id = "v1",
                kind = ComposeMediaPreview.Kind.Video,
                caption = null,
                capturedLatitude = 10.0,
                capturedLongitude = 20.0,
            ),
        )
        vm.attachMedia(
            ComposeMediaPreview(
                id = "i1",
                kind = ComposeMediaPreview.Kind.Image,
                caption = null,
                capturedLatitude = 41.8781,
                capturedLongitude = -87.6298,
            ),
        )
        // Stills first (in attach order), then videos — the later still
        // outranks the earlier geotagged video.
        assertEquals(MediaCaptureLocation(latitude = 41.8781, longitude = -87.6298), vm.mediaCaptureLocation)

        // Recomputed on every remove; nil once nothing geotagged remains.
        vm.removeMedia("i1")
        assertEquals(MediaCaptureLocation(latitude = 10.0, longitude = 20.0), vm.mediaCaptureLocation)
        vm.removeMedia("v1")
        assertNull(vm.mediaCaptureLocation)
    }

    @Test
    fun `untagged media exposes no capture location`() {
        val vm = buildVm()
        vm.attachMedia(ComposeMediaPreview(id = "i1", kind = ComposeMediaPreview.Kind.Image, caption = null))
        assertNull(vm.mediaCaptureLocation)
        // One coordinate alone is not a usable anchor.
        vm.attachMedia(
            ComposeMediaPreview(
                id = "i2",
                kind = ComposeMediaPreview.Kind.Image,
                caption = null,
                capturedLatitude = 41.8781,
            ),
        )
        assertNull(vm.mediaCaptureLocation)
    }

    @Test
    fun `media capture location never rides the publish body`() =
        runTest(dispatcher) {
            // PRIVACY RULE — media GPS is a local picker anchor only; the
            // wire body carries location keys only for an explicit pick.
            val body = slot<PublishUpdateBody>()
            stubPublishLegs(body)
            val vm = buildVm()
            vm.load()
            advanceUntilIdle()
            vm.updateBody("Geotagged photo attached.")
            vm.attachMedia(
                ComposeMediaPreview(
                    id = "i1",
                    kind = ComposeMediaPreview.Kind.Image,
                    caption = null,
                    bytes = byteArrayOf(1),
                    capturedLatitude = 41.8781,
                    capturedLongitude = -87.6298,
                ),
            )
            coEvery { uploadRepository.uploadPostMediaFiles(any(), any()) } returns
                NetworkResult.Success(
                    PostMediaUploadResponse(
                        message = "ok",
                        mediaUrls = emptyList(),
                        mediaTypes = emptyList(),
                        mediaThumbnails = emptyList(),
                        mediaLiveUrls = emptyList(),
                    ),
                )
            vm.send()
            advanceUntilIdle()
            assertNull(body.captured.latitude)
            assertNull(body.captured.longitude)
            assertNull(body.captured.locationName)
            assertNull(body.captured.locationAddress)
            assertNull(body.captured.placeId)
        }

    /** Wire up the four legs `load()` + `realPublish` touch. */
    private fun stubPublishLegs(body: io.mockk.CapturingSlot<PublishUpdateBody>) {
        coEvery { repository.me() } returns
            NetworkResult.Success(
                PersonaMeResponse(
                    persona = PersonaSummaryDto(id = "p1", handle = "chef"),
                    channel = BroadcastChannelDto(id = "ch1"),
                ),
            )
        coEvery { repository.membershipStats("p1") } returns
            NetworkResult.Success(MembershipStatsResponse())
        coEvery { repository.broadcastHistory("ch1") } returns
            NetworkResult.Success(BroadcastHistoryResponse())
        coEvery { repository.publishUpdate("ch1", capture(body)) } returns
            NetworkResult.Success(PublishUpdateResponse(message = BroadcastMessageDto(id = "m1")))
    }

    private fun placeTag(): PostPlaceTag =
        PostPlaceTag(
            name = "Blue Bottle",
            address = "123 Main St",
            latitude = 45.52,
            longitude = -122.68,
            placeId = "poi.123",
            kind = "poi",
        )
}

private class SendFailure(message: String) : RuntimeException(message)
