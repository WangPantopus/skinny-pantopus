@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomePrivacyDto
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePrivacyRepository
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

/** Nav key carrying the home id into the per-home Security stack. */
const val HOME_SECURITY_HOME_ID_KEY = "homeId"

/**
 * P5.1 / A14.2 — Per-home Security toggles. Pure switchgear: 3
 * groups × 3 toggles = 9 toggles total. Helper-line copy under each
 * card mirrors the design's state-aware rule — calm default copy
 * when only the headline toggle is on, all-on consequence copy when
 * every toggle in the group is on, and an "off" warning when the
 * headline toggle is flipped off.
 *
 * P3F wiring: [load] reads the persisted toggle set from
 * `GET /api/homes/:id/privacy`; each flip optimistically updates and
 * PATCHes the single key, rolling back on failure. The [Variant.Balanced]
 * seed is the in-flight / offline baseline (and the test/preview seam via
 * [setVariant]).
 *
 * Two variant frames cover the design parity audit:
 *   - [Variant.Balanced] 5 of 9 toggles on
 *   - [Variant.Strict]   all 9 on, helpers shift to consequence
 *                        language
 */
@HiltViewModel
class HomeSecurityViewModel
    @Inject
    constructor(
        private val repository: HomePrivacyRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        enum class Variant { Balanced, Strict }

        val title: String = "Security"

        val homeId: String =
            requireNotNull(savedStateHandle[HOME_SECURITY_HOME_ID_KEY]) {
                "HomeSecurityViewModel requires a '$HOME_SECURITY_HOME_ID_KEY' nav arg."
            }

        val footerCaption: String = "$footerHomeName · Last audit 2h ago"

        private val _toggles: MutableMap<String, Boolean> = HomeSecurityToggles.seed(Variant.Balanced).toMutableMap()
        val toggles: Map<String, Boolean> get() = _toggles

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        fun load() {
            // Render the seeded baseline immediately, then reconcile from
            // the backend. A failed fetch keeps the baseline (settings
            // tolerate offline) rather than erroring the whole screen.
            _state.value = GroupedListUiState.Loaded(groups())
            viewModelScope.launch {
                when (val result = repository.getPrivacy(homeId)) {
                    is NetworkResult.Success -> {
                        applyServer(result.data.privacy)
                        _state.value = GroupedListUiState.Loaded(groups())
                    }
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        /** Test / preview seam: swap the underlying toggle seed. */
        fun setVariant(variant: Variant) {
            _toggles.clear()
            _toggles.putAll(HomeSecurityToggles.seed(variant))
            _state.value = GroupedListUiState.Loaded(groups())
        }

        fun onToggle(
            rowId: String,
            isOn: Boolean,
        ) {
            if (!_toggles.containsKey(rowId)) return
            val previous = _toggles[rowId] ?: return
            // Optimistic flip.
            _toggles[rowId] = isOn
            _state.value = GroupedListUiState.Loaded(groups())
            viewModelScope.launch {
                val result = repository.updatePrivacy(homeId, requestFor(rowId, isOn))
                if (result is NetworkResult.Failure) {
                    // Roll back the single key.
                    _toggles[rowId] = previous
                    _state.value = GroupedListUiState.Loaded(groups())
                }
            }
        }

        private fun applyServer(dto: HomePrivacyDto) {
            _toggles[HomeSecurityToggles.GUEST_APPROVAL] = dto.guestApproval
            _toggles[HomeSecurityToggles.MEMBER_NAME_VISIBILITY] = dto.memberNameVisibility
            _toggles[HomeSecurityToggles.ADDRESS_PRECISION] = dto.addressPrecision
            _toggles[HomeSecurityToggles.ACTIVITY_VISIBILITY] = dto.activityVisibility
            _toggles[HomeSecurityToggles.MAP_OPT_OUT] = dto.mapOptOut
            _toggles[HomeSecurityToggles.NOTIFICATION_PREVIEWS] = dto.notificationPreviews
            _toggles[HomeSecurityToggles.DOC_LOCK] = dto.docLock
            _toggles[HomeSecurityToggles.PHOTO_BLUR] = dto.photoBlur
            _toggles[HomeSecurityToggles.VAULT_AUTO_LOCK] = dto.vaultAutoLock
        }

        private fun requestFor(
            rowId: String,
            isOn: Boolean,
        ): UpdateHomePrivacyRequest =
            when (rowId) {
                HomeSecurityToggles.GUEST_APPROVAL -> UpdateHomePrivacyRequest(guestApproval = isOn)
                HomeSecurityToggles.MEMBER_NAME_VISIBILITY -> UpdateHomePrivacyRequest(memberNameVisibility = isOn)
                HomeSecurityToggles.ADDRESS_PRECISION -> UpdateHomePrivacyRequest(addressPrecision = isOn)
                HomeSecurityToggles.ACTIVITY_VISIBILITY -> UpdateHomePrivacyRequest(activityVisibility = isOn)
                HomeSecurityToggles.MAP_OPT_OUT -> UpdateHomePrivacyRequest(mapOptOut = isOn)
                HomeSecurityToggles.NOTIFICATION_PREVIEWS -> UpdateHomePrivacyRequest(notificationPreviews = isOn)
                HomeSecurityToggles.DOC_LOCK -> UpdateHomePrivacyRequest(docLock = isOn)
                HomeSecurityToggles.PHOTO_BLUR -> UpdateHomePrivacyRequest(photoBlur = isOn)
                HomeSecurityToggles.VAULT_AUTO_LOCK -> UpdateHomePrivacyRequest(vaultAutoLock = isOn)
                else -> UpdateHomePrivacyRequest()
            }

        private val footerHomeName: String get() = "14 Elm Park Lane"

        // Group projection — mirror of iOS `HomeSecurityViewModel.groups()`.

        private fun groups(): List<GroupedListGroup> =
            listOf(
                accessControlGroup(),
                privacyGroup(),
                documentsGroup(),
            )

        private fun accessControlGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "accessControl",
                overline = "Access control",
                helper = HomeSecurityHelpers.forAccessControl(_toggles),
                rows =
                    listOf(
                        toggleRow(HomeSecurityToggles.GUEST_APPROVAL, "Guest approval", "Ask before letting in new passes"),
                        toggleRow(
                            HomeSecurityToggles.MEMBER_NAME_VISIBILITY,
                            "Member name visibility",
                            "Show only your home name to outsiders",
                        ),
                        toggleRow(
                            HomeSecurityToggles.ADDRESS_PRECISION,
                            "Address precision",
                            "Street only · hide unit number",
                        ),
                    ),
            )

        private fun privacyGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "privacy",
                overline = "Privacy",
                helper = HomeSecurityHelpers.forPrivacy(_toggles),
                rows =
                    listOf(
                        toggleRow(
                            HomeSecurityToggles.ACTIVITY_VISIBILITY,
                            "Activity visibility",
                            "Show check-ins to verified neighbors",
                        ),
                        toggleRow(HomeSecurityToggles.MAP_OPT_OUT, "Map opt-out", "Hide from the neighborhood map"),
                        toggleRow(
                            HomeSecurityToggles.NOTIFICATION_PREVIEWS,
                            "Notification previews",
                            "Suppress preview text on the lock screen",
                        ),
                    ),
            )

        private fun documentsGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "documents",
                overline = "Documents",
                helper = HomeSecurityHelpers.forDocuments(_toggles),
                rows =
                    listOf(
                        toggleRow(HomeSecurityToggles.DOC_LOCK, "Doc lock", "Require unlock to view household docs"),
                        toggleRow(HomeSecurityToggles.PHOTO_BLUR, "Photo blur", "Blur doc thumbnails until tapped"),
                        toggleRow(HomeSecurityToggles.VAULT_AUTO_LOCK, "Vault auto-lock", "Lock the vault after 5 minutes idle"),
                    ),
            )

        private fun toggleRow(
            id: String,
            label: String,
            subtext: String,
        ): GroupedListRow =
            GroupedListRow(
                id = id,
                label = label,
                subtext = subtext,
                control = RowControl.Toggle(_toggles[id] ?: false),
            )
    }

/** Toggle row ids — kept in lockstep with the iOS `Toggles` enum. */
object HomeSecurityToggles {
    const val GUEST_APPROVAL = "guestApproval"
    const val MEMBER_NAME_VISIBILITY = "memberNameVisibility"
    const val ADDRESS_PRECISION = "addressPrecision"
    const val ACTIVITY_VISIBILITY = "activityVisibility"
    const val MAP_OPT_OUT = "mapOptOut"
    const val NOTIFICATION_PREVIEWS = "notificationPreviews"
    const val DOC_LOCK = "docLock"
    const val PHOTO_BLUR = "photoBlur"
    const val VAULT_AUTO_LOCK = "vaultAutoLock"

    fun seed(variant: HomeSecurityViewModel.Variant): Map<String, Boolean> =
        when (variant) {
            HomeSecurityViewModel.Variant.Balanced ->
                // 5 of 9 on — matches the audit's "balanced setup" frame.
                mapOf(
                    GUEST_APPROVAL to true,
                    MEMBER_NAME_VISIBILITY to true,
                    ADDRESS_PRECISION to false,
                    ACTIVITY_VISIBILITY to true,
                    MAP_OPT_OUT to false,
                    NOTIFICATION_PREVIEWS to true,
                    DOC_LOCK to true,
                    PHOTO_BLUR to false,
                    VAULT_AUTO_LOCK to false,
                )
            HomeSecurityViewModel.Variant.Strict ->
                // All 9 on — matches the audit's "strict lockdown" frame.
                listOf(
                    GUEST_APPROVAL,
                    MEMBER_NAME_VISIBILITY,
                    ADDRESS_PRECISION,
                    ACTIVITY_VISIBILITY,
                    MAP_OPT_OUT,
                    NOTIFICATION_PREVIEWS,
                    DOC_LOCK,
                    PHOTO_BLUR,
                    VAULT_AUTO_LOCK,
                ).associateWith { true }
        }
}

/**
 * Helper-line copy. The strings here MUST stay in sync with the
 * iOS [HomeSecurityViewModel] helpers so that iOS+Android parity
 * holds.
 */
object HomeSecurityHelpers {
    fun forAccessControl(toggles: Map<String, Boolean>): String {
        val approval = toggles[HomeSecurityToggles.GUEST_APPROVAL] ?: false
        val allOn =
            (toggles[HomeSecurityToggles.GUEST_APPROVAL] ?: false) &&
                (toggles[HomeSecurityToggles.MEMBER_NAME_VISIBILITY] ?: false) &&
                (toggles[HomeSecurityToggles.ADDRESS_PRECISION] ?: false)
        return when {
            allOn -> "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
            approval -> "Guest approval is on, so guests need an owner-tap to enter."
            else -> "Guest approval is off — anyone with a code is in. Tighten this if you're away."
        }
    }

    fun forPrivacy(toggles: Map<String, Boolean>): String {
        val activity = toggles[HomeSecurityToggles.ACTIVITY_VISIBILITY] ?: false
        val allOn =
            (toggles[HomeSecurityToggles.ACTIVITY_VISIBILITY] ?: false) &&
                (toggles[HomeSecurityToggles.MAP_OPT_OUT] ?: false) &&
                (toggles[HomeSecurityToggles.NOTIFICATION_PREVIEWS] ?: false)
        return when {
            allOn -> "Hidden from the neighborhood map, previews suppressed. Outsiders only see your home name."
            activity -> "Visible to verified neighbors only. Address used for deliveries."
            else -> "Activity is hidden — even verified neighbors can't see your check-ins."
        }
    }

    fun forDocuments(toggles: Map<String, Boolean>): String {
        val lock = toggles[HomeSecurityToggles.DOC_LOCK] ?: false
        val allOn =
            (toggles[HomeSecurityToggles.DOC_LOCK] ?: false) &&
                (toggles[HomeSecurityToggles.PHOTO_BLUR] ?: false) &&
                (toggles[HomeSecurityToggles.VAULT_AUTO_LOCK] ?: false)
        return when {
            allOn -> "All docs require Face ID. Previews stay blurred everywhere, including notifications."
            lock -> "Docs unlock with Face ID. Previews still appear in chat."
            else -> "Docs open without unlock — anyone with your phone can read them."
        }
    }
}
