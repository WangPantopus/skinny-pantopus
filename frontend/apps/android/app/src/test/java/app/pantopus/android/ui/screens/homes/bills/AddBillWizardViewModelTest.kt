@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.bills

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.CreateBillRequest
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.HomeBillResponse
import app.pantopus.android.data.api.models.homes.UpdateBillRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
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
import java.math.BigDecimal
import java.time.LocalDate

/**
 * P3.2 — covers `AddBillWizardViewModel` in both Add and Edit modes:
 *  - initial pose (no billId ⇒ create chrome; billId ⇒ load + hydrate)
 *  - chrome contract (titles, CTA labels, dirty + loading gates)
 *  - schedule round-trip via `details.schedule` / `details.frequency`
 *  - submit happy path (POST in Add, PUT in Edit) with payload
 *    assertions
 *  - submit error surfacing
 *  - 404-on-load surfacing (`loadError`)
 *  - isDirty gating (Edit gates on snapshot diff; Add gates on any
 *    value)
 *  - amount round-trip from `BigDecimal` → text field → wire body
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AddBillWizardViewModelTest {
    private val repo: HomesRepository = mockk(relaxed = false)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeBill(
        id: String = "bill-1",
        provider: String? = "ConEd Electric",
        amount: BigDecimal = BigDecimal("142.80"),
        dueDate: String? = "2026-06-01",
        details: Map<String, String>? = mapOf("schedule" to "monthly", "frequency" to "monthly"),
    ): BillDto =
        BillDto(
            id = id,
            homeId = "home-1",
            billType = "other",
            providerName = provider,
            amount = amount,
            dueDate = dueDate,
            status = "pending",
            details = details,
        )

    private fun makeVm(billId: String? = null): AddBillWizardViewModel {
        val saved =
            SavedStateHandle(
                buildMap {
                    put(ADD_BILL_HOME_ID_KEY, "home-1")
                    if (billId != null) put(ADD_BILL_BILL_ID_KEY, billId)
                },
            )
        return AddBillWizardViewModel(repo = repo, savedStateHandle = saved)
    }

    // MARK: - Initial pose

    @Test
    fun addMode_initialPoseHasOneTimeAndEmptyFields() =
        runTest {
            val vm = makeVm()
            assertFalse(vm.isEditing)
            assertEquals(AddBillSchedule.OneTime, vm.schedule)
            assertEquals("", vm.payee)
            assertEquals("", vm.amount)
            assertNull(vm.dueDate)
            assertFalse(vm.detailsValid())
            assertFalse(vm.isDirty())
            assertFalse(vm.isLoadingExisting.value)
        }

    @Test
    fun editMode_initialPoseRunsLoadAndClearsLoadingFlag() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = emptyList()))
            val vm = makeVm(billId = "bill-1")
            assertTrue(vm.isEditing)
            // Auto-load fires in `init { … }`; the UnconfinedTestDispatcher
            // resolves the resulting coroutine synchronously, so by the
            // time the VM constructor returns the flag has fallen back
            // to `false`.
            assertFalse(vm.isLoadingExisting.value)
            // And the empty-result path surfaces a load error.
            assertNotNull(vm.loadError.value)
        }

    // MARK: - Chrome contract

    @Test
    fun chrome_addModeUsesAddTitlesAndCTAs() {
        val vm = makeVm()
        assertEquals("Add a bill", vm.chrome.title)
        vm.payee = "ConEd"
        vm.amount = "100"
        vm.onPrimary() // → schedule
        vm.onPrimary() // → review
        assertEquals("Add bill", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun chrome_editModeUsesEditTitlesAndSaveChangesCTA() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(makeBill())))
            val vm = makeVm(billId = "bill-1")
            assertEquals("Edit bill", vm.chrome.title)
            vm.onPrimary() // → schedule
            vm.onPrimary() // → review
            assertEquals("Save changes", vm.chrome.primaryCtaLabel)
        }

    // MARK: - Hydration

    @Test
    fun editMode_hydratesEveryFieldFromBackend() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(makeBill())))
            val vm = makeVm(billId = "bill-1")
            // Auto-load on init has already run under the unconfined
            // dispatcher.
            assertEquals("ConEd Electric", vm.payee)
            assertEquals("142.8", vm.amount)
            assertEquals(LocalDate.parse("2026-06-01"), vm.dueDate)
            assertEquals(AddBillSchedule.Monthly, vm.schedule)
            assertNull(vm.loadError.value)
            assertFalse(vm.isDirty())
            assertTrue(vm.detailsValid())
        }

    @Test
    fun editMode_hydratesScheduleFromLegacyFrequencyKey() =
        runTest {
            val legacy = makeBill(details = mapOf("frequency" to "quarterly"))
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(legacy)))
            val vm = makeVm(billId = "bill-1")
            assertEquals(AddBillSchedule.Quarterly, vm.schedule)
        }

    @Test
    fun editMode_missingBillSurfacesLoadError() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = emptyList()))
            val vm = makeVm(billId = "bill-1")
            assertEquals("This bill is no longer available.", vm.loadError.value)
        }

    @Test
    fun editMode_loadFailureSurfacesLoadError() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm(billId = "bill-1")
            assertNotNull(vm.loadError.value)
        }

    // MARK: - Submit

    @Test
    fun addMode_savePostsExpectedBody() =
        runTest {
            val request = slot<CreateBillRequest>()
            coEvery { repo.createHomeBill(any(), capture(request)) } returns
                NetworkResult.Success(HomeBillResponse(bill = makeBill(id = "bill-new")))
            val vm = makeVm()
            vm.payee = "Spectrum"
            vm.amount = "60.00"
            vm.schedule = AddBillSchedule.Monthly
            vm.dueDate = LocalDate.parse("2026-06-15")
            // Manually trigger submit by walking the wizard to review +
            // tapping primary.
            vm.onPrimary() // → schedule
            vm.onPrimary() // → review
            vm.onPrimary() // → submit

            coVerify { repo.createHomeBill("home-1", any()) }
            val captured = request.captured
            assertEquals("other", captured.billType)
            assertEquals("Spectrum", captured.providerName)
            assertEquals(BigDecimal("60.00"), captured.amount)
            assertEquals("2026-06-15", captured.dueDate)
            assertEquals("monthly", captured.details?.get("schedule"))
            assertEquals("monthly", captured.details?.get("frequency"))
            assertEquals(AddBillStep.Success, vm.currentStep.value)
        }

    @Test
    fun editMode_savePutsExpectedBody() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(makeBill())))
            val request = slot<UpdateBillRequest>()
            coEvery { repo.updateHomeBill(any(), any(), capture(request)) } returns
                NetworkResult.Success(HomeBillResponse(bill = makeBill(amount = BigDecimal("150.00"))))
            val vm = makeVm(billId = "bill-1")
            vm.amount = "150.00"
            vm.onPrimary() // → schedule
            vm.onPrimary() // → review
            vm.onPrimary() // → submit

            coVerify { repo.updateHomeBill("home-1", "bill-1", any()) }
            val captured = request.captured
            assertEquals(BigDecimal("150.00"), captured.amount)
            assertEquals("ConEd Electric", captured.providerName)
            assertEquals("2026-06-01", captured.dueDate)
            assertEquals("monthly", captured.details?.get("schedule"))
            // Status / paidAt are owned by the BillDetail mark-paid
            // path — the edit flow must not touch them.
            assertNull(captured.status)
            assertNull(captured.paidAt)
            assertEquals(AddBillStep.Success, vm.currentStep.value)
        }

    @Test
    fun editMode_successEmitsUpdatedEvent() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(makeBill())))
            coEvery { repo.updateHomeBill(any(), any(), any()) } returns
                NetworkResult.Success(HomeBillResponse(bill = makeBill()))
            val vm = makeVm(billId = "bill-1")
            vm.onPrimary() // → schedule
            vm.onPrimary() // → review
            vm.onPrimary() // → submit
            vm.onPrimary() // Done on success step

            assertEquals(AddBillEvent.Updated("bill-1"), vm.events.value)
        }

    @Test
    fun submit_errorSurfacesSubmitErrorAndKeepsReviewStep() =
        runTest {
            coEvery { repo.createHomeBill(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = makeVm()
            vm.payee = "ConEd"
            vm.amount = "100"
            vm.onPrimary() // → schedule
            vm.onPrimary() // → review
            vm.onPrimary() // → submit
            assertEquals(AddBillStep.Review, vm.currentStep.value)
            assertNotNull(vm.submitError.value)
        }

    // MARK: - Dirty gating

    @Test
    fun editMode_isDirtyFalseUntilFieldChanges() =
        runTest {
            coEvery { repo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(GetHomeBillsResponse(bills = listOf(makeBill())))
            val vm = makeVm(billId = "bill-1")
            assertFalse(vm.isDirty())
            vm.amount = "200.00"
            assertTrue(vm.isDirty())
        }

    @Test
    fun addMode_isDirtyTrueOnceAnyFieldFilled() {
        val vm = makeVm()
        assertFalse(vm.isDirty())
        vm.payee = "ConEd"
        assertTrue(vm.isDirty())
    }
}
