@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.businesses

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessPermission
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A check this quick shows nothing, so an owner sees no flicker on Save or on coming back to the app. */
private const val SLOW_ACCESS_CHECK_MILLIS = 400L

/** Nav-arg key of the routes [BusinessAccessGate] guards. */
private const val BUSINESS_ACCESS_GATE_ID_KEY = "businessId"

/** Items need `catalog.edit`; archiving and categories need `catalog.manage`. Either one opens the catalog manager. */
val BusinessAccessDto.canManageCatalog: Boolean
    get() = allows(BusinessPermission.CATALOG_EDIT) || allows(BusinessPermission.CATALOG_MANAGE)

/** A save replaces the whole week, so the week has to be readable before it can be edited. */
val BusinessAccessDto.canEditHours: Boolean
    get() = allows(BusinessPermission.HOURS_EDIT) && allows(BusinessPermission.HOURS_VIEW)

/** Each section of the page editor has its own permission. Any one of them opens it, with the rest read-only. */
val BusinessAccessDto.canUsePageEditor: Boolean
    get() = allows(BusinessPermission.PROFILE_EDIT) || allows(BusinessPermission.LOCATIONS_EDIT) || canEditHours

/** The payout account is the owner's: `requirePrimaryOwner` in `backend/routes/businesses.js` refuses everyone else. */
val BusinessAccessDto.canOpenPayments: Boolean get() = hasAccess && isOwner

/** Invoices follow the server's `profile.edit` gate for creating and voiding them. */
val BusinessAccessDto.canOpenInvoices: Boolean get() = allows(BusinessPermission.PROFILE_EDIT)

/** The legal record is behind `sensitive.view` on the server. */
val BusinessAccessDto.canOpenLegal: Boolean get() = allows(BusinessPermission.SENSITIVE_VIEW)

/** What the business last answered about the signed-in person, for one visit to a screen. Only [Known] allows anything. */
sealed interface BusinessAccessState {
    /** Nothing is known: no read yet, or the app went away and the last answer no longer counts. */
    data object Unknown : BusinessAccessState

    /** A read is running. */
    data object Checking : BusinessAccessState

    data class Known(val access: BusinessAccessDto) : BusinessAccessState

    /** `GET /:businessId/me` refused: this person isn't on the business's team. */
    data object Refused : BusinessAccessState

    /** The read failed, so nothing is known until a retry answers. */
    data object Failed : BusinessAccessState
}

/**
 * The signed-in person's current authority in one business, from `GET /:businessId/me`. Screens call [confirm] on
 * arrival and before anything they send, and [forget] when they leave or the app goes away. A reply that [forget]
 * overtook changes nothing, so a late answer can't restore access a newer one took away.
 */
class BusinessAccessCheck(
    private val scope: CoroutineScope,
    private val read: suspend () -> NetworkResult<BusinessAccessDto>,
    private val onChange: (BusinessAccessState) -> Unit,
) {
    private var generation = 0
    private var running: Deferred<BusinessAccessState>? = null

    /** What was known no longer counts, and a reply still on its way is ignored. */
    fun forget() {
        generation++
        running = null
        onChange(BusinessAccessState.Unknown)
    }

    /**
     * Asks now and returns the answer, joining a read that is already running.
     * [BusinessAccessState.Unknown] means [forget] overtook this read.
     */
    suspend fun confirm(): BusinessAccessState = (running?.takeIf { it.isActive } ?: start()).await()

    private fun start(): Deferred<BusinessAccessState> {
        val request = ++generation
        onChange(BusinessAccessState.Checking)
        return scope.async {
            val answer = answerFrom(read())
            if (request == generation) {
                onChange(answer)
                answer
            } else {
                BusinessAccessState.Unknown
            }
        }.also { running = it }
    }

    private fun answerFrom(result: NetworkResult<BusinessAccessDto>): BusinessAccessState =
        when (result) {
            is NetworkResult.Success ->
                if (result.data.hasAccess) BusinessAccessState.Known(result.data) else BusinessAccessState.Refused
            is NetworkResult.Failure ->
                if (result.error is NetworkError.Forbidden) BusinessAccessState.Refused else BusinessAccessState.Failed
        }
}

/** True once a check has run long enough for the person to notice; a screen treats that as no access yet. */
@Composable
internal fun rememberSlowAccessCheck(isChecking: Boolean): Boolean {
    var slow by remember { mutableStateOf(false) }
    LaunchedEffect(isChecking) {
        slow = false
        if (isChecking) {
            delay(SLOW_ACCESS_CHECK_MILLIS)
            slow = true
        }
    }
    return slow
}

/** The line above a screen's actions saying why editing is off, with a way to ask again. */
@Composable
internal fun BusinessAccessNotice(
    message: String,
    canRetry: Boolean,
    onRetry: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = message,
            style = TextStyle(fontSize = 12.5.sp),
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        TextButton(enabled = canRetry, onClick = onRetry, modifier = Modifier.heightIn(min = 44.dp)) {
            Text(
                text = "Retry access",
                style = TextStyle(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold),
                color = if (canRetry) PantopusColors.business else PantopusColors.appTextMuted,
            )
        }
    }
}

/** Holds [BusinessAccessGate]'s answer. Scoped to the guarded route, so it outlives a trip to the background. */
@HiltViewModel
class BusinessAccessGateViewModel
    @Inject
    constructor(
        team: BusinessTeamRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(BUSINESS_ACCESS_GATE_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessAccessState>(BusinessAccessState.Checking)
        val state: StateFlow<BusinessAccessState> = _state.asStateFlow()

        private val check =
            BusinessAccessCheck(viewModelScope, { team.access(businessId) }) { answer ->
                // The section stays open while a new answer is on its way, so its sheets and what it loaded survive
                // a trip to the background. The answer decides; the server refuses anything no longer allowed.
                if (answer !is BusinessAccessState.Unknown && answer !is BusinessAccessState.Checking) _state.value = answer
            }

        fun resume() {
            viewModelScope.launch { check.confirm() }
        }

        fun pause() {
            check.forget()
        }

        fun retry() {
            _state.value = BusinessAccessState.Checking
            resume()
        }
    }

/**
 * Opens an owner section only for someone the business says may use it, on every arrival and every return. The
 * dashboard hides these sections from everyone else, but a direct link or a permission revoked while the app was away
 * can still land here. A read that fails opens nothing. [content] gets the answer that opened it.
 */
@Composable
fun BusinessAccessGate(
    title: String,
    refusal: String,
    allows: (BusinessAccessDto) -> Boolean,
    onBack: () -> Unit,
    viewModel: BusinessAccessGateViewModel = hiltViewModel(),
    content: @Composable (BusinessAccessDto) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LifecycleResumeEffect(Unit) {
        viewModel.resume()
        onPauseOrDispose { viewModel.pause() }
    }
    val answer = state
    if (answer is BusinessAccessState.Known && allows(answer.access)) {
        content(answer.access)
        return
    }
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("businessAccessGate")) {
        ContentDetailTopBar(title = title, onBack = onBack)
        when (answer) {
            BusinessAccessState.Unknown, BusinessAccessState.Checking ->
                Column(
                    modifier = Modifier.fillMaxWidth().padding(Spacing.s4).testTag("businessAccessGate.loading"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    repeat(3) { Shimmer(width = 328.dp, height = 66.dp, cornerRadius = Radii.lg) }
                }
            BusinessAccessState.Failed ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't check your access",
                    subcopy = "Check your connection and try again.",
                    ctaTitle = "Try again",
                    onCta = viewModel::retry,
                    tint = PantopusColors.businessBg,
                    accent = PantopusColors.business,
                    modifier = Modifier.testTag("businessAccessGate.failed"),
                )
            else ->
                EmptyState(
                    icon = PantopusIcon.Lock,
                    headline = "You don't have access",
                    subcopy = refusal,
                    ctaTitle = "Try again",
                    onCta = viewModel::retry,
                    tint = PantopusColors.businessBg,
                    accent = PantopusColors.business,
                    modifier = Modifier.testTag("businessAccessGate.refused"),
                )
        }
    }
}
