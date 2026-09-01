@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.ceremonial_mail_open

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2Item
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2ItemResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import com.squareup.moshi.adapters.Rfc3339DateJsonAdapter
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CeremonialMailOpenViewModelTest {
    private val repository: MailboxRepository = mockk()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun savedState(mailId: String = "mail_demo"): SavedStateHandle =
        SavedStateHandle(mapOf(CeremonialMailOpenViewModel.MAIL_ID_KEY to mailId))

    private fun stubItem(
        senderTrust: String = "pantopus_user",
        objectPayloadJson: String? =
            "{\"stationeryTheme\":\"midnight_blue\",\"inkSelection\":\"navy\"," +
                "\"sealChoice\":\"wax_red\",\"voicePostscriptUri\":\"https://uploads.test/v1.m4a\"}",
        content: String = "Dear Alice,\n\nFirst paragraph.\n\nSecond paragraph.",
    ) {
        // Decode the payload through Moshi so the JsonValue matches
        // what the production decoder would emit at runtime.
        val moshi =
            com.squareup.moshi.Moshi
                .Builder()
                .add(java.util.Date::class.java, Rfc3339DateJsonAdapter().nullSafe())
                .add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory())
                .build()
        val payload =
            objectPayloadJson?.let {
                @Suppress("UNCHECKED_CAST")
                moshi.adapter(Any::class.java).fromJson(it) as Map<String, Any?>
            }
        coEvery { repository.item(any()) } returns
            NetworkResult.Success(
                MailboxV2ItemResponse(
                    mail =
                        MailboxV2Item(
                            id = "mail_demo",
                            type = "letter",
                            createdAt = "2026-05-15T12:00:00Z",
                            displayTitle = "A note from a friend",
                            previewText = "Dear Alice…",
                            sender = DrawerMail.SenderRef(name = "Maya K.", username = "mayak"),
                            senderDisplay = "Maya K.",
                            senderTrust = senderTrust,
                            senderUserId = "u_maya",
                            `package` = null,
                            packageInfo = null,
                            packageTimeline = emptyList(),
                            objectPayload = payload,
                            subject = "A note from a friend",
                            content = content,
                        ),
                ),
            )
    }

    @Test fun load_projects_letter_from_object_payload() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            val loaded = vm.state.value as CeremonialMailOpenUiState.Loaded
            assertEquals(CeremonialMailPhase.Sealed, loaded.phase)
            val letter = loaded.letter
            assertEquals("Maya K.", letter.sender.displayName)
            assertEquals("mayak", letter.sender.handle)
            assertEquals("Pantopus friend", letter.sender.trustLabel)
            assertEquals(CeremonialMailStationeryTone.MidnightBlue, letter.stationery)
            assertEquals(CeremonialMailInkTone.Navy, letter.ink)
            assertEquals(CeremonialMailSealTone.WaxRed, letter.seal)
            assertEquals("https://uploads.test/v1.m4a", letter.voicePostscriptUri)
            assertEquals(3, letter.bodyParagraphs.size)
        }

    @Test fun missing_object_payload_falls_back_to_defaults() =
        runTest(dispatcher) {
            stubItem(objectPayloadJson = null, senderTrust = "none")
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            val letter = (vm.state.value as CeremonialMailOpenUiState.Loaded).letter
            assertEquals(CeremonialMailStationeryTone.ClassicCream, letter.stationery)
            assertEquals(CeremonialMailInkTone.Walnut, letter.ink)
            assertEquals(CeremonialMailSealTone.WaxRed, letter.seal)
            assertNull(letter.voicePostscriptUri)
            assertNull(letter.sender.trustLabel)
        }

    @Test fun load_failure_transitions_error() =
        runTest(dispatcher) {
            coEvery { repository.item(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is CeremonialMailOpenUiState.Error)
        }

    @Test fun blank_mail_id_short_circuits_to_error() =
        runTest(dispatcher) {
            val vm = CeremonialMailOpenViewModel(repository, savedState(mailId = ""))
            vm.load()
            assertTrue(vm.state.value is CeremonialMailOpenUiState.Error)
        }

    @Test fun start_breaking_seal_cycles_to_open() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            vm.startBreakingSeal()
            val mid = vm.state.value as CeremonialMailOpenUiState.Loaded
            assertEquals(CeremonialMailPhase.Breaking, mid.phase)
            advanceUntilIdle() // resolves the 750ms delay
            val finished = vm.state.value as CeremonialMailOpenUiState.Loaded
            assertEquals(CeremonialMailPhase.Open, finished.phase)
        }

    // T6.5d (P22) — reduce-motion + skip-animation behavior.
    @Test fun start_breaking_seal_with_skip_jumps_straight_to_open() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            // Reduce-motion path — the screen passes `skipAnimation = true`
            // so we never enter the `.breaking` intermediate frame.
            vm.startBreakingSeal(skipAnimation = true)
            assertEquals(
                CeremonialMailPhase.Open,
                (vm.state.value as CeremonialMailOpenUiState.Loaded).phase,
            )
        }

    @Test fun seasonal_stationery_tones_decode() {
        assertEquals(CeremonialMailStationeryTone.Fall, CeremonialMailStationeryTone.fromWire("fall"))
        assertEquals(CeremonialMailStationeryTone.Winter, CeremonialMailStationeryTone.fromWire("winter"))
        assertEquals(CeremonialMailStationeryTone.Spring, CeremonialMailStationeryTone.fromWire("spring"))
        assertEquals(CeremonialMailStationeryTone.Summer, CeremonialMailStationeryTone.fromWire("summer"))
        assertEquals(CeremonialMailStationeryTone.Evergreen, CeremonialMailStationeryTone.fromWire("evergreen"))
    }

    @Test fun seasonal_seal_tones_decode() {
        assertEquals(CeremonialMailSealTone.Fall, CeremonialMailSealTone.fromWire("fall"))
        assertEquals(CeremonialMailSealTone.Winter, CeremonialMailSealTone.fromWire("winter"))
        assertEquals(CeremonialMailSealTone.Spring, CeremonialMailSealTone.fromWire("spring"))
        assertEquals(CeremonialMailSealTone.Summer, CeremonialMailSealTone.fromWire("summer"))
        assertEquals(CeremonialMailSealTone.Evergreen, CeremonialMailSealTone.fromWire("evergreen"))
    }

    @Test fun start_breaking_seal_ignored_when_not_sealed() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            vm.openImmediately()
            val openPhase = (vm.state.value as CeremonialMailOpenUiState.Loaded).phase
            vm.startBreakingSeal()
            assertEquals(openPhase, (vm.state.value as CeremonialMailOpenUiState.Loaded).phase)
        }

    @Test fun open_immediately_skips_animation() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            vm.openImmediately()
            assertEquals(
                CeremonialMailPhase.Open,
                (vm.state.value as CeremonialMailOpenUiState.Loaded).phase,
            )
        }

    @Test fun enter_replying_and_reset_to_open() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            vm.openImmediately()
            vm.enterReplying()
            assertEquals(
                CeremonialMailPhase.Replying,
                (vm.state.value as CeremonialMailOpenUiState.Loaded).phase,
            )
            vm.resetToOpen()
            assertEquals(
                CeremonialMailPhase.Open,
                (vm.state.value as CeremonialMailOpenUiState.Loaded).phase,
            )
        }

    @Test fun voice_playback_toggle_flips_flag() =
        runTest(dispatcher) {
            stubItem()
            val vm = CeremonialMailOpenViewModel(repository, savedState())
            vm.load()
            advanceUntilIdle()
            assertTrue(!vm.isVoicePlaying.value)
            vm.toggleVoicePlayback()
            assertTrue(vm.isVoicePlaying.value)
            vm.stopVoicePlayback()
            assertTrue(!vm.isVoicePlaying.value)
        }

    @Test fun stationery_tone_wire_decoding() {
        assertEquals(
            CeremonialMailStationeryTone.MidnightBlue,
            CeremonialMailStationeryTone.fromWire("midnight_blue"),
        )
        assertEquals(CeremonialMailStationeryTone.Linen, CeremonialMailStationeryTone.fromWire("linen"))
        assertEquals(CeremonialMailStationeryTone.ClassicCream, CeremonialMailStationeryTone.fromWire(null))
        assertEquals(CeremonialMailStationeryTone.ClassicCream, CeremonialMailStationeryTone.fromWire("unknown"))
    }

    @Test fun seal_tone_wire_decoding() {
        assertEquals(CeremonialMailSealTone.WaxBlue, CeremonialMailSealTone.fromWire("wax_blue"))
        assertEquals(CeremonialMailSealTone.WaxBlack, CeremonialMailSealTone.fromWire("wax_black"))
        assertEquals(CeremonialMailSealTone.None, CeremonialMailSealTone.fromWire("none"))
        assertEquals(CeremonialMailSealTone.WaxRed, CeremonialMailSealTone.fromWire(null))
    }

    @Test fun default_outcome_ctas_include_write_back() {
        val ctas = CeremonialMailLetter.defaultOutcomeCtas()
        assertEquals("write_back", ctas.first().id)
        assertEquals(CeremonialOutcomeCta.Style.Primary, ctas.first().style)
        assertEquals(3, ctas.size)
    }
}
