@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.bills

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.BillSplitDto
import app.pantopus.android.data.api.models.homes.GetBillSplitsResponse
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeBillResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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
import retrofit2.Retrofit
import java.math.BigDecimal

@OptIn(ExperimentalCoroutinesApi::class)
class HomeFinanceAccessTest {
    private val repo = mockk<HomesRepository>()
    private var actor = HomeFinanceIdentity("user", "session", "https://api.example.invalid/")
    private var permissions = listOf("finance.view", "finance.manage")
    private val changes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    private val bill = BillDto("bill", "home", "other", "Power", BigDecimal("12"))
    private val saved get() = SavedStateHandle(mapOf("homeId" to "home", "billId" to "bill"))
    private val createAccess: (String, CoroutineScope) -> HomeFinanceAccess = { _, scope ->
        HomeFinanceAccess(
            scope,
            loadAccess = {
                NetworkResult.Success(
                    HomeAccessDto(hasAccess = true, isOwner = true, roleBase = "owner", permissions = permissions),
                )
            },
            identity = { actor },
            identityChanges = changes,
        )
    }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { repo.getHomeBills(any(), any()) } returns NetworkResult.Success(GetHomeBillsResponse(listOf(bill)))
        coEvery { repo.getHomeBillSplits(any(), any()) } returns NetworkResult.Success(GetBillSplitsResponse())
    }

    @After fun cleanup() {
        Dispatchers.resetMain()
    }

    @Test fun viewOnly_keepsListAndDetail_withoutCreateEditOrMutation() =
        runTest {
            permissions = listOf("finance.view")
            val list = BillsListViewModel(repo, saved, createAccess = createAccess)
            var opened = 0
            list.configureNavigation(onOpenBill = { opened++ }, onAddBill = { error("Read-only create") })
            list.load()
            val loaded = list.state.value as ListOfRowsUiState.Loaded
            loaded.sections.single().rows.single().onTap?.invoke()
            assertEquals(1, opened)
            assertNull(list.fab())
            val detail = BillDetailViewModel(repo, saved, createAccess)
            detail.load()
            assertTrue(detail.state.value is BillDetailUiState.Loaded)
            assertFalse(detail.financeRights.value.canManage)
            var edits = 0
            detail.edit { edits++ }
            assertEquals(0, edits)
            detail.markPaid()
            detail.remove()
            coVerify(exactly = 0) { repo.updateHomeBill(any(), any(), any()) }
            assertTrue(detail.state.value is BillDetailUiState.Loaded)
        }

    @Test fun viewOnly_emptyList_hasNoAddCTA() =
        runTest {
            permissions = listOf("finance.view")
            coEvery { repo.getHomeBills(any(), any()) } returns NetworkResult.Success(GetHomeBillsResponse())
            val vm = BillsListViewModel(repo, saved, createAccess = createAccess)
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertNull(empty.ctaTitle)
            assertNull(empty.onCta)
        }

    @Test fun ownerFlag_doesNotRestoreDeniedView_orSendBillReads() =
        runTest {
            permissions = listOf("finance.manage")
            val vm = BillDetailViewModel(repo, saved, createAccess)
            vm.load()
            assertTrue(vm.state.value is BillDetailUiState.Error)
            coVerify(exactly = 0) { repo.getHomeBills(any(), any()) }
            coVerify(exactly = 0) { repo.getHomeBillSplits(any(), any()) }
        }

    @Test fun revokedManage_isRefreshedBeforeWrite_andLeavesReadableBillOpen() =
        runTest {
            val vm = BillDetailViewModel(repo, saved, createAccess)
            vm.load()
            permissions = listOf("finance.view")
            var closed = 0
            vm.configureNavigation(onClose = { closed++ })
            vm.remove()
            assertFalse(vm.financeRights.value.canManage)
            assertTrue(vm.state.value is BillDetailUiState.Loaded)
            assertEquals(0, closed)
            coVerify(exactly = 0) { repo.updateHomeBill(any(), any(), any()) }
        }

    @Test fun exactSuccessfulRemoval_notifiesAndCloses_once() =
        runTest {
            coEvery { repo.updateHomeBill("home", "bill", any()) } returns
                NetworkResult.Success(HomeBillResponse(bill.copy(status = "cancelled")))
            val vm = BillDetailViewModel(repo, saved, createAccess)
            var closed = 0
            var changed = 0
            vm.configureNavigation(onChanged = { changed++ }, onClose = { closed++ })
            vm.load()
            vm.remove()
            assertEquals(1, changed)
            assertEquals(1, closed)
        }

    @Test fun failedOrWrongReceipt_cannotCloseOrAnnounceSuccess() =
        runTest {
            val responses =
                listOf(
                    NetworkResult.Failure(NetworkError.Forbidden),
                    NetworkResult.Success(HomeBillResponse(bill.copy(id = "foreign", status = "cancelled"))),
                    NetworkResult.Success(HomeBillResponse(bill.copy(homeId = "foreign", status = "cancelled"))),
                    NetworkResult.Success(HomeBillResponse(bill)),
                )
            for (response in responses) {
                coEvery { repo.updateHomeBill(any(), any(), any()) } returns response
                val vm = BillDetailViewModel(repo, saved, createAccess)
                var changed = 0
                var closed = 0
                vm.configureNavigation(onChanged = { changed++ }, onClose = { closed++ })
                vm.load()
                vm.remove()
                assertTrue((vm.state.value as BillDetailUiState.Loaded).saveError != null)
                assertEquals(0, changed)
                assertEquals(0, closed)
            }
        }

    @Test fun foreignHomeOrSplit_isNeverDisplayed() =
        runTest {
            val list = BillsListViewModel(repo, saved, createAccess = createAccess)
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(listOf(bill.copy(homeId = "foreign"))))
            list.load()
            assertTrue(list.state.value is ListOfRowsUiState.Error)
            coEvery { repo.getHomeBills(any(), any()) } returns NetworkResult.Success(GetHomeBillsResponse(listOf(bill)))
            coEvery { repo.getHomeBillSplits(any(), any()) } returns
                NetworkResult.Success(
                    GetBillSplitsResponse(
                        listOf(
                            BillSplitDto("split", "foreign", "user", BigDecimal.ONE),
                        ),
                    ),
                )
            val detail = BillDetailViewModel(repo, saved, createAccess)
            detail.load()
            assertTrue(detail.state.value is BillDetailUiState.Error)
        }

    @Test fun failedSplitRead_preservesBillAndExplicitError_thenRetryShowsActualSplits() =
        runTest {
            coEvery { repo.getHomeBillSplits(any(), any()) } returns NetworkResult.Failure(NetworkError.Server(503, null))
            val detail = BillDetailViewModel(repo, saved, createAccess)
            detail.load()
            val unavailable = detail.state.value as BillDetailUiState.Loaded
            assertEquals(bill, unavailable.bill)
            assertTrue(unavailable.splitError != null)
            assertTrue(unavailable.splits.isEmpty())
            val split = BillSplitDto("split", "bill", "user", BigDecimal("6"))
            coEvery { repo.getHomeBillSplits(any(), any()) } returns NetworkResult.Success(GetBillSplitsResponse(listOf(split)))
            detail.load()
            val retried = detail.state.value as BillDetailUiState.Loaded
            assertNull(retried.splitError)
            assertEquals(listOf(split), retried.splits)
        }

    @Test fun idleSessionChange_hidesLoadedListDetailAndDraft() =
        runTest {
            val list = BillsListViewModel(repo, saved, createAccess = createAccess)
            val detail = BillDetailViewModel(repo, saved, createAccess)
            val wizard = AddBillWizardViewModel(repo, saved, createAccess)
            list.load()
            detail.load()
            assertEquals("Power", wizard.payee)
            actor = actor.copy(session = "new-session")
            changes.emit(Unit)
            assertTrue(list.state.value is ListOfRowsUiState.Error)
            assertNull(list.banner.value)
            assertTrue(detail.state.value is BillDetailUiState.Error)
            assertEquals("", wizard.payee)
            assertFalse(wizard.chrome.primaryCtaEnabled)
        }

    @Test fun unusedOldScreen_cannotAdoptNewAccount_onFirstLoad() =
        runTest {
            val vm = BillsListViewModel(repo, saved, createAccess = createAccess)
            actor = actor.copy(userId = "new-user")
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            coVerify(exactly = 0) { repo.getHomeBills(any(), any()) }
        }

    @Test fun delayedListAfterApiChange_isDiscarded() =
        runTest {
            val response = CompletableDeferred<NetworkResult<GetHomeBillsResponse>>()
            coEvery { repo.getHomeBills(any(), any()) } coAnswers { response.await() }
            val vm = BillsListViewModel(repo, saved, createAccess = createAccess)
            vm.load()
            actor = actor.copy(apiOrigin = "https://different.example.invalid/")
            response.complete(NetworkResult.Success(GetHomeBillsResponse(listOf(bill))))
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
            assertNull(vm.fab())
        }

    @Test fun delayedMutationAfterLogout_cannotPublishOldSuccess() =
        runTest {
            val response = CompletableDeferred<NetworkResult<HomeBillResponse>>()
            coEvery { repo.updateHomeBill(any(), any(), any()) } coAnswers { response.await() }
            val vm = BillDetailViewModel(repo, saved, createAccess)
            var changed = 0
            var closed = 0
            vm.configureNavigation(onChanged = { changed++ }, onClose = { closed++ })
            vm.load()
            vm.remove()
            actor = actor.copy(session = "replacement")
            changes.emit(Unit)
            response.complete(NetworkResult.Success(HomeBillResponse(bill.copy(status = "cancelled"))))
            assertTrue(vm.state.value is BillDetailUiState.Error)
            assertEquals(0, changed)
            assertEquals(0, closed)
        }

    private fun review(wizard: AddBillWizardViewModel) {
        wizard.payee = "Power"
        wizard.amount = "12"
        wizard.onPrimary()
        wizard.onPrimary()
    }

    @Test fun createRefreshesManagePermission_beforePosting() =
        runTest {
            val wizard = AddBillWizardViewModel(repo, SavedStateHandle(mapOf("homeId" to "home")), createAccess)
            review(wizard)
            permissions = listOf("finance.view")
            wizard.onPrimary()
            assertEquals(AddBillStep.Review, wizard.currentStep.value)
            assertNull(wizard.events.value)
            assertFalse(wizard.chrome.primaryCtaEnabled)
            coVerify(exactly = 0) { repo.createHomeBill(any(), any()) }
        }

    @Test fun wrongCreateHome_isNotASuccessReceipt() =
        runTest {
            coEvery { repo.createHomeBill(any(), any()) } returns NetworkResult.Success(HomeBillResponse(bill.copy(homeId = "foreign")))
            val wizard = AddBillWizardViewModel(repo, SavedStateHandle(mapOf("homeId" to "home")), createAccess)
            review(wizard)
            wizard.onPrimary()
            assertEquals(AddBillStep.Review, wizard.currentStep.value)
            assertTrue(wizard.submitError.value != null)
            assertNull(wizard.events.value)
        }

    @Test fun validLegacySession_canReadAndManage_andDetectReplacement() =
        runTest {
            val tokens = mockk<TokenStorage>()
            val admin = mockk<HomeAdminRepository>()
            val tokenFlow = MutableStateFlow<String?>("legacy-token")
            every { tokens.accessTokenFlow } returns tokenFlow
            coEvery { tokens.sessionIdentity() } returns ("user" to null)
            coEvery { tokens.accessToken() } coAnswers { tokenFlow.value }
            coEvery { admin.myAccess("home") } returns NetworkResult.Success(HomeAccessDto(hasAccess = true, permissions = permissions))
            val factory = HomeFinanceAccessFactory(admin, tokens, Retrofit.Builder().baseUrl("https://injected.example.invalid/").build())
            val access = factory.create("home", backgroundScope)
            access.refresh(managing = true)
            assertTrue(access.rights.value.canView)
            assertTrue(access.rights.value.canManage)
            tokenFlow.value = "replacement-token"
            testScheduler.runCurrent()
            assertTrue(access.rights.value.invalidated)
        }
}
