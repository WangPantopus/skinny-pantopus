@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomePrivacyDto
import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.UpdateHomePrivacyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomePrivacyRepository
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
        gates: HomeCopyGateFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        enum class Variant { Balanced, Strict }

        val title: String = "Privacy"

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
        private var isSaving = false

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates.create(homeId, listOf(StoreKeys.homePrivacy(homeId)))
        private var readGeneration = 0L

        /**
         * Screen entry and every return (Instant Screens): owners and household roles see the stored toggles at once,
         * and the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            saveError = null
            if (_state.value !is GroupedListUiState.Loaded && gate.showsCopy) repository.storedPrivacy(homeId)?.let(::show)
            read(force = false)
        }

        /** Retry: read now. */
        fun refresh() = read(force = true)

        override fun onCleared() {
            gate.leave()
        }

        private fun read(force: Boolean) {
            val generation = ++readGeneration
            if (_state.value !is GroupedListUiState.Loaded) _state.value = GroupedListUiState.Loading
            viewModelScope.launch {
                val fromCopy = gate.showsCopy && !force
                var stored = readPrivacy(force = !fromCopy)
                // Household access ended meanwhile: whatever came from a copy is read again now.
                if (fromCopy && !gate.showsCopy) stored = readPrivacy(force = true)
                if (generation != readGeneration) return@launch
                val data = stored.data
                when {
                    // A toggle still saving wins over a copy read meanwhile; the save keeps or rolls back its own row.
                    data != null && isSaving -> Unit
                    data != null -> show(data)
                    else -> {
                        val fallback = "Couldn't load this home's privacy settings. Try again."
                        _state.value = GroupedListUiState.Error(stored.failure?.displayMessage(fallback) ?: fallback)
                    }
                }
                _refreshNotice.value = RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
            }
        }

        private suspend fun readPrivacy(force: Boolean): Stored<HomePrivacyResponse> =
            coroutineScope {
                val recheck = async { gate.recheck(force) }
                val privacy = async { repository.getPrivacyStored(homeId, force) }
                recheck.await()
                privacy.await()
            }

        private fun show(response: HomePrivacyResponse) {
            applyServer(response.privacy)
            _state.value = GroupedListUiState.Loaded(groups())
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
            if (_state.value !is GroupedListUiState.Loaded || isSaving || !_toggles.containsKey(rowId)) return
            val previous = _toggles[rowId] ?: return
            saveError = null
            // Optimistic flip.
            _toggles[rowId] = isOn
            isSaving = true
            _state.value = GroupedListUiState.Loaded(groups())
            viewModelScope.launch {
                var failed = false
                try {
                    val result = repository.updatePrivacy(homeId, requestFor(rowId, isOn))
                    if (result is NetworkResult.Failure) {
                        // Roll back the single key.
                        failed = true
                        _toggles[rowId] = previous
                        saveError = "Your change wasn't saved. ${result.error.displayMessage("Please try again.")}"
                    }
                } finally {
                    isSaving = false
                    _state.value = GroupedListUiState.Loaded(groups())
                }
                // Reads that landed while saving were set aside: after a failed save, show the server's row, read now.
                if (failed) {
                    repository.getPrivacyStored(homeId, force = true).data?.let { applyServer(it.privacy) }
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
                toggleEnabled = !isSaving,
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
