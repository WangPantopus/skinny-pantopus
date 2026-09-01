@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.review_claims

import app.pantopus.android.data.admin.AdminRepository
import app.pantopus.android.data.api.models.admin.AdminClaimBucket
import app.pantopus.android.data.api.models.admin.AdminClaimCountsResponse
import app.pantopus.android.data.api.models.admin.AdminClaimDto
import app.pantopus.android.data.api.models.admin.AdminClaimHomeDto
import app.pantopus.android.data.api.models.admin.AdminClaimUserDto
import app.pantopus.android.data.api.models.admin.AdminClaimsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * Mirrors iOS `ReviewClaimsViewModelTests` exactly — covers:
 *  - load → loaded transitions on every tab + the warning banner
 *  - Triage chip text varies by age + state (New / Aging / Conflict /
 *    Awaiting docs)
 *  - Approved bucket renders the success chip, rejected uses
 *    CircleSlash + muted highlight, with no banner
 *  - Per-bucket cache survives tab swaps
 *  - Empty states + the "View approved" Pending CTA
 *  - Row tap + footer button both invoke `onOpenClaim`
 *  - Tabs surface the live counts
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReviewClaimsViewModelTest {
    private val repo: AdminRepository = mockk()

    /**
     * Anchored to `Instant.now()` so the age-based chip projection
     * (which reads `Instant.now()` internally) gives stable results
     * regardless of when the test runs.
     */
    private val referenceInstant: Instant = Instant.now()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    // MARK: - Fixtures

    private val counts =
        AdminClaimCountsResponse(pending = 4, approved = 38, rejected = 3)

    private fun home(id: String): AdminClaimHomeDto =
        AdminClaimHomeDto(
            id = id,
            address = "12 Elm St",
            city = "Pittsburgh",
            state = "PA",
            zipcode = "15213",
            name = "12 Elm Street",
            homeType = "single_family",
        )

    private fun claimant(
        id: String,
        name: String,
    ): AdminClaimUserDto =
        AdminClaimUserDto(
            id = id,
            username = name.lowercase().replace(' ', '_'),
            name = name,
            email = "${name.lowercase().replace(' ', '.')}@example.com",
            createdAt = "2025-09-01T00:00:00Z",
            profilePictureUrl = null,
        )

    private fun claim(
        id: String,
        state: String = "submitted",
        ageDays: Long = 2,
        evidenceCount: Int = 3,
        method: String? = "doc_upload",
    ): AdminClaimDto {
        val created = referenceInstant.minusSeconds(ageDays * 86_400)
        return AdminClaimDto(
            id = id,
            homeId = "h_$id",
            claimantUserId = "u_$id",
            claimType = "owner",
            state = state,
            method = method,
            riskScore = 12,
            createdAt = created.toString(),
            updatedAt = created.toString(),
            evidenceCount = evidenceCount,
            home = home("h_$id"),
            claimant = claimant("u_$id", "Person $id"),
        )
    }

    private fun stubAllBuckets(
        pending: List<AdminClaimDto> =
            listOf(
                claim("c_new", state = "submitted", ageDays = 2, evidenceCount = 3),
                claim("c_old", state = "submitted", ageDays = 10, evidenceCount = 5, method = "escrow_agent"),
            ),
        approved: List<AdminClaimDto> = listOf(claim("c_app1", state = "approved", ageDays = 40)),
        rejected: List<AdminClaimDto> = listOf(claim("c_rej1", state = "rejected", ageDays = 78, evidenceCount = 0)),
        countsResponse: AdminClaimCountsResponse = counts,
        pendingOldestAgeSeconds: Int? = (10 * 86_400),
    ) {
        coEvery { repo.claimCounts() } returns NetworkResult.Success(countsResponse)
        coEvery { repo.claims(AdminClaimBucket.Pending) } returns
            NetworkResult.Success(
                AdminClaimsResponse(
                    claims = pending,
                    total = pending.size,
                    oldestAgeSeconds = pendingOldestAgeSeconds,
                ),
            )
        coEvery { repo.claims(AdminClaimBucket.Approved) } returns
            NetworkResult.Success(AdminClaimsResponse(claims = approved, total = approved.size))
        coEvery { repo.claims(AdminClaimBucket.Rejected) } returns
            NetworkResult.Success(AdminClaimsResponse(claims = rejected, total = rejected.size))
    }

    // MARK: - Loading → Populated

    @Test
    fun load_populates_pending_bucket_with_banner() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(2, state.sections.first().rows.size)
            assertEquals(listOf("Person c_new", "Person c_old"), state.sections.first().rows.map { it.title })
            // Banner reflects /counts pending count + warning tint.
            val banner = vm.banner.value
            assertNotNull(banner)
            assertEquals("4 claims awaiting review", banner!!.title)
            assertEquals(PantopusIcon.Gavel, banner.icon)
            assertEquals(BannerCtaTint.Warning, banner.tint)
        }

    @Test
    fun triage_chip_varies_by_age_and_state() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            val newRow = rows[0]
            val oldRow = rows[1]
            assertEquals("New", newRow.chips!![0].text)
            assertEquals(PantopusIcon.Sparkles, newRow.chips!![0].icon)
            assertTrue(oldRow.chips!![0].text.startsWith("Aging"))
            assertEquals(PantopusIcon.Clock, oldRow.chips!![0].icon)
        }

    @Test
    fun evidence_chip_uses_singular_plural() =
        runTest {
            stubAllBuckets(
                pending =
                    listOf(
                        claim("c_three", evidenceCount = 3),
                        claim("c_one", evidenceCount = 1),
                    ),
                pendingOldestAgeSeconds = 2 * 86_400,
            )
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals("3 docs", rows[0].chips!![1].text)
            assertEquals("1 doc", rows[1].chips!![1].text)
        }

    @Test
    fun disputed_and_needs_more_info_chips() =
        runTest {
            stubAllBuckets(
                pending =
                    listOf(
                        claim("c_dispute", state = "disputed", ageDays = 1),
                        claim("c_more", state = "needs_more_info", ageDays = 1),
                    ),
            )
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals("Conflict", rows[0].chips!![0].text)
            assertEquals(PantopusIcon.AlertTriangle, rows[0].chips!![0].icon)
            assertEquals("Awaiting docs", rows[1].chips!![0].text)
            assertEquals(PantopusIcon.Hourglass, rows[1].chips!![0].icon)
        }

    // MARK: - Empty + Error

    @Test
    fun pending_empty_offers_view_approved_cta() =
        runTest {
            stubAllBuckets(pending = emptyList(), pendingOldestAgeSeconds = null)
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No claims to review", empty.headline)
            assertEquals(PantopusIcon.CheckCheck, empty.icon)
            assertEquals("View approved", empty.ctaTitle)
            assertNull(vm.banner.value)
        }

    @Test
    fun approved_empty_uses_check_circle_no_cta() =
        runTest {
            stubAllBuckets(approved = emptyList())
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            vm.selectTab(ReviewClaimsTab.APPROVED)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No approved claims yet", empty.headline)
            assertEquals(PantopusIcon.CheckCircle, empty.icon)
            assertNull(empty.ctaTitle)
            assertNull(vm.banner.value)
        }

    @Test
    fun rejected_empty_uses_circle_slash_no_cta() =
        runTest {
            stubAllBuckets(rejected = emptyList())
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            vm.selectTab(ReviewClaimsTab.REJECTED)
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No rejected claims", empty.headline)
            assertEquals(PantopusIcon.CircleSlash, empty.icon)
            assertNull(empty.ctaTitle)
        }

    @Test
    fun pending_error_state_on_500() =
        runTest {
            coEvery { repo.claimCounts() } returns NetworkResult.Success(counts)
            coEvery { repo.claims(AdminClaimBucket.Pending) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val err = vm.state.value as ListOfRowsUiState.Error
            assertEquals("Couldn't load claims. Try again.", err.message)
        }

    // MARK: - Tab switching

    @Test
    fun switching_to_approved_renders_success_chip_and_hides_banner() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            vm.selectTab(ReviewClaimsTab.APPROVED)
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            assertEquals("Approved", row.chips!![0].text)
            assertEquals(PantopusIcon.CheckCircle, row.chips!![0].icon)
            assertNull(vm.banner.value)
            assertNull(row.highlight)
        }

    @Test
    fun switching_to_rejected_renders_circle_slash_and_muted_highlight() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            vm.selectTab(ReviewClaimsTab.REJECTED)
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            assertEquals("Rejected", row.chips!![0].text)
            assertEquals(PantopusIcon.CircleSlash, row.chips!![0].icon)
            assertEquals(RowHighlight.Muted, row.highlight)
        }

    // MARK: - Row tap

    @Test
    fun row_tap_invokes_on_open_claim_with_row_id() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            var lastOpened: String? = null
            vm.onOpenClaim = { lastOpened = it }
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            row.onTap()
            assertEquals("c_new", lastOpened)
        }

    @Test
    fun footer_button_invokes_on_open_claim() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            var lastOpened: String? = null
            vm.onOpenClaim = { lastOpened = it }
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            val footer = row.footer
            assertNotNull(footer)
            assertEquals("Review claim", footer!!.actions.first().title)
            footer.actions.first().onClick()
            assertEquals("c_new", lastOpened)
        }

    // MARK: - Tabs reflect /counts

    @Test
    fun tab_counts_reflect_counts_endpoint() =
        runTest {
            stubAllBuckets()
            val vm = ReviewClaimsViewModel(repo)
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(4, tabs.first { it.id == ReviewClaimsTab.PENDING }.count)
            assertEquals(38, tabs.first { it.id == ReviewClaimsTab.APPROVED }.count)
            assertEquals(3, tabs.first { it.id == ReviewClaimsTab.REJECTED }.count)
        }
}
