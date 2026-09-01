@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.settings.verification

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.identity.IdentityCenterRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P8 / T6.2c — Settings → Verification.
 *
 * Read-only status grid for Email · Phone · Home address · Photo ID.
 * Reads `user.verified` via `GET /api/identity-center`. Email row
 * offers a Resend CTA (`POST /api/users/resend-verification`).
 *
 * Phone / home rows hidden until those flows ship (WS5.2).
 */
@HiltViewModel
class VerificationCenterViewModel
    @Inject
    constructor(
        private val identity: IdentityCenterRepository,
        private val account: AccountRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        val title: String = "Verification"
        val footerCaption: String =
            "Verified neighbors can find you in search and reach you with confidence."

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private var emailVerified: Boolean = false
        private var emailAddress: String? = null
        private var isSendingVerification: Boolean = false
        private var resendStatus: ResendStatus = ResendStatus.Idle

        sealed interface ResendStatus {
            data object Idle : ResendStatus

            data object Sending : ResendStatus

            data object Sent : ResendStatus

            data class Failed(val message: String) : ResendStatus
        }

        fun load() {
            _state.value = GroupedListUiState.Loading
            val authState = auth.state.value
            if (authState is AuthRepository.State.SignedIn) {
                emailAddress = authState.user.email
            }
            viewModelScope.launch {
                when (val result = identity.overview()) {
                    is NetworkResult.Success -> emailVerified = result.data.privateAccount?.verified ?: false
                    is NetworkResult.Failure -> emailVerified = false
                }
                rebuild()
            }
        }

        fun onRow(rowId: String) {
            if (rowId != "email.resend") return
            val email = emailAddress ?: return
            if (isSendingVerification) return
            isSendingVerification = true
            resendStatus = ResendStatus.Sending
            rebuild()
            viewModelScope.launch {
                when (account.resendVerification(email)) {
                    is NetworkResult.Success -> resendStatus = ResendStatus.Sent
                    is NetworkResult.Failure ->
                        resendStatus = ResendStatus.Failed("Couldn't send the verification email.")
                }
                isSendingVerification = false
                rebuild()
            }
        }

        private fun rebuild() {
            val emailControl =
                if (emailVerified) {
                    RowControl.ChipStatus("Verified", RowControl.ChipTone.Success, includesChevron = false)
                } else {
                    RowControl.ChipStatus("Unverified", RowControl.ChipTone.Warning, includesChevron = false)
                }
            val emailRow =
                GroupedListRow(
                    id = "email.status",
                    label = "Email",
                    subtext = emailAddress,
                    control = emailControl,
                )
            val resendLabel =
                when (resendStatus) {
                    is ResendStatus.Idle -> "Resend verification email"
                    is ResendStatus.Sending -> "Sending…"
                    is ResendStatus.Sent -> "Sent — check your inbox"
                    is ResendStatus.Failed -> "Try again"
                }
            val resendSubtext = (resendStatus as? ResendStatus.Failed)?.message
            val emailGroup =
                if (emailVerified) {
                    GroupedListGroup(id = "email", overline = "Email", rows = listOf(emailRow))
                } else {
                    val resendRow =
                        GroupedListRow(
                            id = "email.resend",
                            label = resendLabel,
                            subtext = resendSubtext,
                            control = RowControl.Chevron,
                        )
                    GroupedListGroup(
                        id = "email",
                        overline = "Email",
                        helper = "Verify your email to unlock posting and trust signals.",
                        rows = listOf(emailRow, resendRow),
                    )
                }
            val idGroup =
                GroupedListGroup(
                    id = "photoid",
                    overline = "Photo ID",
                    rows =
                        listOf(
                            GroupedListRow(
                                id = "photoid.status",
                                label = "Government-issued ID",
                                subtext = "Used by business listings only",
                                control =
                                    RowControl.ChipStatus(
                                        "Optional",
                                        RowControl.ChipTone.Neutral,
                                        includesChevron = false,
                                    ),
                            ),
                        ),
                )
            _state.value =
                GroupedListUiState.Loaded(
                    groups = listOf(emailGroup, idGroup),
                )
        }
    }
