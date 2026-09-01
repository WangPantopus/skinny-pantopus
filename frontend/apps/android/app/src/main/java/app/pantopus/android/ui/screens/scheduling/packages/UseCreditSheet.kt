@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Apply-credit sheet (G11 sub) UI state. */
sealed interface UseCreditUiState {
    data object Loading : UseCreditUiState

    data object Empty : UseCreditUiState

    data class Error(val message: String) : UseCreditUiState

    data class Loaded(val bookings: List<BookingDto>) : UseCreditUiState
}

/**
 * Stream A15 — local sheet hung off My Packages (G11). Lists the buyer's
 * eligible upcoming bookings (`GET /my-bookings`) and applies a package credit
 * to one (`POST /bookings/:id/apply-credit`), honestly handling the
 * `ALREADY_APPLIED` / `CREDIT_NOT_APPLICABLE` 409 guards. No route/stub —
 * presented locally from My Packages. Mirrors iOS `UseCreditViewModel`.
 */
@HiltViewModel
class UseCreditViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow<UseCreditUiState>(UseCreditUiState.Loading)
        val state: StateFlow<UseCreditUiState> = _state.asStateFlow()

        private val _applyingId = MutableStateFlow<String?>(null)
        val applyingId: StateFlow<String?> = _applyingId.asStateFlow()

        private val _conflict = MutableStateFlow<String?>(null)
        val conflict: StateFlow<String?> = _conflict.asStateFlow()

        private var credit: PackageCreditDto? = null
        private var loadedFor: String? = null

        /** Load eligible bookings for [credit] (idempotent per credit id). */
        fun load(credit: PackageCreditDto) {
            if (loadedFor == credit.id && _state.value !is UseCreditUiState.Error) {
                this.credit = credit
                return
            }
            loadedFor = credit.id
            this.credit = credit
            _conflict.value = null
            viewModelScope.launch {
                _state.value = UseCreditUiState.Loading
                when (val result = repo.getMyBookings()) {
                    is NetworkResult.Success -> {
                        val eligible = result.data.bookings.filter(::isEligible)
                        _state.value =
                            if (eligible.isEmpty()) {
                                UseCreditUiState.Empty
                            } else {
                                UseCreditUiState.Loaded(
                                    eligible,
                                )
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = UseCreditUiState.Error(errors.decode(result.error).message())
                }
            }
        }

        fun apply(
            booking: BookingDto,
            onApplied: () -> Unit,
        ) {
            val current = credit ?: return
            _conflict.value = null
            _applyingId.value = booking.id
            viewModelScope.launch {
                when (
                    val result =
                        repo.applyCredit(
                            SchedulingOwner.Personal,
                            booking.id,
                            current.id,
                        )
                ) {
                    is NetworkResult.Success -> {
                        _applyingId.value = null
                        onApplied()
                    }
                    is NetworkResult.Failure -> {
                        _applyingId.value = null
                        _conflict.value = conflictMessage(errors.decode(result.error))
                    }
                }
            }
        }

        /** Upcoming, uncredited, unpaid bookings matching the credit's event type. */
        private fun isEligible(booking: BookingDto): Boolean {
            val status = booking.status
            if (status != "pending" && status != "confirmed") return false
            if (booking.packageCreditId != null || booking.paymentId != null) return false
            val creditEventType = credit?.bookingPackage?.eventTypeId
            if (creditEventType != null && booking.eventTypeId != creditEventType) return false
            val startMs = PackagesFormat.epochMillis(booking.startAt)
            if (startMs != null && startMs < System.currentTimeMillis()) return false
            return true
        }

        fun dateLabel(booking: BookingDto): String = PackagesFormat.dateTimeString(booking.startAt) ?: "Upcoming"

        private fun conflictMessage(error: SchedulingError): String =
            when {
                error is SchedulingError.Generic && error.code == "ALREADY_APPLIED" ->
                    "A credit is already applied to that booking."
                error is SchedulingError.Generic && error.code == "CREDIT_NOT_APPLICABLE" ->
                    "This credit can't be used on that booking."
                error is SchedulingError.Generic -> error.message
                else -> "Couldn't apply the credit. Try another booking."
            }

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> "Couldn't load your bookings."
            }
    }

/**
 * Bottom-sheet content for applying a package credit to an upcoming booking.
 * Presented from [MyPackagesScreen] inside a `ModalBottomSheet`.
 */
@Composable
fun UseCreditSheet(
    credit: PackageCreditDto,
    onApplied: () -> Unit,
    onDismiss: () -> Unit,
    viewModel: UseCreditViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val applyingId by viewModel.applyingId.collectAsStateWithLifecycle()
    val conflict by viewModel.conflict.collectAsStateWithLifecycle()

    LaunchedEffect(credit.id) { viewModel.load(credit) }

    Column(
        modifier =
            Modifier.fillMaxWidth().background(
                PantopusColors.appBg,
            ).testTag("scheduling.useCredit"),
    ) {
        Row(
            modifier =
                Modifier.fillMaxWidth().padding(
                    horizontal = Spacing.s4,
                ).padding(top = Spacing.s4, bottom = Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Use a credit",
                    color = PantopusColors.appText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Apply 1 credit to an upcoming booking",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Box(
                modifier =
                    Modifier.size(
                        32.dp,
                    ).clickable(onClickLabel = "Close", onClick = onDismiss),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Close",
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        when (val s = state) {
            is UseCreditUiState.Loading ->
                Column(
                    modifier = Modifier.padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    repeat(
                        3,
                    ) {
                        Shimmer(
                            modifier = Modifier.fillMaxWidth(),
                            height = 56.dp,
                            cornerRadius = Radii.lg,
                        )
                    }
                }
            is UseCreditUiState.Empty ->
                EmptyState(
                    icon = PantopusIcon.Calendar,
                    headline = "No eligible bookings",
                    subcopy = "You can apply this credit to an upcoming, unpaid booking for this service.",
                    tint = PantopusColors.appSurfaceSunken,
                    accent = PantopusColors.appTextSecondary,
                    modifier = Modifier.fillMaxWidth().padding(top = Spacing.s8),
                )
            is UseCreditUiState.Error ->
                ErrorState(
                    message = s.message,
                    onRetry = { viewModel.load(credit) },
                )
            is UseCreditUiState.Loaded ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(max = 480.dp)
                            .verticalScroll(rememberScrollState())
                            .padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    conflict?.let {
                        PkgNote(
                            tone = PkgNoteTone.Warning,
                            icon = PantopusIcon.Info,
                            text = it,
                        )
                    }
                    s.bookings.forEach { booking ->
                        BookingRow(
                            label = viewModel.dateLabel(booking),
                            status = booking.status,
                            applying = applyingId == booking.id,
                            enabled = applyingId == null,
                            onClick = { viewModel.apply(booking) { onApplied() } },
                        )
                    }
                    Box(modifier = Modifier.height(Spacing.s6))
                }
        }
    }
}

@Composable
private fun BookingRow(
    label: String,
    status: String?,
    applying: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier.size(
                    36.dp,
                ).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            PkgChip(
                text = (status ?: "pending").replaceFirstChar { it.uppercase() },
                tone = if (status == "confirmed") PkgChipTone.Success else PkgChipTone.Warning,
                uppercased = true,
            )
        }
        if (applying) {
            CircularProgressIndicator(
                color = PantopusColors.primary600,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}
