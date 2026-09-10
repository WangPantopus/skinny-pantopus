@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.payments

import app.cash.turbine.test
import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto
import app.pantopus.android.data.api.models.payments.ConfirmAddCardResponse
import app.pantopus.android.data.api.models.payments.PaymentHistoryResponse
import app.pantopus.android.data.api.models.payments.PaymentMethodAckResponse
import app.pantopus.android.data.api.models.payments.PaymentMethodDto
import app.pantopus.android.data.api.models.payments.PaymentMethodsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.payments.PaymentHistoryRepository
import app.pantopus.android.data.payments.PaymentsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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

/** Process recreation and account isolation for the same SetupIntent recovery path. */
@OptIn(ExperimentalCoroutinesApi::class)
class PaymentSheetRecoveryViewModelTest {
    private lateinit var repository: PaymentsRepository
    private lateinit var historyRepository: PaymentHistoryRepository
    private lateinit var connectRepository: ConnectRepository
    private lateinit var pendingSetups: MemoryPendingCardSetupStore

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        pendingSetups = MemoryPendingCardSetupStore()
        repository = mockk(relaxed = true)
        historyRepository = mockk(relaxed = true)
        connectRepository = mockk(relaxed = true)
        coEvery { historyRepository.history(any(), any()) } returns
            NetworkResult.Success(PaymentHistoryResponse(transactions = emptyList(), total = 0))
        coEvery { connectRepository.accountStatus() } returns NetworkResult.Failure(NetworkError.NotFound)
        coEvery { repository.earnings() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
        coEvery { repository.spending() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm() = PaymentsViewModel(repository, historyRepository, connectRepository, pendingSetups)

    private fun sheetParams() =
        AddCardSheetParamsDto(
            "seti_saved_secret_test",
            "seti_saved",
            "requires_payment_method",
            "ek_test",
            "cus_test",
        )

    private fun savedReceipt() = ConfirmAddCardResponse(true, cardDto("pm_saved", "visa", "4242", true))

    private fun cardDto(
        id: String,
        brand: String,
        last4: String,
        isDefault: Boolean,
    ) = PaymentMethodDto(
        id = id,
        paymentMethodType = "card",
        cardBrand = brand,
        cardLast4 = last4,
        cardExpMonth = 3,
        cardExpYear = 2027,
        isDefault = isDefault,
    )

    @Test
    fun recovery_is_persisted_before_sdk_and_survives_view_model_recreation() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.addCardSheetParams("seti_saved") } returns NetworkResult.Success(sheetParams())
            val original = vm()
            original.events.test {
                original.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                assertEquals("seti_saved", pendingSetups.read("account_a"))
            }
            val recreated = vm()
            recreated.events.test {
                recreated.tapAddMethod()
                assertEquals("seti_saved", (awaitItem() as PaymentsEvent.PresentAddCardSheet).params.setupIntentId)
            }
            coVerify(exactly = 1) { repository.addCardSheetParams(null) }
            coVerify(exactly = 1) { repository.addCardSheetParams("seti_saved") }
        }

    @Test
    fun recovered_success_confirms_without_presenting_and_clears_recovery() =
        runTest {
            pendingSetups.save("account_a", "seti_saved")
            coEvery { repository.paymentMethods() } returns NetworkResult.Success(PaymentMethodsResponse(emptyList()))
            coEvery { repository.addCardSheetParams("seti_saved") } returns
                NetworkResult.Success(sheetParams().copy(setupStatus = "succeeded"))
            coEvery { repository.confirmAddCard("seti_saved") } returns NetworkResult.Success(savedReceipt())
            val recreated = vm()
            recreated.load()
            assertEquals(AddCardPhase.Retry, recreated.addCardPhase.value)
            recreated.events.test {
                recreated.tapAddMethod()
                expectNoEvents()
            }
            assertNull(pendingSetups.read("account_a"))
            assertEquals(AddCardPhase.Idle, recreated.addCardPhase.value)
            coVerify(exactly = 0) { repository.addCardSheetParams(null) }
        }

    @Test
    fun processing_rechecks_same_setup_without_sdk_or_confirmation() =
        runTest {
            pendingSetups.save("account_a", "seti_saved")
            coEvery { repository.addCardSheetParams("seti_saved") } returns
                NetworkResult.Success(sheetParams().copy(setupStatus = "processing"))
            val vm = vm()
            vm.events.test {
                repeat(2) {
                    vm.tapAddMethod()
                    assertTrue((awaitItem() as PaymentsEvent.ShowMessage).text.contains("still processing"))
                }
            }
            assertEquals(AddCardPhase.Retry, vm.addCardPhase.value)
            assertEquals("seti_saved", pendingSetups.read("account_a"))
            coVerify(exactly = 2) { repository.addCardSheetParams("seti_saved") }
            coVerify(exactly = 0) { repository.confirmAddCard(any()) }
        }

    @Test
    fun incomplete_confirmation_rechecks_same_setup_and_resumes_required_action() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.confirmAddCard("seti_saved") } returns NetworkResult.Failure(NetworkError.ClientError(409, "Incomplete"))
            coEvery { repository.addCardSheetParams("seti_saved") } returns
                NetworkResult.Success(sheetParams().copy(setupStatus = "requires_action"))
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                assertTrue(awaitItem() is PaymentsEvent.ShowMessage)
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
            }
            coVerify(exactly = 1) { repository.addCardSheetParams(null) }
            coVerify(exactly = 1) { repository.addCardSheetParams("seti_saved") }
            coVerify(exactly = 1) { repository.confirmAddCard("seti_saved") }
        }

    @Test
    fun terminal_recovery_not_found_clears_only_its_account_without_replacement() =
        runTest {
            pendingSetups.save("account_a", "seti_saved")
            pendingSetups.save("account_b", "seti_other")
            coEvery { repository.addCardSheetParams("seti_saved") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue((awaitItem() as PaymentsEvent.ShowMessage).text.contains("no longer available"))
            }
            assertNull(pendingSetups.read("account_a"))
            assertEquals("seti_other", pendingSetups.read("account_b"))
            assertEquals(AddCardPhase.Idle, vm.addCardPhase.value)
            coVerify(exactly = 0) { repository.addCardSheetParams(null) }
        }

    @Test
    fun terminal_confirmation_not_found_clears_recovery() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.confirmAddCard("seti_saved") } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                assertTrue((awaitItem() as PaymentsEvent.ShowMessage).text.contains("no longer available"))
            }
            assertNull(pendingSetups.read("account_a"))
            assertEquals(AddCardPhase.Idle, vm.addCardPhase.value)
        }

    @Test
    fun another_account_never_recovers_the_previous_accounts_setup() =
        runTest {
            pendingSetups.save("account_a", "seti_saved")
            pendingSetups.accountId = "account_b"
            coEvery { repository.addCardSheetParams(null) } returns NetworkResult.Success(sheetParams().copy(setupIntentId = "seti_other"))
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertEquals("seti_other", (awaitItem() as PaymentsEvent.PresentAddCardSheet).params.setupIntentId)
            }
            assertEquals("seti_saved", pendingSetups.read("account_a"))
            assertEquals("seti_other", pendingSetups.read("account_b"))
            coVerify(exactly = 0) { repository.addCardSheetParams("seti_saved") }
        }

    @Test
    fun account_switch_during_preparation_drops_presentation_and_does_not_save_for_new_account() =
        runTest {
            val response = CompletableDeferred<NetworkResult<AddCardSheetParamsDto>>()
            coEvery { repository.addCardSheetParams() } coAnswers { response.await() }
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                pendingSetups.accountId = "account_b"
                response.complete(NetworkResult.Success(sheetParams()))
                expectNoEvents()
            }
            assertNull(pendingSetups.read("account_b"))
            assertEquals(AddCardPhase.Idle, vm.addCardPhase.value)
        }

    @Test
    fun queued_sdk_event_and_callback_are_rejected_after_account_switch() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            val vm = vm()
            vm.tapAddMethod()
            pendingSetups.accountId = "account_b"
            vm.events.test {
                val params = (awaitItem() as PaymentsEvent.PresentAddCardSheet).params
                assertFalse(vm.canPresentAddCardSheet(params))
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                expectNoEvents()
            }
            assertEquals("seti_saved", pendingSetups.read("account_a"))
            assertNull(pendingSetups.read("account_b"))
            coVerify(exactly = 0) { repository.confirmAddCard(any()) }
        }

    @Test
    fun storage_failure_prevents_sdk_and_retry_keeps_same_in_memory_identifier() =
        runTest {
            pendingSetups.acceptsWrites = false
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.addCardSheetParams("seti_saved") } returns NetworkResult.Success(sheetParams())
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue((awaitItem() as PaymentsEvent.ShowMessage).text.contains("recovery"))
                pendingSetups.acceptsWrites = true
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
            }
            assertEquals("seti_saved", pendingSetups.read("account_a"))
            coVerify(exactly = 1) { repository.addCardSheetParams(null) }
            coVerify(exactly = 1) { repository.addCardSheetParams("seti_saved") }
        }

    @Test
    fun fresh_methods_list_removes_a_card_deleted_after_confirmation() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.confirmAddCard(any()) } returns NetworkResult.Success(savedReceipt())
            coEvery { repository.paymentMethods() } returns NetworkResult.Success(PaymentMethodsResponse(emptyList()))
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                expectNoEvents()
            }
            assertTrue((vm.state.value as PaymentsUiState.Loaded).content.methods.isEmpty())
        }

    @Test
    fun fresh_methods_list_keeps_default_changed_on_another_device() =
        runTest {
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.confirmAddCard(any()) } returns NetworkResult.Success(savedReceipt())
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(
                    PaymentMethodsResponse(
                        listOf(
                            cardDto("pm_saved", "visa", "4242", false), cardDto("pm_newDefault", "visa", "1111", true),
                        ),
                    ),
                )
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                expectNoEvents()
            }
            assertEquals("pm_newDefault", (vm.state.value as PaymentsUiState.Loaded).content.methods.single { it.chip != null }.id)
        }

    @Test
    fun saving_blocks_remove_default_and_refresh_until_reconciliation_finishes() =
        runTest {
            coEvery {
                repository.paymentMethods()
            } returns NetworkResult.Success(PaymentMethodsResponse(listOf(cardDto("pm_old", "visa", "4242", true))))
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            val confirmation = CompletableDeferred<NetworkResult<ConfirmAddCardResponse>>()
            coEvery { repository.confirmAddCard(any()) } coAnswers { confirmation.await() }
            val vm = vm()
            vm.load()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.setDefault("pm_old")
                vm.removeMethod("pm_old")
                vm.refresh()
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                vm.setDefault("pm_old")
                vm.removeMethod("pm_old")
                vm.refresh()
                coVerify(exactly = 1) { repository.paymentMethods() }
                confirmation.complete(NetworkResult.Success(savedReceipt()))
                expectNoEvents()
            }
            coVerify(exactly = 0) { repository.setDefault(any()) }
            coVerify(exactly = 0) { repository.removeMethod(any()) }
        }

    @Test
    fun cleanup_write_failure_keeps_confirmed_recovery_until_retry_clears_it() =
        runTest {
            pendingSetups.acceptsClears = false
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            coEvery { repository.confirmAddCard("seti_saved") } returns NetworkResult.Success(savedReceipt())
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(PaymentMethodsResponse(listOf(savedReceipt().paymentMethod)))
            val vm = vm()
            vm.events.test {
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
                vm.onAddCardOutcome(AddCardOutcome.Completed)
                assertTrue((awaitItem() as PaymentsEvent.ShowMessage).text.contains("recovery cleanup"))
                assertEquals(AddCardPhase.Retry, vm.addCardPhase.value)
                assertEquals("seti_saved", pendingSetups.read("account_a"))
                assertEquals("pm_saved", (vm.state.value as PaymentsUiState.Loaded).content.methods.single().id)
                pendingSetups.acceptsClears = true
                vm.tapAddMethod()
                expectNoEvents()
            }
            assertNull(pendingSetups.read("account_a"))
            assertEquals(AddCardPhase.Idle, vm.addCardPhase.value)
            coVerify(exactly = 1) { repository.addCardSheetParams(null) }
            coVerify(exactly = 2) { repository.confirmAddCard("seti_saved") }
        }

    @Test
    fun active_refresh_blocks_add_and_list_mutations_until_read_finishes() =
        runTest {
            val refresh = CompletableDeferred<NetworkResult<PaymentMethodsResponse>>()
            coEvery { repository.paymentMethods() } returns NetworkResult.Success(PaymentMethodsResponse(emptyList()))
            coEvery { repository.addCardSheetParams() } returns NetworkResult.Success(sheetParams())
            val vm = vm()
            vm.load()
            coEvery { repository.paymentMethods() } coAnswers { refresh.await() }
            vm.events.test {
                vm.refresh()
                vm.tapAddMethod()
                vm.setDefault("pm_old")
                vm.removeMethod("pm_old")
                vm.load()
                expectNoEvents()
                assertTrue(vm.refreshing.value)
                coVerify(exactly = 0) { repository.addCardSheetParams(any()) }
                refresh.complete(NetworkResult.Success(PaymentMethodsResponse(emptyList())))
                vm.tapAddMethod()
                assertTrue(awaitItem() is PaymentsEvent.PresentAddCardSheet)
            }
            coVerify(exactly = 0) { repository.setDefault(any()) }
            coVerify(exactly = 0) { repository.removeMethod(any()) }
            coVerify(exactly = 2) { repository.paymentMethods() }
        }

    @Test
    fun account_switch_during_supplementary_load_drops_old_method_projection() =
        runTest {
            val history = CompletableDeferred<NetworkResult<PaymentHistoryResponse>>()
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(PaymentMethodsResponse(listOf(savedReceipt().paymentMethod)))
            coEvery { historyRepository.history(any(), any()) } coAnswers { history.await() }
            val vm = vm()
            vm.load()
            pendingSetups.accountId = "account_b"
            history.complete(NetworkResult.Success(PaymentHistoryResponse(transactions = emptyList(), total = 0)))
            assertTrue(vm.state.value is PaymentsUiState.Loading)
        }

    @Test
    fun default_failure_after_account_switch_does_not_restore_old_account_snapshot() =
        runTest {
            val response = CompletableDeferred<NetworkResult<PaymentMethodAckResponse>>()
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(
                    PaymentMethodsResponse(
                        listOf(
                            cardDto("pm_one", "visa", "1111", true), cardDto("pm_two", "visa", "2222", false),
                        ),
                    ),
                )
            coEvery { repository.setDefault("pm_two") } coAnswers { response.await() }
            val vm = vm()
            vm.load()
            vm.events.test {
                vm.setDefault("pm_two")
                val optimistic = vm.state.value
                pendingSetups.accountId = "account_b"
                response.complete(NetworkResult.Failure(NetworkError.Server(503, "retry")))
                expectNoEvents()
                assertEquals(optimistic, vm.state.value)
            }
        }

    @Test
    fun remove_success_after_account_switch_does_not_reload_for_new_account() =
        runTest {
            val response = CompletableDeferred<NetworkResult<PaymentMethodAckResponse>>()
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(PaymentMethodsResponse(listOf(savedReceipt().paymentMethod)))
            coEvery { repository.removeMethod("pm_saved") } coAnswers { response.await() }
            val vm = vm()
            vm.load()
            vm.removeMethod("pm_saved")
            pendingSetups.accountId = "account_b"
            response.complete(NetworkResult.Success(PaymentMethodAckResponse("removed")))
            coVerify(exactly = 1) { repository.paymentMethods() }
        }

    @Test
    fun account_switch_during_mutation_reload_drops_its_old_list() =
        runTest {
            val reload = CompletableDeferred<NetworkResult<PaymentMethodsResponse>>()
            coEvery { repository.paymentMethods() } returns
                NetworkResult.Success(PaymentMethodsResponse(listOf(savedReceipt().paymentMethod)))
            coEvery { repository.setDefault("pm_saved") } returns NetworkResult.Success(PaymentMethodAckResponse("saved"))
            val vm = vm()
            vm.load()
            coEvery { repository.paymentMethods() } coAnswers { reload.await() }
            vm.setDefault("pm_saved")
            val optimistic = vm.state.value
            pendingSetups.accountId = "account_b"
            reload.complete(NetworkResult.Success(PaymentMethodsResponse(emptyList())))
            assertEquals(optimistic, vm.state.value)
        }
}
