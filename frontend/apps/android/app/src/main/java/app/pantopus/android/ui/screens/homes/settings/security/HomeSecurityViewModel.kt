@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomePrivacyDto
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
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
 * P5.1 / A14.2 — Per-home Security. Nine toggles are stored per Home, but
 * only address precision changes anything (the server drops the unit
 * number from Place), so it is the only one offered, and its helper line
 * says what it does. The other eight are read by nothing on the server or
 * any client; they're hidden and their stored values are left as they are.
 *
 * P3F wiring: [load] reads the persisted toggle set from
 * `GET /api/homes/:id/privacy`; each flip optimistically updates and
 * PATCHes the single key, rolling back on failure. The [Variant.Balanced]
 * seed is available only through the explicit test/preview seam [setVariant].
 *
 * Two seed frames (previews and tests):
 *   - [Variant.Balanced] 5 of 9 toggles on
 *   - [Variant.Strict]   all 9 on
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

        // No footer: it used to show a sample address ("14 Elm Park Lane") and a made-up "Last audit 2h ago" for
        // every Home.
        val footerCaption: String? = null

        private val _toggles: MutableMap<String, Boolean> = HomeSecurityToggles.seed(Variant.Balanced).toMutableMap()
        val toggles: Map<String, Boolean> get() = _toggles

        private var saveError: String? = null

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        fun load() {
            saveError = null
            _state.value = GroupedListUiState.Loading
            viewModelScope.launch {
                when (val result = repository.getPrivacy(homeId)) {
                    is NetworkResult.Success -> {
                        applyServer(result.data.privacy)
                        _state.value = GroupedListUiState.Loaded(groups())
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            GroupedListUiState.Error(
                                result.error.displayMessage("Couldn't load this home's privacy settings. Try again."),
                            )
                    }
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
            if (_state.value !is GroupedListUiState.Loaded || !_toggles.containsKey(rowId)) return
            val previous = _toggles[rowId] ?: return
            saveError = null
            // Optimistic flip.
            _toggles[rowId] = isOn
            _state.value = GroupedListUiState.Loaded(groups())
            viewModelScope.launch {
                val result = repository.updatePrivacy(homeId, requestFor(rowId, isOn))
                if (result is NetworkResult.Failure) {
                    // Roll back the single key.
                    _toggles[rowId] = previous
                    saveError = "Your change wasn't saved. ${result.error.displayMessage("Please try again.")}"
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

        // Group projection — mirror of iOS `HomeSecurityViewModel.groups()`.

        // Only the control something enforces is offered: address precision.
        private fun groups(): List<GroupedListGroup> = listOf(accessControlGroup())

        private fun accessControlGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "accessControl",
                overline = "Access control",
                helper = saveError ?: HomeSecurityHelpers.forAccessControl(_toggles),
                rows =
                    listOf(
                        toggleRow(
                            HomeSecurityToggles.ADDRESS_PRECISION,
                            "Address precision",
                            "Street only · hide unit number",
                        ),
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
    fun forAccessControl(toggles: Map<String, Boolean>): String =
        if (toggles[HomeSecurityToggles.ADDRESS_PRECISION] == true) {
            "Place shows this Home's street without the unit number."
        } else {
            "Place shows this Home's full street address, including the unit number."
        }
}
