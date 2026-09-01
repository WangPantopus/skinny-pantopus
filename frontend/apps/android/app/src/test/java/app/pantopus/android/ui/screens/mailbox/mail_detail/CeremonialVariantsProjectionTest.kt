@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.MailDetailResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.mailbox.MailboxDocumentRepository
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageDeliveryStatus
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
 * A17.5–A17.8 — Projection tests for the four new ceremonial variants.
 * Mirrors iOS `CeremonialVariantsProjectionTests`: drives the static
 * projection with hand-rolled `mail.object` payloads and asserts the
 * per-variant DTO is decoded into [MailDetailContent].
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CeremonialVariantsProjectionTest {
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

    private fun makeVm(): MailDetailViewModel =
        MailDetailViewModel(
            repo = repo,
            vaultRepo = vaultRepo,
            gigsRepo = gigsRepo,
            packageRepo = packageRepo,
            documentRepo = documentRepo,
            savedStateHandle = SavedStateHandle(mapOf(MAIL_DETAIL_MAIL_ID_KEY to "m1")),
        )

    private fun makeDetail(
        category: MailItemCategory,
        objectPayload: Map<String, Any?>? = null,
        ackRequired: Boolean? = null,
        ackStatus: String? = null,
    ): MailDetail =
        MailDetail(
            id = "m1",
            type = category.raw,
            mailType = category.raw,
            displayTitle = "Title",
            previewText = "Preview",
            subject = null,
            content = null,
            senderBusinessName = "Sender",
            senderAddress = null,
            ackRequired = ackRequired,
            ackStatus = ackStatus,
            attachments = null,
            expiresAt = null,
            createdAt = "2026-05-15T12:00:00Z",
            sender = MailDetail.Sender(id = "u1", username = "user", name = "Sender"),
            `object` = objectPayload,
            contentFormat = "plain_text",
            links = emptyList(),
        )

    // ─── Coupon ───────────────────────────────────────────────

    @Test
    fun coupon_projection_decodes_headline() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Coupon,
                                objectPayload =
                                    mapOf(
                                        "headline" to "25% OFF",
                                        "code" to "BRASS25",
                                        "merchant" to "Brass Owl Bakery",
                                        "expires_at" to "2026-06-30",
                                    ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is MailDetailUiState.Loaded)
            val content = (state as MailDetailUiState.Loaded).content
            assertEquals(MailItemCategory.Coupon, content.category)
            assertNotNull(content.couponDetail)
            assertEquals("25% OFF", content.couponDetail?.headline)
            assertEquals("BRASS25", content.couponDetail?.code)
            assertNull(content.gigDetail)
            assertNull(content.memoryDetail)
            assertNull(content.packageDetail)
        }

    @Test
    fun coupon_missing_headline_leaves_null() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Coupon,
                                objectPayload = mapOf("merchant" to "Brass Owl"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertNull(content.couponDetail)
        }

    // ─── Gig ──────────────────────────────────────────────────

    @Test
    fun gig_projection_decodes_bid_post_bidder() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Gig,
                                objectPayload =
                                    mapOf(
                                        "is_accepted" to false,
                                        "bidder" to mapOf("name" to "Marcus T.", "rating" to 4.9, "jobs" to 47),
                                        "bid" to mapOf("amount" to 65, "unit" to "flat", "eta" to "Saturday"),
                                        "post" to mapOf("title" to "Sofa move", "budget" to "\$40-80"),
                                        "other_bids" to
                                            listOf(
                                                mapOf("who" to "Devon R.", "amount" to 55, "rating" to 4.7, "jobs" to 18),
                                            ),
                                    ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertEquals(MailItemCategory.Gig, content.category)
            assertNotNull(content.gigDetail)
            assertEquals(65, content.gigDetail?.bid?.amount)
            assertEquals(1, content.gigDetail?.otherBids?.size)
            assertFalse(content.gigDetail?.isAccepted ?: true)
        }

    // ─── Memory ───────────────────────────────────────────────

    @Test
    fun memory_projection_decodes_keepsake() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Memory,
                                objectPayload =
                                    mapOf(
                                        "title" to "One year ago, you found Pepper.",
                                        "reference" to "MEM-0518",
                                        "is_saved" to false,
                                        "elf_fresh" to mapOf("headline" to "Surfaced", "summary" to "Anniversary."),
                                        "elf_saved" to mapOf("headline" to "Kept", "summary" to "Filed in Memories."),
                                        "vault" to
                                            mapOf(
                                                "trail" to
                                                    listOf(
                                                        mapOf("glyph" to "inbox", "label" to "Mailbox"),
                                                        mapOf("glyph" to "heart", "label" to "Memories"),
                                                    ),
                                                "stats" to listOf(mapOf("value" to "12", "label" to "Items")),
                                            ),
                                    ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertEquals(MailItemCategory.Memory, content.category)
            assertNotNull(content.memoryDetail)
            assertEquals("One year ago, you found Pepper.", content.memoryDetail?.title)
            assertFalse(content.memoryDetail?.isSaved ?: true)
        }

    @Test
    fun memory_missing_presentation_blocks_leaves_null() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Memory,
                                objectPayload = mapOf("title" to "no elf/vault"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertNull(content.memoryDetail)
        }

    // ─── Package ──────────────────────────────────────────────

    @Test
    fun package_projection_decodes_carrier_and_tracking() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Package,
                                objectPayload =
                                    mapOf(
                                        "carrier" to "USPS Priority Mail",
                                        "tracking_number" to "9505 5125",
                                        "status" to "out_for_delivery",
                                        "eta_line" to "ETA 1-3 PM",
                                    ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertEquals(MailItemCategory.Package, content.category)
            assertNotNull(content.packageDetail)
            assertEquals("USPS Priority Mail", content.packageDetail?.carrier)
            assertEquals(PackageDeliveryStatus.OutForDelivery, content.packageDetail?.status)
            assertEquals("9505 5125", content.packageDetail?.trackingNumber)
            assertTrue((content.packageDetail?.trackingSteps?.size ?: 0) > 0)
        }

    @Test
    fun package_without_carrier_leaves_null() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Package,
                                objectPayload = mapOf("status" to "in_transit"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertNull(content.packageDetail)
        }

    // ─── Cross-category guards ────────────────────────────────

    @Test
    fun non_gig_category_never_decodes_gig() =
        runTest {
            coEvery { repo.detail("m1") } returns
                NetworkResult.Success(
                    MailDetailResponse(
                        mail =
                            makeDetail(
                                category = MailItemCategory.Notice,
                                objectPayload =
                                    mapOf(
                                        "bidder" to mapOf("name" to "Marcus"),
                                        "bid" to mapOf("amount" to 65),
                                        "post" to mapOf("title" to "Sofa"),
                                    ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MailDetailUiState.Loaded).content
            assertNull(content.gigDetail)
        }
}
