@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.bills

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.CreateBillRequest
import app.pantopus.android.data.api.models.homes.UpdateBillRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Step identifiers for the Add Bill wizard. */
enum class AddBillStep { Details, Schedule, Review, Success }

/** Recurrence options for step 2. */
enum class AddBillSchedule(
    val label: String,
    val detailsKey: String,
) {
    OneTime("One-time", "one_time"),
    Monthly("Recurring monthly", "monthly"),
    Quarterly("Recurring quarterly", "quarterly"),
    Yearly("Recurring yearly", "yearly"),
    ;

    companion object {
        /** Map a `details.schedule` (or `details.frequency`) value back
         *  to the enum so the wizard can re-hydrate in edit mode. */
        fun fromDetailsKey(raw: String?): AddBillSchedule =
            when (raw) {
                "monthly" -> Monthly
                "quarterly" -> Quarterly
                "yearly" -> Yearly
                else -> OneTime
            }
    }
}

/** Outbound events for the host to react to. */
sealed interface AddBillEvent {
    data object Dismiss : AddBillEvent

    data class Created(val billId: String) : AddBillEvent

    data class Updated(val billId: String) : AddBillEvent
}

/** Nav-arg key for the home id. */
const val ADD_BILL_HOME_ID_KEY = "homeId"

/** Nav-arg key for an optional existing bill id (edit mode). */
const val ADD_BILL_BILL_ID_KEY = "billId"

@HiltViewModel
class AddBillWizardViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        createAccess: (String, CoroutineScope) -> HomeFinanceAccess,
    ) : ViewModel(), WizardModel {
        @Inject
        constructor(repo: HomesRepository, savedStateHandle: SavedStateHandle, finance: HomeFinanceAccessFactory) :
            this(repo, savedStateHandle, finance::create)

        private val homeId: String =
            checkNotNull(savedStateHandle[ADD_BILL_HOME_ID_KEY]) {
                "AddBillWizardViewModel requires a $ADD_BILL_HOME_ID_KEY nav argument"
            }

        /** Optional nav arg: when present the wizard opens in edit mode,
         *  hydrates from the parent list, and PUTs on submit. */
        private val billId: String? = savedStateHandle[ADD_BILL_BILL_ID_KEY]

        private val finance = createAccess(homeId, viewModelScope)
        val financeRights = finance.rights
        private var generation = 0

        val isEditing: Boolean = billId != null

        // Step 1
        var payee: String by mutableStateOf("")
        var amount: String by mutableStateOf("")
        var dueDate: LocalDate? by mutableStateOf(null)

        // Step 2
        var schedule: AddBillSchedule by mutableStateOf(AddBillSchedule.OneTime)

        private val _currentStep = MutableStateFlow(AddBillStep.Details)
        val currentStep: StateFlow<AddBillStep> = _currentStep.asStateFlow()

        private val _isSubmitting = MutableStateFlow(false)
        val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

        private val _submitError = MutableStateFlow<String?>(null)
        val submitError: StateFlow<String?> = _submitError.asStateFlow()

        private val _isLoadingExisting = MutableStateFlow(isEditing)
        val isLoadingExisting: StateFlow<Boolean> = _isLoadingExisting.asStateFlow()

        private val _loadError = MutableStateFlow<String?>(null)
        val loadError: StateFlow<String?> = _loadError.asStateFlow()

        private val _events = MutableStateFlow<AddBillEvent?>(null)
        val events: StateFlow<AddBillEvent?> = _events.asStateFlow()

        private var createdBillId: String? = null

        /** Snapshot of the hydrated values. Used to detect dirtiness in
         *  edit mode so a clean re-open doesn't show the discard sheet. */
        private data class Snapshot(
            val payee: String,
            val amount: String,
            val dueDate: LocalDate?,
            val schedule: AddBillSchedule,
        )

        private var hydratedSnapshot: Snapshot? = null

        init {
            viewModelScope.launch {
                financeRights.collect { rights ->
                    if (rights.invalidated) {
                        generation++
                        clearDraft()
                        _isLoadingExisting.value = false
                        _loadError.value = FINANCE_SESSION_CHANGED
                        _submitError.value = FINANCE_SESSION_CHANGED
                    }
                }
            }
            viewModelScope.launch { load() }
        }

        private fun clearDraft() {
            payee = ""
            amount = ""
            dueDate = null
            schedule = AddBillSchedule.OneTime
            hydratedSnapshot = null
            createdBillId = null
            _events.value = null
            _isSubmitting.value = false
            _currentStep.value = AddBillStep.Details
        }

        /** Check access for create too; an edit hydrates only its exact Home/bill. */
        suspend fun load() {
            val revision = ++generation
            _isLoadingExisting.value = true
            _loadError.value = null
            try {
                finance.refresh(managing = true)
                billId?.let { loadExisting(it, revision) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: IllegalStateException) {
                if (revision == generation) {
                    if (!financeRights.value.canView) clearDraft()
                    _loadError.value = error.message ?: "Couldn't load this bill."
                }
            } finally {
                if (revision == generation) _isLoadingExisting.value = false
            }
        }

        private suspend fun loadExisting(
            id: String,
            revision: Int,
        ) {
            when (val result = repo.getHomeBills(homeId)) {
                is NetworkResult.Success -> {
                    finance.require(managing = true)
                    if (revision != generation) return
                    val bill = result.data.bills.singleOrNull { it.id == id && it.homeId == homeId }
                    checkNotNull(bill) { "This bill is no longer available." }
                    applyExisting(bill)
                }
                is NetworkResult.Failure -> error(result.error.message)
            }
        }

        private fun applyExisting(bill: BillDto) {
            payee = bill.providerName.orEmpty()
            amount = formatAmountForEditing(bill.displayAmount)
            dueDate = parseDueDate(bill.dueDate)
            // `details.schedule` is the canonical key the wizard writes
            // on create. Older rows may have only `details.frequency`.
            val scheduleKey = bill.details?.get("schedule") ?: bill.details?.get("frequency")
            schedule = AddBillSchedule.fromDetailsKey(scheduleKey)
            hydratedSnapshot =
                Snapshot(
                    payee = payee,
                    amount = amount,
                    dueDate = dueDate,
                    schedule = schedule,
                )
        }

        override val chrome: WizardChrome
            get() =
                when (_currentStep.value) {
                    AddBillStep.Details ->
                        WizardChrome(
                            title = if (isEditing) "Edit bill" else "Add a bill",
                            progressLabel = WizardProgressLabel.StepOf(current = 1, total = 3),
                            progressFraction = 1f / 3f,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Next",
                            primaryCtaEnabled = financeRights.value.canManage && detailsValid() && !_isLoadingExisting.value,
                            isSubmitting = false,
                            dirty = isDirty(),
                            showsProgressBar = true,
                        )
                    AddBillStep.Schedule ->
                        WizardChrome(
                            title = "Schedule",
                            progressLabel = WizardProgressLabel.StepOf(current = 2, total = 3),
                            progressFraction = 2f / 3f,
                            leading = WizardLeadingControl.Back,
                            primaryCtaLabel = "Next",
                            primaryCtaEnabled = financeRights.value.canManage,
                            isSubmitting = false,
                            dirty = isDirty(),
                            showsProgressBar = true,
                        )
                    AddBillStep.Review ->
                        WizardChrome(
                            title = "Review",
                            progressLabel = WizardProgressLabel.StepOf(current = 3, total = 3),
                            progressFraction = 1f,
                            leading = WizardLeadingControl.Back,
                            primaryCtaLabel = if (isEditing) "Save changes" else "Add bill",
                            primaryCtaEnabled = financeRights.value.canManage && !_isSubmitting.value,
                            isSubmitting = _isSubmitting.value,
                            dirty = isDirty(),
                            showsProgressBar = true,
                        )
                    AddBillStep.Success ->
                        WizardChrome(
                            title = if (isEditing) "Bill updated" else "Bill added",
                            progressLabel = WizardProgressLabel.Hidden,
                            progressFraction = null,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Done",
                            primaryCtaEnabled = financeRights.value.canManage,
                            isSubmitting = false,
                            dirty = false,
                            showsProgressBar = false,
                        )
                }

        override fun onLeading() {
            when (_currentStep.value) {
                AddBillStep.Details -> _events.value = AddBillEvent.Dismiss
                AddBillStep.Schedule -> _currentStep.value = AddBillStep.Details
                AddBillStep.Review -> _currentStep.value = AddBillStep.Schedule
                AddBillStep.Success -> _events.value = AddBillEvent.Dismiss
            }
        }

        override fun onDiscard() {
            _events.value = AddBillEvent.Dismiss
        }

        override fun onPrimary() {
            if (!financeRights.value.canManage || _isLoadingExisting.value || _isSubmitting.value) return
            when (_currentStep.value) {
                AddBillStep.Details -> {
                    _currentStep.value = AddBillStep.Schedule
                    Analytics.track(AnalyticsEvent.ScreenAddBillWizardStepViewed(2, "schedule"))
                }
                AddBillStep.Schedule -> {
                    _currentStep.value = AddBillStep.Review
                    Analytics.track(AnalyticsEvent.ScreenAddBillWizardStepViewed(3, "review"))
                }
                AddBillStep.Review -> submit()
                AddBillStep.Success -> {
                    val event =
                        when {
                            isEditing && billId != null -> AddBillEvent.Updated(billId)
                            createdBillId != null -> AddBillEvent.Created(createdBillId!!)
                            else -> AddBillEvent.Dismiss
                        }
                    viewModelScope.launch {
                        try {
                            finance.require(managing = true)
                            _events.value = event
                        } catch (error: CancellationException) {
                            throw error
                        } catch (_: Exception) {
                            // No success event for a replaced session.
                        }
                    }
                }
            }
        }

        suspend fun confirmEvent(event: AddBillEvent): Boolean =
            try {
                finance.require(managing = true)
                _events.value == event
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                false
            }

        fun consumeEvent() {
            _events.value = null
        }

        fun parsedAmount(): BigDecimal? {
            val trimmed = amount.trim()
            if (trimmed.isEmpty()) return null
            return trimmed.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }
        }

        fun detailsValid(): Boolean = payee.trim().isNotEmpty() && parsedAmount() != null

        fun isDirty(): Boolean {
            val snapshot = hydratedSnapshot
            return if (snapshot != null) {
                payee != snapshot.payee ||
                    amount != snapshot.amount ||
                    dueDate != snapshot.dueDate ||
                    schedule != snapshot.schedule
            } else {
                payee.trim().isNotEmpty() ||
                    amount.trim().isNotEmpty() ||
                    dueDate != null ||
                    schedule != AddBillSchedule.OneTime
            }
        }

        private fun submit() {
            val amountValue = parsedAmount() ?: return
            if (_isSubmitting.value || !financeRights.value.canManage) return
            val revision = ++generation
            val details = buildDetails(schedule)
            val trimmedPayee = payee.trim()
            val due = dueDate?.format(DateTimeFormatter.ISO_LOCAL_DATE)
            _isSubmitting.value = true
            _submitError.value = null
            viewModelScope.launch {
                try {
                    finance.refresh(managing = true)
                    if (revision != generation) return@launch
                    val result =
                        if (billId != null) {
                            repo.updateHomeBill(
                                homeId,
                                billId,
                                UpdateBillRequest(
                                    amount = amountValue,
                                    providerName = trimmedPayee,
                                    dueDate = due,
                                    details = details,
                                ),
                            )
                        } else {
                            repo.createHomeBill(
                                homeId,
                                CreateBillRequest(
                                    billType = "other",
                                    providerName = trimmedPayee,
                                    amount = amountValue,
                                    dueDate = due,
                                    details = details,
                                ),
                            )
                        }
                    finance.require(managing = true)
                    if (revision != generation) return@launch
                    when (result) {
                        is NetworkResult.Success -> {
                            applySaved(result.data.bill)
                        }
                        is NetworkResult.Failure -> error(result.error.message)
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: IllegalStateException) {
                    if (revision == generation) {
                        _submitError.value = error.message ?: "Couldn't save this bill."
                        _loadError.value = _submitError.value
                        Analytics.track(AnalyticsEvent.CtaAddBillSubmit(AnalyticsResult.ERROR))
                    }
                } finally {
                    if (revision == generation) _isSubmitting.value = false
                }
            }
        }

        private fun applySaved(bill: BillDto) {
            check(bill.homeId == homeId && bill.id.isNotBlank() && (billId == null || bill.id == billId)) {
                "Bill change could not be verified."
            }
            if (billId == null) createdBillId = bill.id
            _currentStep.value = AddBillStep.Success
            Analytics.track(AnalyticsEvent.CtaAddBillSubmit(AnalyticsResult.SUCCESS))
        }

        private fun buildDetails(schedule: AddBillSchedule): Map<String, String> =
            buildMap {
                put("schedule", schedule.detailsKey)
                if (schedule != AddBillSchedule.OneTime) {
                    put("frequency", schedule.detailsKey)
                }
            }

        private fun formatAmountForEditing(value: BigDecimal): String {
            val stripped = value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros()
            // `toPlainString` avoids scientific notation from
            // `stripTrailingZeros` on values like `100`.
            return stripped.toPlainString()
        }

        private fun parseDueDate(iso: String?): LocalDate? {
            if (iso.isNullOrBlank()) return null
            // Accept bare yyyy-MM-dd first since that's what the wizard
            // writes; fall back to the leading 10 chars of a full ISO
            // timestamp so older rows still hydrate.
            return runCatching { LocalDate.parse(iso) }
                .recoverCatching { LocalDate.parse(iso.take(10)) }
                .getOrNull()
        }
    }
