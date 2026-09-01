@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.translation

import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.MailDetailResponse
import app.pantopus.android.data.api.models.mailbox.v2.TranslationResult
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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
import java.time.Instant

/**
 * A17.13 — the Translation screen now renders a real machine translation
 * instead of a fixture. These lock the projection from the two live
 * payloads (`GET api/mailbox/:id` + `POST api/mailbox/v2/p3/translate`)
 * onto the screen content. Mirrors iOS `MailTranslationProjectionTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailTranslationProjectionTest {
    private val repo: MailboxRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun detail(): MailDetail =
        MailDetail(
            id = "m1",
            type = "letter",
            mailType = "letter",
            subject = "Invitación",
            content = "Querida vecina,\nLe escribo para invitarla a la posada.",
            senderAddress = "Elm Park",
            senderTrust = "pantopus_user",
            createdAt = "2026-05-15T12:00:00Z",
            sender = MailDetail.Sender(id = "u2", username = "lucia", name = "Lucía Herrera"),
            `object` = null,
            contentFormat = null,
        )

    private fun translation(): TranslationResult =
        TranslationResult(
            translatedText = "Dear neighbor,\nI'm writing to invite you to the posada.",
            fromLanguage = "es",
            toLanguage = "en",
            cached = false,
        )

    // ─── Projection ────────────────────────────────────────

    @Test
    fun `projection renders translated text and detected language`() {
        val content =
            MailTranslationProjection.project(
                mailId = "m1",
                detail = detail(),
                translation = translation(),
                now = Instant.parse("2026-05-15T14:00:00Z"),
            )
        assertEquals("ES", content.languages.sourceCode)
        assertEquals("EN", content.languages.targetCode)
        assertEquals("English", content.languages.targetName)
        // The backend reports no confidence — the badge must not invent one.
        assertNull(content.languages.confidence)
        assertEquals(2, content.paragraphs.size)
        assertEquals("Querida vecina,", content.paragraphs.first().original)
        assertEquals("Dear neighbor,", content.paragraphs.first().english)
        assertEquals("Lucía Herrera", content.sender.name)
        assertEquals("LH", content.sender.initials)
        assertEquals("Verified neighbor", content.sender.kind)
        // No translator-notes glossary exists on the wire.
        assertTrue(content.glossary.isEmpty())
        assertFalse(content.confirmed)
    }

    @Test
    fun `alignParagraphs pads the shorter side`() {
        val rows = MailTranslationProjection.alignParagraphs("uno\ndos\ntres", "one\ntwo")
        assertEquals(3, rows.size)
        assertEquals("tres", rows[2].original)
        assertEquals("", rows[2].english)
    }

    @Test
    fun `auto source language reads as auto-detected`() {
        val languages =
            MailTranslationProjection.makeLanguages(
                TranslationResult(
                    translatedText = "hi",
                    fromLanguage = "auto",
                    toLanguage = "en",
                    cached = true,
                ),
            )
        assertEquals("AUTO", languages.sourceCode)
        assertEquals("Auto-detected", languages.sourceName)
        assertNull(languages.confidence)
    }

    // ─── Load ──────────────────────────────────────────────

    @Test
    fun `load fetches detail then translation`() =
        runTest {
            coEvery { repo.detail("m1") } returns NetworkResult.Success(MailDetailResponse(mail = detail()))
            coEvery { repo.translate("m1", any()) } returns NetworkResult.Success(translation())
            val vm = makeVm()
            vm.load()
            advanceUntilIdle()
            val state = vm.state.value
            assertTrue("expected loaded, was $state", state is MailTranslationUiState.Loaded)
            assertEquals("Spanish", (state as MailTranslationUiState.Loaded).content.languages.sourceName)
        }

    @Test
    fun `load failure renders retryable error`() =
        runTest {
            coEvery { repo.detail("m1") } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.state.value is MailTranslationUiState.Error)
        }

    private fun makeVm(): MailTranslationViewModel =
        MailTranslationViewModel(
            appContext = mockk(relaxed = true),
            repo = repo,
            savedStateHandle = androidx.lifecycle.SavedStateHandle(mapOf(TRANSLATION_MAIL_ID_KEY to "m1")),
        )
}
