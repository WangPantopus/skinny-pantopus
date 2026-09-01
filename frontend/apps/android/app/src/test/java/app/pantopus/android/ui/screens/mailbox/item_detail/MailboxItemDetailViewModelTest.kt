@file:Suppress("MagicNumber", "LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.common.JsonValue
import app.pantopus.android.data.api.models.mailbox.v2.MailboxItemActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2Item
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2ItemResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageDetailResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageStatusUpdateResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.components.TimelineStepState
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

@OptIn(ExperimentalCoroutinesApi::class)
class MailboxItemDetailViewModelTest {
    private val repo: MailboxRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): MailboxItemDetailViewModel {
        val networkMonitor =
            io.mockk
                .mockk<app.pantopus.android.data.network.NetworkMonitor>(relaxed = true)
                .also { io.mockk.every { it.isOnline } returns kotlinx.coroutines.flow.MutableStateFlow(true) }
        return MailboxItemDetailViewModel(
            repo = repo,
            networkMonitor = networkMonitor,
            savedStateHandle = SavedStateHandle(mapOf(MAILBOX_ITEM_DETAIL_MAIL_ID_KEY to "m1")),
        )
    }

    private fun packageItem(type: String = "package"): MailboxV2ItemResponse =
        MailboxV2ItemResponse(
            mail =
                MailboxV2Item(
                    id = "m1",
                    type = type,
                    createdAt = "2026-04-19T10:00:00Z",
                    displayTitle = "Parcel",
                    previewText = null,
                    sender = null,
                    senderDisplay = "Acme Labs",
                    senderTrust = "verified_business",
                    `package` = null,
                    packageInfo = null,
                    packageTimeline = emptyList(),
                    objectPayload = null,
                ),
        )

    private fun packageDetail(status: String = "in_transit"): PackageDetailResponse {
        val map: JsonValue =
            mapOf(
                "tracking_number" to "1Z999",
                "carrier" to "UPS",
                "status" to status,
                "suggested_order_match" to "Amazon",
            )
        return PackageDetailResponse(
            `package` = map,
            timeline = emptyList(),
            sender = PackageDetailResponse.Sender(display = "Acme Labs", trust = "verified_business"),
        )
    }

    @Test fun package_happy_path() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem())
            coEvery { repo.packageDetail("m1") } returns NetworkResult.Success(packageDetail())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Package, loaded.content.category)
            assertEquals(MailTrust.Verified, loaded.content.trust)
            assertNull(loaded.content.aiElf)
            assertEquals("UPS", loaded.content.packageInfo?.carrier)
            assertEquals(PackageDeliveryStatus.InTransit, loaded.content.packageInfo?.status)
            assertTrue(loaded.content.packageInfo?.handoffSteps?.isNotEmpty() == true)
            assertEquals(4, loaded.content.timeline.size)
            assertFalse(loaded.content.ctaEnabled)
        }

    @Test fun non_package_falls_back_to_base() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem(type = "bill"))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Bill, loaded.content.category)
            assertNull(loaded.content.packageInfo)
        }

    @Test fun log_as_received_success_sets_completed() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem())
            coEvery { repo.packageDetail("m1") } returns NetworkResult.Success(packageDetail())
            coEvery { repo.packageStatusUpdate("m1", "delivered") } returns
                NetworkResult.Success(
                    PackageStatusUpdateResponse(
                        message = "ok",
                        status = "delivered",
                        previousStatus = "in_transit",
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.logAsReceived()
            assertTrue(vm.ctaFlags.value.primaryCompleted)
            assertFalse(vm.ctaFlags.value.primaryLoading)
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertFalse(loaded.content.ctaEnabled)
        }

    @Test fun log_as_received_rolls_back_on_error() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem())
            coEvery { repo.packageDetail("m1") } returns NetworkResult.Success(packageDetail())
            coEvery { repo.packageStatusUpdate("m1", "delivered") } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            val original =
                (vm.state.value as MailboxItemDetailUiState.Loaded).content.timeline.map { it.state }
            vm.logAsReceived()
            assertFalse(vm.ctaFlags.value.primaryCompleted)
            assertNotNull(vm.ctaFlags.value.errorToast)
            val rolled =
                (vm.state.value as MailboxItemDetailUiState.Loaded).content.timeline.map { it.state }
            assertEquals(original, rolled)
            assertFalse((vm.state.value as MailboxItemDetailUiState.Loaded).content.ctaEnabled)
        }

    @Test fun mark_not_mine_disables_ctas() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem())
            coEvery { repo.packageDetail("m1") } returns NetworkResult.Success(packageDetail())
            coEvery { repo.itemAction("m1", "not_mine") } returns
                NetworkResult.Success(MailboxItemActionResponse(message = "flagged", action = "not_mine"))
            val vm = makeVm()
            vm.load()
            vm.markNotMine()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertFalse(loaded.content.ctaEnabled)
            assertNull(vm.ctaFlags.value.errorToast)
        }

    @Test fun timeline_current_flips_to_done_optimistically() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(packageItem())
            coEvery { repo.packageDetail("m1") } returns NetworkResult.Success(packageDetail())
            coEvery { repo.packageStatusUpdate("m1", "delivered") } returns
                NetworkResult.Success(
                    PackageStatusUpdateResponse(message = "ok", status = "delivered", previousStatus = "in_transit"),
                )
            val vm = makeVm()
            vm.load()
            vm.logAsReceived()
            val steps = (vm.state.value as MailboxItemDetailUiState.Loaded).content.timeline
            // "in_transit" (index 1) was Current → flipped to Done; index 2 becomes Current.
            assertEquals(TimelineStepState.Done, steps[1].state)
            assertEquals(TimelineStepState.Current, steps[2].state)
        }

    @Test fun accent_colors_cover_all_categories() {
        assertEquals(21, MailItemCategory.entries.size)
        MailItemCategory.entries.forEach {
            @Suppress("UNUSED_VARIABLE")
            val c = it.accent
        }
    }

    @Test fun trust_from_raw_covers_all_branches() {
        assertEquals(MailTrust.Verified, MailTrust.fromRaw("verified_gov"))
        assertEquals(MailTrust.Verified, MailTrust.fromRaw("verified_utility"))
        assertEquals(MailTrust.Verified, MailTrust.fromRaw("verified_business"))
        assertEquals(MailTrust.Chain, MailTrust.fromRaw("pantopus_user"))
        assertEquals(MailTrust.Partial, MailTrust.fromRaw("partial"))
        assertEquals(MailTrust.Unverified, MailTrust.fromRaw(null))
        assertEquals(MailTrust.Unverified, MailTrust.fromRaw("whatever"))
    }

    @Test fun category_from_raw_defaults_to_general() {
        assertEquals(MailItemCategory.Package, MailItemCategory.fromRaw("PACKAGE"))
        assertEquals(MailItemCategory.General, MailItemCategory.fromRaw("unknown"))
        assertEquals(MailItemCategory.General, MailItemCategory.fromRaw(null))
    }
}
