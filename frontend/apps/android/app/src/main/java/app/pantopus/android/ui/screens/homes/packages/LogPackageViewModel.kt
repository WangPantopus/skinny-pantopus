@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.packages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.CreatePackageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the Log Package route. */
const val LOG_PACKAGE_HOME_ID_KEY = "homeId"

/** Mutable form state for the Log Package sheet. */
data class LogPackageFormState(
    val carrier: String = "",
    val trackingNumber: String = "",
    val description: String = "",
    val deliveryInstructions: String = "",
    val isSubmitting: Boolean = false,
    val submitError: String? = null,
) {
    /** Submit is enabled when any of the three identifying fields is
     *  non-blank — a totally-blank row is never useful. */
    val canSubmit: Boolean
        get() =
            carrier.isNotBlank() ||
                trackingNumber.isNotBlank() ||
                description.isNotBlank()
}

/** Outbound event from the Log Package VM — host listens and routes. */
sealed interface LogPackageEvent {
    data object Dismiss : LogPackageEvent

    data class Created(val packageId: String) : LogPackageEvent
}

/** ViewModel backing [LogPackageScreen]. */
@HiltViewModel
class LogPackageViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[LOG_PACKAGE_HOME_ID_KEY]) {
                "LogPackageViewModel requires a $LOG_PACKAGE_HOME_ID_KEY nav argument"
            }

        private val _form = MutableStateFlow(LogPackageFormState())
        val form: StateFlow<LogPackageFormState> = _form.asStateFlow()

        private val _event = MutableStateFlow<LogPackageEvent?>(null)
        val event: StateFlow<LogPackageEvent?> = _event.asStateFlow()

        fun updateCarrier(value: String) {
            _form.value = _form.value.copy(carrier = value)
        }

        fun updateTracking(value: String) {
            _form.value = _form.value.copy(trackingNumber = value)
        }

        fun updateDescription(value: String) {
            _form.value = _form.value.copy(description = value)
        }

        fun updateDrop(value: String) {
            _form.value = _form.value.copy(deliveryInstructions = value)
        }

        fun cancel() {
            _event.value = LogPackageEvent.Dismiss
        }

        fun consumeEvent() {
            _event.value = null
        }

        fun submit() {
            val current = _form.value
            if (!current.canSubmit || current.isSubmitting) return
            _form.value = current.copy(isSubmitting = true, submitError = null)
            viewModelScope.launch {
                val request =
                    CreatePackageRequest(
                        carrier = current.carrier.trim().takeIf { it.isNotEmpty() },
                        trackingNumber = current.trackingNumber.trim().takeIf { it.isNotEmpty() },
                        description = current.description.trim().takeIf { it.isNotEmpty() },
                        deliveryInstructions =
                            current.deliveryInstructions.trim().takeIf { it.isNotEmpty() },
                    )
                when (val result = repo.createHomePackage(homeId, request)) {
                    is NetworkResult.Success -> {
                        Analytics.track(AnalyticsEvent.CtaLogPackageSubmit(AnalyticsResult.SUCCESS))
                        _form.value = current.copy(isSubmitting = false)
                        _event.value = LogPackageEvent.Created(result.data.`package`.id)
                    }
                    is NetworkResult.Failure -> {
                        Analytics.track(AnalyticsEvent.CtaLogPackageSubmit(AnalyticsResult.ERROR))
                        _form.value =
                            current.copy(
                                isSubmitting = false,
                                submitError = result.error.message,
                            )
                    }
                }
            }
        }
    }
