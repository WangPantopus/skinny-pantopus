@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.search

import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.data.api.models.mailbox.MailboxListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P4.2 — Covers the Mailbox Search VM:
 *  - corpus loads once; isLoading clears on settle (success + failure)
 *  - blank query → no results
 *  - matching across sender / subject / body / category (case-insensitive)
 *  - result rows reuse the Mailbox list row projection
 *  - result taps route to the mail id
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailboxSearchViewModelTest {
    private val repo: MailboxRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // m1 — sender "City of Oakland", subject "Water bill", category bill
    // m2 — sender "Maria Kovacs", body "Booklet enclosed", category booklet
    // m3 — sender "Acme Insurance", subject "Policy renewal", category insurance
    private val corpus =
        listOf(
            mail(
                id = "m1",
                type = "bill",
                mailType = "bill",
                subject = "Water bill",
                previewText = "Due June 1",
                sender = "City of Oakland",
            ),
            mail(
                id = "m2",
                type = "booklet",
                mailType = "booklet",
                displayTitle = "Welcome packet",
                previewText = "Booklet enclosed",
                sender = "Maria Kovacs",
            ),
            mail(
                id = "m3",
                type = "insurance",
                mailType = "insurance",
                subject = "Policy renewal",
                previewText = "Renew by July",
                sender = "Acme Insurance",
            ),
        )

    private fun mail(
        id: String,
        type: String = "general",
        mailType: String? = null,
        subject: String? = null,
        displayTitle: String? = null,
        previewText: String? = null,
        content: String? = null,
        sender: String? = null,
    ) = MailItem(
        id = id,
        recipientUserId = null,
        recipientHomeId = null,
        deliveryTargetType = null,
        deliveryTargetId = null,
        addressHomeId = null,
        attnUserId = null,
        attnLabel = null,
        deliveryVisibility = null,
        mailType = mailType,
        displayTitle = displayTitle,
        previewText = previewText,
        primaryAction = null,
        actionRequired = null,
        ackRequired = null,
        ackStatus = null,
        type = type,
        subject = subject,
        content = content,
        senderUserId = null,
        senderBusinessName = sender,
        senderAddress = null,
        viewed = false,
        viewedAt = null,
        archived = false,
        starred = false,
        payoutAmount = null,
        payoutStatus = null,
        category = null,
        tags = emptyList(),
        priority = "normal",
        attachments = null,
        expiresAt = null,
        createdAt = "2026-05-15T12:00:00Z",
    )

    private fun stubSuccess(items: List<MailItem> = corpus) {
        coEvery { repo.list(any(), any(), any(), any(), any()) } returns
            NetworkResult.Success(MailboxListResponse(mail = items, count = items.size))
    }

    // ─── Pure matching ─────────────────────────────────────────

    @Test fun matches_by_sender() {
        val m = mail(id = "x", sender = "City of Oakland")
        assertTrue(MailboxSearchViewModel.matches(m, "oakland"))
        assertTrue(MailboxSearchViewModel.matches(m, "CITY"))
        assertFalse(MailboxSearchViewModel.matches(m, "berkeley"))
    }

    @Test fun matches_by_subject_and_body() {
        val m = mail(id = "x", subject = "Water bill", previewText = "Booklet enclosed")
        assertTrue(MailboxSearchViewModel.matches(m, "water"))
        assertTrue(MailboxSearchViewModel.matches(m, "enclosed"))
    }

    @Test fun matches_by_category_label() {
        // mail_type "insurance" → category label "Insurance".
        val m = mail(id = "x", type = "insurance", mailType = "insurance", subject = "Policy")
        assertTrue(MailboxSearchViewModel.matches(m, "insurance"))
    }

    @Test fun filter_blank_query_yields_empty() {
        assertTrue(MailboxSearchViewModel.filter(corpus, "").isEmpty())
        assertTrue(MailboxSearchViewModel.filter(corpus, "   ").isEmpty())
    }

    @Test fun filter_returns_only_matches() {
        assertEquals(listOf("m3"), MailboxSearchViewModel.filter(corpus, "policy").map { it.id })
    }

    // ─── Load + query lifecycle ────────────────────────────────

    @Test fun initial_state_is_loading_with_no_results() {
        val vm = MailboxSearchViewModel(repo)
        assertTrue(vm.isLoading.value)
        assertTrue(vm.results.value.isEmpty())
    }

    @Test fun load_clears_loading_and_keeps_results_empty_for_blank_query() =
        runTest {
            stubSuccess()
            val vm = MailboxSearchViewModel(repo)
            vm.load()
            assertFalse(vm.isLoading.value)
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun query_filters_loaded_corpus() =
        runTest {
            stubSuccess()
            val vm = MailboxSearchViewModel(repo)
            vm.load()
            vm.onQueryChange("oakland")
            assertEquals(listOf("m1"), vm.results.value.map { it.id })
            vm.onQueryChange("booklet")
            assertEquals(listOf("m2"), vm.results.value.map { it.id })
            vm.onQueryChange("zzzzz")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun load_failure_leaves_empty_results() =
        runTest {
            coEvery { repo.list(any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = MailboxSearchViewModel(repo)
            vm.load()
            assertFalse(vm.isLoading.value)
            vm.onQueryChange("oakland")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun row_model_reuses_mailbox_row() =
        runTest {
            stubSuccess()
            val vm = MailboxSearchViewModel(repo)
            vm.load()
            vm.onQueryChange("oakland")
            val match = vm.results.value.first()
            val row = vm.rowModel(match)
            assertEquals("Water bill", row.title)
            assertEquals("Bill", row.chips?.first()?.text) // reused category chip
            assertTrue(row.leading is RowLeading.TypeIcon)
        }

    @Test fun row_tap_routes_to_mail() =
        runTest {
            var opened: String? = null
            stubSuccess()
            val vm = MailboxSearchViewModel(repo)
            vm.configureNavigation(onOpenMail = { opened = it })
            vm.load()
            vm.onQueryChange("oakland")
            vm.rowModel(vm.results.value.first()).onTap()
            assertEquals("m1", opened)
        }
}
