@file:Suppress("CyclomaticComplexMethod", "LongMethod", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.settings.ownership_security

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityDto
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeOwnershipSecurityRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListBanner
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav key carrying the home id into the ownership-security stack. */
const val HOME_OWNERSHIP_SECURITY_HOME_ID_KEY = "homeId"

/**
 * A14.2 (policy variant) — "Ownership & Security". Three radio groups
 * backed by the per-home security policy:
 *
 *  - Privacy & discoverability -> `privacy_mask_level`
 *  - Owner claims              -> `owner_claim_policy`
 *  - Member attach policy      -> `member_attach_policy`
 *
 * Reads `GET /api/homes/:id/security` and PATCHes a single key per
 * selection. A multi-owner home answers the owner-claim-policy PATCH
 * with `{ pending: true, message }` instead of applying it — that
 * "change requires owner approval" state is surfaced as a banner rather
 * than being swallowed.
 *
 * Mirror of iOS `HomeOwnershipSecurityViewModel`; row ids, helper copy
 * and banner strings are a parity contract.
 */
@HiltViewModel
class HomeOwnershipSecurityViewModel
    @Inject
    constructor(
        private val repository: HomeOwnershipSecurityRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val title: String = "Ownership & Security"

        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        val homeId: String =
            requireNotNull(savedStateHandle[HOME_OWNERSHIP_SECURITY_HOME_ID_KEY]) {
                "HomeOwnershipSecurityViewModel requires a '$HOME_OWNERSHIP_SECURITY_HOME_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _banner = MutableStateFlow<GroupedListBanner?>(null)
        val banner: StateFlow<GroupedListBanner?> = _banner.asStateFlow()

        private val _footerCaption = MutableStateFlow<String?>(null)
        val footerCaption: StateFlow<String?> = _footerCaption.asStateFlow()

        /** Last loaded policy block. Null until the first successful fetch. */
        var policy: HomeOwnershipSecurityDto? = null
            private set

        private var isSaving = false
        private var saveError: String? = null
        private var lastTouchedGroupId: String? = null
        private var pendingApprovalMessage: String? = null

        fun load() {
            _state.value = GroupedListUiState.Loading
            saveError = null
            viewModelScope.launch {
                when (val result = repository.getSecurity(homeId)) {
                    is NetworkResult.Success -> {
                        policy = result.data.security
                        refreshBanner()
                        _footerCaption.value = footerFor(result.data.security)
                        _state.value = GroupedListUiState.Loaded(groups(result.data.security))
                    }
                    is NetworkResult.Failure -> {
                        policy = null
                        _banner.value = null
                        _state.value =
                            GroupedListUiState.Error(
                                result.error.message.ifBlank {
                                    "We couldn't load this home's security policy. " +
                                        "Check your connection and try again."
                                },
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        /** Dismiss the "requires owner approval" banner. */
        fun onDismissBanner() {
            pendingApprovalMessage = null
            refreshBanner()
        }

        @Suppress("ReturnCount")
        fun onSelectRadio(rowId: String) {
            val current = policy ?: return
            if (isSaving) return

            val request: UpdateHomeOwnershipSecurityRequest
            when {
                rowId.startsWith(MASK_PREFIX) -> {
                    val value = rowId.removePrefix(MASK_PREFIX)
                    if (value == current.privacyMaskLevel) return
                    lastTouchedGroupId = GROUP_MASK
                    request = UpdateHomeOwnershipSecurityRequest(privacyMaskLevel = value)
                }
                rowId.startsWith(CLAIM_PREFIX) -> {
                    val value = rowId.removePrefix(CLAIM_PREFIX)
                    if (value == current.ownerClaimPolicy) return
                    lastTouchedGroupId = GROUP_CLAIM
                    // The backend refuses to tighten claims mid-window
                    // (`homeSecurityPolicy.js:283`); block it client-side
                    // too so the row never appears to take.
                    if (claimWindowActive && value == OWNER_CLAIM_REVIEW_REQUIRED) {
                        saveError = CLAIM_WINDOW_LOCK_COPY
                        _state.value = GroupedListUiState.Loaded(groups(current))
                        return
                    }
                    request = UpdateHomeOwnershipSecurityRequest(ownerClaimPolicy = value)
                }
                rowId.startsWith(ATTACH_PREFIX) -> {
                    val value = rowId.removePrefix(ATTACH_PREFIX)
                    if (value == current.memberAttachPolicy) return
                    lastTouchedGroupId = GROUP_ATTACH
                    request = UpdateHomeOwnershipSecurityRequest(memberAttachPolicy = value)
                }
                else -> return
            }

            isSaving = true
            saveError = null
            _state.value = GroupedListUiState.Loaded(groups(current))
            viewModelScope.launch {
                when (val result = repository.updateSecurity(homeId, request)) {
                    is NetworkResult.Success -> {
                        val body = result.data
                        if (body.requiresOwnerApproval) {
                            // Quorum path — nothing changed yet. Keep the
                            // previous selection rendered and explain why.
                            pendingApprovalMessage =
                                body.message
                                    ?: "This change needs approval from the other verified owners."
                        } else if (body.security != null) {
                            // The PATCH echo re-selects the raw columns only,
                            // so carry the GET-only fields
                            // (`claim_window_active`, `owner_count`) forward
                            // instead of blanking them.
                            val merged =
                                body.security.copy(
                                    tenureMode = body.security.tenureMode ?: current.tenureMode,
                                    claimWindowActive =
                                        body.security.claimWindowActive ?: current.claimWindowActive,
                                    ownerCount = body.security.ownerCount ?: current.ownerCount,
                                )
                            policy = merged
                            _footerCaption.value = footerFor(merged)
                        }
                        refreshBanner()
                    }
                    is NetworkResult.Failure -> {
                        saveError =
                            result.error.message.ifBlank { "Couldn't update that setting. Try again." }
                    }
                }
                isSaving = false
                _state.value = GroupedListUiState.Loaded(groups(policy ?: current))
            }
        }

        /** The claim window locks the owner-claim radios (RN `security.tsx:112`). */
        val claimWindowActive: Boolean
            get() = policy?.claimWindowActive ?: (policy?.securityState == SECURITY_STATE_CLAIM_WINDOW)

        private fun refreshBanner() {
            val pending = pendingApprovalMessage
            if (pending != null) {
                _banner.value =
                    GroupedListBanner(
                        icon = PantopusIcon.Clock,
                        title = "Owner approval requested",
                        subtitle = pending,
                        actionLabel = "Dismiss",
                        style = GroupedListBanner.Style.Pause,
                    )
                return
            }
            _banner.value = policy?.let { statusBanner(it) }
        }

        private fun footerFor(dto: HomeOwnershipSecurityDto): String? {
            val count = dto.ownerCount ?: return null
            return if (count == 1) "1 verified owner" else "$count verified owners"
        }

        // Group projection — mirror of iOS `groups(_:)`.

        private fun groups(dto: HomeOwnershipSecurityDto): List<GroupedListGroup> =
            listOf(
                GroupedListGroup(
                    id = GROUP_MASK,
                    overline = "Privacy & Discoverability",
                    helper =
                        helperFor(
                            GROUP_MASK,
                            "Controls whether this home can be found by search. " +
                                "High and Invite-only reduce risk of unwanted discovery.",
                        ),
                    rows =
                        PRIVACY_MASK_OPTIONS.map { (value, label) ->
                            GroupedListRow(
                                id = MASK_PREFIX + value,
                                label = label,
                                control =
                                    RowControl.Radio(
                                        value == (dto.privacyMaskLevel ?: PRIVACY_MASK_DEFAULT),
                                    ),
                            )
                        },
                ),
                GroupedListGroup(
                    id = GROUP_CLAIM,
                    overline = "Owner claims",
                    helper =
                        helperFor(
                            GROUP_CLAIM,
                            if (claimWindowActive) CLAIM_WINDOW_LOCK_COPY else null,
                        ),
                    rows =
                        OWNER_CLAIM_OPTIONS.map { (value, label) ->
                            GroupedListRow(
                                id = CLAIM_PREFIX + value,
                                label = label,
                                control =
                                    RowControl.Radio(
                                        value == (dto.ownerClaimPolicy ?: OWNER_CLAIM_DEFAULT),
                                    ),
                            )
                        },
                ),
                GroupedListGroup(
                    id = GROUP_ATTACH,
                    overline = "Member attach policy",
                    helper = helperFor(GROUP_ATTACH, null),
                    rows =
                        MEMBER_ATTACH_OPTIONS.map { (value, label) ->
                            GroupedListRow(
                                id = ATTACH_PREFIX + value,
                                label = label,
                                control =
                                    RowControl.Radio(
                                        value == (dto.memberAttachPolicy ?: MEMBER_ATTACH_DEFAULT),
                                    ),
                            )
                        },
                ),
            )

        /**
         * The inline save error replaces the helper caption of whichever
         * group is showing it — there's exactly one PATCH in flight so the
         * last-touched group owns the message.
         */
        private fun helperFor(
            groupId: String,
            fallback: String?,
        ): String? =
            when {
                saveError != null && groupId == lastTouchedGroupId -> saveError
                isSaving && groupId == lastTouchedGroupId -> "Saving…"
                else -> fallback
            }

        companion object {
            const val GROUP_MASK = "privacyMask"
            const val GROUP_CLAIM = "ownerClaim"
            const val GROUP_ATTACH = "memberAttach"

            const val MASK_PREFIX = "privacyMask."
            const val CLAIM_PREFIX = "ownerClaim."
            const val ATTACH_PREFIX = "memberAttach."

            const val PRIVACY_MASK_DEFAULT = "normal"
            const val OWNER_CLAIM_DEFAULT = "open"
            const val OWNER_CLAIM_REVIEW_REQUIRED = "review_required"
            const val MEMBER_ATTACH_DEFAULT = "open_invite"
            const val SECURITY_STATE_CLAIM_WINDOW = "claim_window"

            const val CLAIM_WINDOW_LOCK_COPY =
                "You can't restrict owner claims during the claim window."

            /** `home_privacy_mask_level` (`backend/database/schema.sql:271`). */
            val PRIVACY_MASK_OPTIONS =
                listOf(
                    "normal" to "Normal",
                    "high" to "High (Stealth)",
                    "invite_only_discovery" to "Invite-only",
                )

            /** `home_owner_claim_policy` (`backend/database/schema.sql:213`). */
            val OWNER_CLAIM_OPTIONS =
                listOf(
                    "open" to "Allow owner verification (recommended)",
                    "review_required" to "Require manual review for new owner claims",
                )

            /** `home_member_attach_policy` (`backend/database/schema.sql:203`). */
            val MEMBER_ATTACH_OPTIONS =
                listOf(
                    "open_invite" to "Open invite",
                    "admin_approval" to "Admin approval",
                    "verified_only" to "Verified-only",
                )

            /**
             * Status banner copy per `home_security_state`. Parity
             * contract — mirrored in iOS `statusBanner(for:)`.
             */
            fun statusBanner(dto: HomeOwnershipSecurityDto): GroupedListBanner? =
                when (dto.securityState) {
                    "claim_window" -> {
                        val date = formattedDate(dto.claimWindowEndsAt)
                        GroupedListBanner(
                            icon = PantopusIcon.Clock,
                            title = "Claim Window Active",
                            subtitle =
                                if (date != null) {
                                    "Co-owners can verify ownership until $date."
                                } else {
                                    "Co-owners can verify ownership while the window is open."
                                },
                            style = GroupedListBanner.Style.Stealth,
                        )
                    }
                    "review_required" ->
                        GroupedListBanner(
                            icon = PantopusIcon.Shield,
                            title = "Review Required",
                            subtitle = "New owner claims require manual review.",
                            style = GroupedListBanner.Style.Stealth,
                        )
                    "disputed" ->
                        GroupedListBanner(
                            icon = PantopusIcon.AlertTriangle,
                            title = "Verification dispute active",
                            subtitle = "Some sensitive actions are temporarily restricted.",
                            style = GroupedListBanner.Style.Stealth,
                        )
                    "frozen" ->
                        GroupedListBanner(
                            icon = PantopusIcon.Lock,
                            title = "Home protections enabled",
                            subtitle = "Some actions require support.",
                            style = GroupedListBanner.Style.Stealth,
                        )
                    else -> null
                }

            /** ISO-8601 -> "September 1, 2026". Null when unparsable. */
            fun formattedDate(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                return runCatching {
                    val instant = Instant.parse(iso)
                    DateTimeFormatter
                        .ofPattern("MMMM d, yyyy", Locale.US)
                        .withZone(ZoneId.systemDefault())
                        .format(instant)
                }.getOrNull()
            }
        }
    }
