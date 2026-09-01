@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.AckResponse
import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.MailDetailResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.mailbox.MailboxDocumentRepository
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import io.mockk.coEvery
import io.mockk.mockk
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
 * T6.5b (P20) — Tests for the generic A17.1 mail detail VM. Mirrors
 * iOS `MailDetailViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailDetailViewModelTest {
    private val repo: MailboxRepository = mockk()
    private val vaultRepo: MailboxVaultRepository = mockk(relaxed = true)
    private val gigsRepo: GigsRepository = mockk(relaxed = true)
    private val packageRepo: MailboxPackageRepository = mockk(relaxed = true)
    private val documentRepo: MailboxDocumentRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeDetail(
        id: String = "m1",
        type: String = "notice",
        mailType: String? = "notice",
        displayTitle: String? = null,
        subject: String? = null,
        previewText: String? = null,
        content: String? = null,
        senderName: String? = null,
        senderUsername: String? = null,
        ackRequired: Boolean? = null,
        ackStatus: String? = null,
        attachments: List<String>? = null,
        senderBusinessName: String? = null,
    ): MailDetail =
        MailDetail(
            id = id,
            type = type,
            mailType = mailType,
            displayTitle = displayTitle,
            previewText = previewText,
            subject = subject,
            content = content,
            senderBusinessName = senderBusinessName,
            senderAddress = null,
            ackRequired = ackRequired,
            ackStatus = ackStatus,
            attachments = attachments,
            expiresAt = null,
            createdAt = "2026-05-15T12:00:00Z",
            sender = senderName?.let { MailDetail.Sender(id = "u1", username = senderUsername ?: "user", name = it) },
            `object` = null,
            contentFormat = null,
            links = emptyList(),
        )

    private fun makeVm(): MailDetailViewModel =
        MailDetailViewModel(
            repo = repo,
            vaultRepo = vaultRepo,
            gigsRepo = gigsRepo,
            packageRepo = packageRepo,
            documentRepo = documentRepo,
            savedStateHandle = SavedStateHandle(mapOf(MAIL_DETAIL_MAIL_ID_KEY to "m1")),
        )

    // ─── Four states ───────────────────────────────────────

    @Test
    fun load_success_then_loaded() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                displayTitle = "Notice of public hearing",
                                previewText = "Hearing June 3.",
                                content = "Para 1.\n\nPara 2.",
                                senderName = "City of Oakland",
                                ackRequired = true,
                                attachments = listOf("notice.pdf", "site-plan.jpg"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is MailDetailUiState.Loaded)
            val content = (state as MailDetailUiState.Loaded).content
            assertEquals("Notice of public hearing", content.title)
            assertEquals(MailItemCategory.Notice, content.category)
            assertEquals(MailDetailTrust.Neutral, content.detailTrust)
            assertEquals("City of Oakland", content.senderDisplayName)
            assertEquals(listOf("Para 1.", "Para 2."), content.bodyParagraphs)
            assertEquals(2, content.attachments.size)
            assertTrue(content.ackRequired)
            assertFalse(content.isAcknowledged)
        }

    @Test
    fun load_failure_renders_error() =
        runTest {
            coEvery { repo.detail(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is MailDetailUiState.Error)
        }

    /**
     * Ceremonial mail (carrying `mail_extracted.stationeryTheme`) redirects
     * out of the generic detail into the ceremonial open experience, and the
     * plain layout never renders — mirrors RN `src/app/mailbox/detail.tsx:43-49`.
     */
    @Test
    fun load_stationeryMail_redirectsToCeremonialOpen() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                displayTitle = "A letter from Ada",
                                content = "Dear you,",
                            ).copy(mailExtracted = mapOf("stationeryTheme" to "linen")),
                    ),
                )
            val vm = makeVm()
            vm.load()

            assertEquals("m1", vm.ceremonialRedirectMailId.value)
            assertTrue(vm.state.value is MailDetailUiState.Loading)
            vm.acknowledgeCeremonialRedirect()
            assertNull(vm.ceremonialRedirectMailId.value)
        }

    @Test
    fun load_withoutStationery_doesNotRedirect() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(mail = makeDetail(displayTitle = "Notice", content = "Body")),
                )
            val vm = makeVm()
            vm.load()

            assertNull(vm.ceremonialRedirectMailId.value)
            assertTrue(vm.state.value is MailDetailUiState.Loaded)
        }

    // ─── Pure projection ──────────────────────────────────

    @Test
    fun projection_falls_back_to_general_for_unknown_type() {
        val projected = MailDetailViewModel.project(makeDetail(type = "qq", mailType = "qq"))
        assertEquals(MailItemCategory.General, projected.category)
        assertEquals("Mail", projected.title)
    }

    @Test
    fun projection_uses_display_title_over_subject() {
        val projected =
            MailDetailViewModel.project(
                makeDetail(
                    type = "bill",
                    mailType = "bill",
                    displayTitle = "Bill due",
                    subject = "Should be ignored",
                ),
            )
        assertEquals("Bill due", projected.title)
        assertEquals(MailItemCategory.Bill, projected.category)
    }

    @Test
    fun projection_splits_content_on_blank_lines() {
        val projected = MailDetailViewModel.project(makeDetail(content = "First.\n\nSecond.\n\n\n\nThird."))
        assertEquals(listOf("First.", "Second.", "Third."), projected.bodyParagraphs)
    }

    @Test
    fun projection_empty_content_yields_zero_paragraphs() {
        val projected = MailDetailViewModel.project(makeDetail(content = ""))
        assertTrue(projected.bodyParagraphs.isEmpty())
    }

    @Test
    fun projection_key_facts_include_received_and_category() {
        val projected = MailDetailViewModel.project(makeDetail(displayTitle = "Notice"))
        val facts = projected.keyFacts()
        assertTrue(facts.any { it.label == "Received" })
        assertTrue(facts.any { it.label == "Category" && it.value == "Notice" })
    }

    @Test
    fun projection_initials_from_sender() {
        assertEquals("CO", MailDetailViewModel.makeInitials("City of Oakland"))
        assertEquals("A", MailDetailViewModel.makeInitials("Acme"))
        assertEquals("M", MailDetailViewModel.makeInitials(""))
    }

    @Test
    fun projection_prefers_sender_record_over_business_name() {
        val projected =
            MailDetailViewModel.project(
                makeDetail(
                    senderName = "City of Oakland",
                    senderBusinessName = "Should not appear",
                ),
            )
        assertEquals("City of Oakland", projected.senderDisplayName)
    }

    @Test
    fun projection_uses_business_name_when_sender_absent() {
        val projected = MailDetailViewModel.project(makeDetail(senderBusinessName = "Acme Bakery"))
        assertEquals("Acme Bakery", projected.senderDisplayName)
        assertNull(projected.senderUserId)
    }

    // ─── Optimistic acknowledge ──────────────────────────

    @Test
    fun acknowledge_flips_flag_optimistically_then_succeeds() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(MailDetailResponse(mail = makeDetail(ackRequired = true)))
            coEvery { repo.acknowledge("m1") } returns
                NetworkResult.Success(AckResponse(message = "ok", ackStatus = "acknowledged"))
            val vm = makeVm()
            vm.load()
            vm.acknowledge()
            val state = vm.state.value
            assertTrue(state is MailDetailUiState.Loaded)
            assertTrue((state as MailDetailUiState.Loaded).content.isAcknowledged)
            assertEquals("Acknowledged", vm.toast.value)
        }

    @Test
    fun acknowledge_rolls_back_on_failure() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(MailDetailResponse(mail = makeDetail(ackRequired = true)))
            coEvery { repo.acknowledge("m1") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.acknowledge()
            val state = vm.state.value
            assertTrue(state is MailDetailUiState.Loaded)
            assertFalse((state as MailDetailUiState.Loaded).content.isAcknowledged)
            assertNotNull(vm.toast.value)
        }
}
