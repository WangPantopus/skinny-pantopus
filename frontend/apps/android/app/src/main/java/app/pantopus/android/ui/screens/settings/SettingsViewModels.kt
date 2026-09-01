@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.settings

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.account.AccountDeletionRepository
import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.models.settings.PrivacySettingsUpdate
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.components.FuzzStop
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListBanner
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListFuzz
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
import javax.inject.Inject

/** Sentinel routes the Settings index can ask its host to push. */
enum class SettingsRoute {
    EditProfile,
    Password,
    Verification,

    /** Persistent login — Settings → Security → Devices (trusted devices, sessions, security events). */
    Devices,
    Blocks,
    Notifications,
    Privacy,
    IdentityCenter,
    DataExport,
    PaymentsPayouts,
    Help,
    Legal,
    About,
    DidSignOut,

    /**
     * P1.1 — admin-only Review-claims queue. Only surfaced on the
     * Settings index when `auth.state.value.user.isAdmin == true`.
     */
    ReviewClaims,
}

// MARK: - Index

@HiltViewModel
class SettingsIndexViewModel
    @Inject
    constructor(
        private val auth: AuthRepository,
        private val privacy: PrivacyRepository,
        private val profile: ProfileRepository,
    ) : ViewModel() {
        val title: String = "Settings"

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _footerCaption = MutableStateFlow<String?>(null)
        val footerCaption: StateFlow<String?> = _footerCaption.asStateFlow()

        private val _navigation = MutableStateFlow<SettingsRoute?>(null)
        val navigation: StateFlow<SettingsRoute?> = _navigation.asStateFlow()

        private var blockCount: Int = 0

        /**
         * Tri-state on purpose. `null` = we could not read the account's
         * real verification state, and an unknown state must never render
         * the success chip — an unverified account seeing "Verified" on
         * its own Settings row is a trust bug, so `null` falls back to a
         * plain chevron.
         */
        private var verified: Boolean? = null

        /**
         * Raw `User.profile_visibility` (`public | registered | private`).
         * `null` when unread — the row then ships without a subtext rather
         * than asserting a preference the user may not hold.
         */
        private var profileVisibility: String? = null
        private var stripeConnected: Boolean? = null
        private var isAdmin: Boolean = false

        fun load() {
            _state.value = GroupedListUiState.Loading
            val state = auth.state.value
            if (state is AuthRepository.State.SignedIn) {
                // The session `UserDto` carries no verification flag, so the
                // chip is fetched below rather than guessed from the email.
                _footerCaption.value = "${state.user.email} · ID ${state.user.id.take(8)}"
                isAdmin = state.user.isAdmin
            }
            viewModelScope.launch {
                when (val blocks = privacy.blocks()) {
                    is NetworkResult.Success -> blockCount = blocks.data.blocks.size
                    else -> Unit
                }
                // Real verification state — `GET /api/users/profile` →
                // `user.verified` (`backend/routes/users.js:1962`). Same
                // field the Verification Center sub-screen reports; on
                // failure we stay `null` (unknown).
                when (val result = profile.ownProfile()) {
                    is NetworkResult.Success -> {
                        verified = result.data.user.verified
                        profileVisibility = result.data.user.profileVisibility
                    }
                    is NetworkResult.Failure -> {
                        verified = null
                        profileVisibility = null
                    }
                }
                rebuild()
            }
        }

        fun consumeNavigation() {
            _navigation.value = null
        }

        fun onRow(rowId: String) {
            when (rowId) {
                "editProfile" -> _navigation.value = SettingsRoute.EditProfile
                "password" -> _navigation.value = SettingsRoute.Password
                "verification" -> _navigation.value = SettingsRoute.Verification
                "devices" -> _navigation.value = SettingsRoute.Devices
                "blocks" -> _navigation.value = SettingsRoute.Blocks
                "visibility" -> _navigation.value = SettingsRoute.IdentityCenter
                "notificationPreferences" -> _navigation.value = SettingsRoute.Notifications
                "export" -> _navigation.value = SettingsRoute.DataExport
                "paymentsPayouts" -> _navigation.value = SettingsRoute.PaymentsPayouts
                "help" -> _navigation.value = SettingsRoute.Help
                "legal" -> _navigation.value = SettingsRoute.Legal
                "about" -> _navigation.value = SettingsRoute.About
                "reviewClaims" -> _navigation.value = SettingsRoute.ReviewClaims
                "signOut" -> {
                    viewModelScope.launch {
                        auth.signOut()
                        _navigation.value = SettingsRoute.DidSignOut
                    }
                }
            }
        }

        private fun rebuild() {
            val verificationChip: RowControl =
                when (verified) {
                    true -> RowControl.ChipStatus("Verified", RowControl.ChipTone.Success, includesChevron = true)
                    false -> RowControl.ChipStatus("Unverified", RowControl.ChipTone.Warning, includesChevron = true)
                    null -> RowControl.Chevron
                }
            val stripeChip: RowControl =
                if (stripeConnected == true) {
                    RowControl.ChipStatus("Stripe connected", RowControl.ChipTone.Success, includesChevron = true)
                } else {
                    RowControl.Chevron
                }
            val versionString = "Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
            val groups =
                buildList {
                    add(
                        GroupedListGroup(
                            id = "account",
                            overline = "Account",
                            rows =
                                listOf(
                                    GroupedListRow(id = "editProfile", label = "Edit profile", control = RowControl.Chevron),
                                    GroupedListRow(id = "password", label = "Password", control = RowControl.Chevron),
                                    GroupedListRow(id = "verification", label = "Verification", control = verificationChip),
                                ),
                        ),
                    )
                    // Persistent login — Settings → Security → Devices (design §7.6/§7.7).
                    add(
                        GroupedListGroup(
                            id = "security",
                            overline = "Security",
                            rows =
                                listOf(
                                    GroupedListRow(
                                        id = "devices",
                                        label = "Devices & sessions",
                                        subtext = "Trusted devices, sign out everywhere, security activity",
                                        control = RowControl.Chevron,
                                        testTag = "settings.devices.row",
                                    ),
                                ),
                        ),
                    )
                    add(
                        GroupedListGroup(
                            id = "privacy",
                            overline = "Privacy",
                            rows =
                                listOf(
                                    GroupedListRow(
                                        id = "blocks",
                                        label = "Blocked users",
                                        subtext =
                                            if (blockCount > 0) {
                                                "$blockCount ${if (blockCount == 1) "person" else "people"}"
                                            } else {
                                                null
                                            },
                                        control = RowControl.Chevron,
                                    ),
                                    GroupedListRow(
                                        id = "visibility",
                                        label = "Visibility preferences",
                                        subtext = visibilitySubtext(profileVisibility),
                                        control = RowControl.Chevron,
                                    ),
                                    GroupedListRow(id = "export", label = "Data export", control = RowControl.Chevron),
                                ),
                        ),
                    )
                    add(
                        GroupedListGroup(
                            id = "notifications",
                            overline = "Notifications",
                            rows =
                                listOf(
                                    GroupedListRow(
                                        id = "notificationPreferences",
                                        label = "Notification preferences",
                                        subtext = "Push, email, SMS",
                                        control = RowControl.Chevron,
                                    ),
                                ),
                        ),
                    )
                    add(
                        GroupedListGroup(
                            id = "payments",
                            overline = "Payments",
                            rows = listOf(GroupedListRow(id = "paymentsPayouts", label = "Payments & payouts", control = stripeChip)),
                        ),
                    )
                    add(
                        // A14.3 — the design JSX titles the Help/Legal/About
                        // group "About" (the `id` stays "support" so routing +
                        // tests are unaffected).
                        GroupedListGroup(
                            id = "support",
                            overline = "About",
                            rows =
                                listOf(
                                    GroupedListRow(id = "help", label = "Help", control = RowControl.Chevron),
                                    GroupedListRow(id = "legal", label = "Legal", control = RowControl.Chevron),
                                    GroupedListRow(
                                        id = "about",
                                        label = "About Pantopus",
                                        subtext = versionString,
                                        control = RowControl.Chevron,
                                    ),
                                ),
                        ),
                    )
                    // P1.1 — admin-only Review-claims entry point. Sits
                    // after the Support group and before the Session
                    // group so the destructive Log-out row stays last.
                    if (isAdmin) {
                        add(
                            GroupedListGroup(
                                id = "admin",
                                overline = "Admin",
                                rows =
                                    listOf(
                                        GroupedListRow(
                                            id = "reviewClaims",
                                            label = "Review claims",
                                            subtext = "Home-ownership claim queue",
                                            control = RowControl.Chevron,
                                        ),
                                    ),
                            ),
                        )
                    }
                    add(
                        GroupedListGroup(
                            id = "session",
                            overline = null,
                            rows =
                                listOf(
                                    GroupedListRow(
                                        id = "signOut",
                                        label = "Log out",
                                        control = RowControl.Chevron,
                                        destructive = true,
                                    ),
                                ),
                        ),
                    )
                }
            _state.value = GroupedListUiState.Loaded(groups = groups)
        }

        companion object {
            /**
             * Human label for `User.profile_visibility`. Unknown / unread
             * values return `null` so the row omits the subtext rather than
             * claiming a setting the account may not have.
             */
            fun visibilitySubtext(raw: String?): String? =
                when (raw?.lowercase()) {
                    "public" -> "Anyone"
                    "registered" -> "Signed-in neighbors"
                    "private" -> "Only you"
                    else -> null
                }
        }
    }

// MARK: - Privacy

/**
 * P7.6 / A14.7 — Privacy preferences. Reshaped to the design's
 * full-vocabulary frame: two RadioCards (Profile visibility · Address
 * on profile), a "Map location fuzz" card hosting the `FuzzMap` stepped
 * slider, an Activity toggle card, and a "Your data" card of
 * leading-icon action rows + a detached destructive Delete row. A dark
 * `StealthBanner` rides above the first card in the stealth frame.
 *
 * Backend-backed controls (T1 parity):
 *  · "Find me in search" radios + "Find me by real name" toggle read
 *    `GET /api/privacy/settings` and optimistically PATCH the same route,
 *    rolling back and toasting on failure — RN
 *    `src/app/settings/privacy.tsx:151-191`.
 *  · "Delete account" opens the confirm sheet, gates on a
 *    device-credential re-auth, then `DELETE /api/users/account` and a
 *    full sign-out — RN `src/app/settings.tsx:103-119`.
 *
 * The design's own control set (Profile visibility · Address on profile ·
 * Map location fuzz · Activity) has no column in `UserPrivacySettings` —
 * its four-way vocabularies don't map onto the three-way
 * `profile_default_visibility` enum — so those cards stay local until the
 * backend grows the fields. They are never presented as saved. Copy is
 * the parity contract, mirrored on iOS.
 */
@HiltViewModel
class PrivacySettingsViewModel
    @Inject
    constructor(
        private val appLock: AppLockManager,
        private val authRepository: AuthRepository,
        private val privacy: PrivacyRepository,
        private val accountDeletion: AccountDeletionRepository,
        private val stepUp: StepUpCoordinator,
        private val account: AccountRepository,
    ) : ViewModel() {
        enum class Variant { Populated, Stealth }

        val title: String = "Privacy"

        val footerCaption: String
            get() = if (isStealth) "Stealth · auto-applied May 26, 2026" else "Last updated · Mar 12, 2024"

        private var isStealth: Boolean = false
        private var visibility: String = "verified"
        private var address: String = "street"
        private var fuzz: FuzzStop = FuzzStop.HalfMile
        private val activity: MutableMap<String, Boolean> = PrivacyCatalog.seedActivity(stealth = false).toMutableMap()

        // Search privacy (persisted) — `UserPrivacySettings`.
        private var searchVisibility: String = "everyone"
        private var findableByName: Boolean = false

        /** `GET /api/privacy/settings` failed on the last load. RN keeps the
         *  screen up and swaps the helper line rather than blanking it. */
        private var searchPrivacyLoadFailed: Boolean = false

        /** A PATCH is in flight — the radios/toggle ignore taps meanwhile,
         *  matching RN's `privacySaving` guard. */
        private var searchPrivacySaving: Boolean = false

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _banner = MutableStateFlow<GroupedListBanner?>(null)
        val banner: StateFlow<GroupedListBanner?> = _banner.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        private val _deleteSheetVisible = MutableStateFlow(false)
        val deleteSheetVisible: StateFlow<Boolean> = _deleteSheetVisible.asStateFlow()

        private val _deletingAccount = MutableStateFlow(false)
        val deletingAccount: StateFlow<Boolean> = _deletingAccount.asStateFlow()

        private val _deleteAccountError = MutableStateFlow<String?>(null)
        val deleteAccountError: StateFlow<String?> = _deleteAccountError.asStateFlow()

        /** Emitted once the account is gone and the session is cleared, so
         *  the host can pop back to the auth root. */
        private val _accountDeleted = MutableStateFlow(false)
        val accountDeleted: StateFlow<Boolean> = _accountDeleted.asStateFlow()

        fun load() {
            configureAppLockForSignedInUser()
            appLock.refreshCapability()
            viewModelScope.launch {
                fetchSearchPrivacy()
                rebuild()
            }
        }

        /** `GET /api/privacy/settings` — `backend/routes/privacy.js:50`. A
         *  failure never blanks the screen. */
        private suspend fun fetchSearchPrivacy() {
            when (val result = privacy.settings()) {
                is NetworkResult.Success -> {
                    searchVisibility = result.data.settings.searchVisibility ?: "everyone"
                    findableByName = result.data.settings.findableByName ?: false
                    searchPrivacyLoadFailed = false
                }
                is NetworkResult.Failure -> searchPrivacyLoadFailed = true
            }
        }

        /** Test / preview seam: boot straight into a variant frame. */
        fun setVariant(variant: Variant) {
            isStealth = variant == Variant.Stealth
            visibility = if (isStealth) "hidden" else "verified"
            address = if (isStealth) "hidden" else "street"
            fuzz = if (isStealth) FuzzStop.Neighborhood else FuzzStop.HalfMile
            activity.clear()
            activity.putAll(PrivacyCatalog.seedActivity(isStealth))
            rebuild()
        }

        fun onRadio(rowId: String) {
            when {
                rowId.startsWith(SEARCH_VISIBILITY_PREFIX) -> {
                    setSearchVisibility(rowId.removePrefix(SEARCH_VISIBILITY_PREFIX))
                    return
                }
                rowId.startsWith("visibility.") -> visibility = rowId.removePrefix("visibility.")
                rowId.startsWith("address.") -> address = rowId.removePrefix("address.")
                else -> return
            }
            rebuild()
        }

        fun onToggle(
            rowId: String,
            isOn: Boolean,
            hostActivity: FragmentActivity? = null,
        ) {
            if (rowId == ROW_FINDABLE_BY_NAME) {
                setFindableByName(isOn)
                return
            }
            if (rowId == "appLockToggle") {
                viewModelScope.launch {
                    val activity = hostActivity
                    if (activity == null) {
                        rebuild()
                        return@launch
                    }
                    configureAppLockForSignedInUser()
                    val changed = appLock.setEnabled(isOn, activity)
                    if (changed) {
                        _toast.value =
                            ToastMessage(
                                text =
                                    if (isOn) {
                                        "${appLock.biometricLabel.value} protection is on."
                                    } else {
                                        "Biometric protection turned off."
                                    },
                                kind = ToastKind.Success,
                            )
                    } else if (isOn) {
                        _toast.value =
                            ToastMessage(
                                text = "App lock setup was cancelled.",
                                kind = ToastKind.Neutral,
                            )
                    }
                    rebuild()
                }
                return
            }
            if (!activity.containsKey(rowId)) return
            activity[rowId] = isOn
            rebuild()
        }

        fun onTapRow(rowId: String) {
            // "appLockOpenSettings" is handled in the screen (needs Context).
            // Download your data / What we collect open dedicated GDPR flows
            // tracked outside this package.
            if (rowId == ROW_DELETE_ACCOUNT) {
                _deleteAccountError.value = null
                _deleteSheetVisible.value = true
            }
        }

        fun consumeToast() {
            _toast.value = null
        }

        // ---- Search privacy mutations (optimistic + rollback) ----

        /**
         * Optimistic `PATCH /api/privacy/settings { search_visibility }`.
         * Mirrors RN `handleSearchVisibilityChange` — flip locally, adopt
         * the server's echoed value on success, restore the previous value
         * and toast on failure.
         */
        private fun setSearchVisibility(next: String) {
            if (next == searchVisibility || searchPrivacySaving || searchPrivacyLoadFailed) {
                rebuild()
                return
            }
            val previous = searchVisibility
            searchVisibility = next
            searchPrivacySaving = true
            rebuild()
            viewModelScope.launch {
                when (val result = privacy.updateSettings(PrivacySettingsUpdate(searchVisibility = next))) {
                    is NetworkResult.Success -> {
                        searchVisibility = result.data.settings.searchVisibility ?: next
                        _toast.value = ToastMessage("Search privacy updated.", ToastKind.Success)
                    }
                    is NetworkResult.Failure -> {
                        searchVisibility = previous
                        _toast.value =
                            ToastMessage(
                                result.error.message.ifBlank { "Failed to update search privacy." },
                                ToastKind.Error,
                            )
                    }
                }
                searchPrivacySaving = false
                rebuild()
            }
        }

        /**
         * Optimistic `PATCH /api/privacy/settings { findable_by_name }`.
         * Mirrors RN `handleFindableByNameChange`.
         */
        private fun setFindableByName(next: Boolean) {
            if (searchPrivacySaving || searchPrivacyLoadFailed) {
                rebuild()
                return
            }
            val previous = findableByName
            findableByName = next
            searchPrivacySaving = true
            rebuild()
            viewModelScope.launch {
                when (val result = privacy.updateSettings(PrivacySettingsUpdate(findableByName = next))) {
                    is NetworkResult.Success -> {
                        findableByName = result.data.settings.findableByName ?: next
                        _toast.value = ToastMessage("Name search privacy updated.", ToastKind.Success)
                    }
                    is NetworkResult.Failure -> {
                        findableByName = previous
                        _toast.value =
                            ToastMessage(
                                result.error.message.ifBlank { "Failed to update name search privacy." },
                                ToastKind.Error,
                            )
                    }
                }
                searchPrivacySaving = false
                rebuild()
            }
        }

        // ---- Account deletion ----

        fun dismissDeleteSheet() {
            if (_deletingAccount.value) return
            _deleteAccountError.value = null
            _deleteSheetVisible.value = false
        }

        /**
         * The sheet's "Delete My Account" CTA.
         *
         * Order matches RN `settings.tsx:103-119`: re-auth **first**, then
         * `DELETE /api/users/account` (`backend/routes/users.js:3945`), then
         * a full local erase so the host drops back to the auth root. The
         * backend answers 409 when the account still has in-progress gigs
         * or escrowed payments — that message is surfaced verbatim and
         * nothing is deleted.
         *
         * Persistent login (design §7.9, CONTRACT, WORKLOG decision 5): the
         * re-auth is a *step-up* — `X-Step-Up` purpose `delete_account`
         * obtained through [StepUpCoordinator] with the strongest method the
         * account has: the password when it has one, otherwise the
         * biometry-bound device key enrolled in an interactive session. The
         * coordinator owns the Tier-2 gesture (biometric prompt, or
         * `AppLockManager.verifySensitiveAction` before the password sheet).
         * On success every local trace is erased — tokens, remembered
         * accounts, Block Store entry, both Keystore keys.
         */
        fun confirmDeleteAccount(hostActivity: FragmentActivity?) {
            if (_deletingAccount.value) return
            _deleteAccountError.value = null
            viewModelScope.launch {
                _deletingAccount.value = true
                val stepUpToken = obtainDeletionStepUp(hostActivity)
                if (stepUpToken == null) {
                    _deletingAccount.value = false
                    return@launch
                }
                when (val result = accountDeletion.deleteAccount(stepUpToken)) {
                    is NetworkResult.Success -> {
                        _deletingAccount.value = false
                        _deleteSheetVisible.value = false
                        authRepository.eraseAllLocalState()
                        appLock.clearTransientState()
                        _accountDeleted.value = true
                    }
                    is NetworkResult.Failure -> {
                        _deletingAccount.value = false
                        _deleteAccountError.value =
                            result.error.message.ifBlank {
                                "Failed to delete account. Please try again."
                            }
                    }
                }
            }
        }

        /**
         * The `delete_account` step-up token, or `null` when the DELETE must
         * not proceed. Sets [deleteAccountError] itself for the "couldn't
         * verify" outcomes; a plain cancel is silent, exactly like RN's
         * guard.
         */
        private suspend fun obtainDeletionStepUp(hostActivity: FragmentActivity?): String? {
            if (hostActivity == null) {
                _deleteAccountError.value = StepUpCoordinator.NO_ACTIVITY_MESSAGE
                return null
            }
            // Strongest-method rule: an account with a password must present
            // it (the server enforces the same); OAuth-only accounts use the
            // biometric device key. Unknown (auth-methods fetch failed) →
            // let the coordinator try the strongest and the server steer.
            val hasPassword = (account.authMethods() as? NetworkResult.Success)?.data?.hasPassword
            val methods =
                when (hasPassword) {
                    true -> listOf(StepUpCoordinator.METHOD_PASSWORD)
                    false -> listOf(StepUpCoordinator.METHOD_DEVICE_KEY)
                    null -> null
                }
            val outcome =
                stepUp.obtainToken(
                    purpose = StepUpCoordinator.PURPOSE_DELETE_ACCOUNT,
                    methods = methods,
                    activity = hostActivity,
                    reason = "Approve account deletion",
                )
            return when (outcome) {
                is StepUpCoordinator.Outcome.Token -> outcome.stepUpToken
                StepUpCoordinator.Outcome.Cancelled -> null
                is StepUpCoordinator.Outcome.Failed -> {
                    _deleteAccountError.value =
                        if (hasPassword == false && outcome.message == StepUpCoordinator.NO_METHOD_MESSAGE) {
                            PASSWORDLESS_DELETE_HELP
                        } else {
                            outcome.message
                        }
                    null
                }
            }
        }

        fun onSetFuzz(
            rowId: String,
            stop: FuzzStop,
        ) {
            if (rowId != PrivacyCatalog.FUZZ) return
            fuzz = stop
            rebuild()
        }

        private fun configureAppLockForSignedInUser() {
            val userId =
                (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
            appLock.configure(userId)
        }

        private fun rebuild() {
            _banner.value =
                if (isStealth) {
                    GroupedListBanner(
                        icon = PantopusIcon.EyeOff,
                        title = "Stealth mode is on",
                        subtitle = "Your profile is hidden from search. Existing connections still see you.",
                        style = GroupedListBanner.Style.Stealth,
                    )
                } else {
                    null
                }
            _state.value = GroupedListUiState.Loaded(groups())
        }

        private fun groups(): List<GroupedListGroup> =
            listOf(
                biometricSecurityGroup(),
                searchPrivacyGroup(),
                visibilityGroup(),
                addressGroup(),
                fuzzGroup(),
                activityGroup(),
                dataGroup(),
                deleteGroup(),
            )

        /**
         * The only backend-backed card on this screen —
         * `UserPrivacySettings.search_visibility` + `.findable_by_name`.
         * Radio labels + helper copy are RN's
         * (`settings/privacy.tsx:20-33`, `:476-556`) word for word.
         */
        private fun searchPrivacyGroup(): GroupedListGroup =
            GroupedListGroup(
                id = PrivacyCatalog.SEARCH_PRIVACY,
                overline = "Find me in search",
                helper =
                    if (searchPrivacyLoadFailed) {
                        "Search privacy could not load. Pull to refresh before changing this setting."
                    } else {
                        PrivacyCatalog.searchVisibilityHelp[searchVisibility]
                    },
                rows =
                    PrivacyCatalog.searchVisibilityOptions.map { option ->
                        GroupedListRow(
                            id = "$SEARCH_VISIBILITY_PREFIX${option.key}",
                            label = option.label,
                            control = RowControl.Radio(option.key == searchVisibility),
                            testTag = "search-visibility-${option.key}",
                        )
                    } +
                        GroupedListRow(
                            id = ROW_FINDABLE_BY_NAME,
                            label = "Find me by real name",
                            subtext =
                                "Let people search your account first, middle, or last name " +
                                    "when your search visibility allows them.",
                            control = RowControl.Toggle(findableByName),
                            testTag = "findable-by-name-switch",
                        ),
            )

        private fun biometricSecurityGroup(): GroupedListGroup {
            val label = appLock.biometricLabel.value
            val capability = appLock.capability.value
            return GroupedListGroup(
                id = PrivacyCatalog.BIOMETRIC_SECURITY,
                overline = "BIOMETRIC SECURITY",
                rows =
                    listOf(
                        GroupedListRow(
                            id = "appLockToggle",
                            label = "Require $label for sensitive actions",
                            subtext = "Protect payments, mailbox, and account changes with biometric verification.",
                            control = RowControl.Toggle(appLock.preferenceEnabled.value),
                            testTag = "appLockToggle",
                        ),
                        GroupedListRow(
                            id = "appLockCapabilityStatus",
                            label = "Current Capability",
                            control =
                                RowControl.ChipStatus(
                                    label = capability.statusText,
                                    tone =
                                        if (capability == AppLockManager.Capability.Available) {
                                            RowControl.ChipTone.Success
                                        } else {
                                            RowControl.ChipTone.Warning
                                        },
                                    includesChevron = false,
                                ),
                            testTag = "appLockCapabilityStatus",
                        ),
                        GroupedListRow(
                            id = "appLockOpenSettings",
                            label = "Open Device Settings",
                            control = RowControl.Chevron,
                            testTag = "appLockOpenSettings",
                        ),
                    ),
            )
        }

        private fun visibilityGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "visibility",
                overline = "Profile visibility",
                helper =
                    if (isStealth) {
                        "Hidden — your profile won't show in search or recommendations."
                    } else {
                        "Verified neighbors can find you and start a conversation."
                    },
                rows =
                    PrivacyCatalog.visibilityOptions.map { option ->
                        GroupedListRow(
                            id = "visibility.${option.key}",
                            label = option.label,
                            subtext = option.sub,
                            control = RowControl.Radio(option.key == visibility),
                        )
                    },
            )

        private fun addressGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "address",
                overline = "Address on profile",
                helper =
                    if (isStealth) {
                        "Address hidden everywhere. Deliveries still route correctly."
                    } else {
                        "Street name shows on your profile; full address only to people you hire or sell to."
                    },
                rows =
                    PrivacyCatalog.addressOptions.map { option ->
                        GroupedListRow(
                            id = "address.${option.key}",
                            label = option.label,
                            subtext = option.sub,
                            control = RowControl.Radio(option.key == address),
                        )
                    },
            )

        private fun fuzzGroup(): GroupedListGroup =
            GroupedListGroup(
                id = PrivacyCatalog.FUZZ,
                overline = "Map location fuzz",
                helper =
                    if (isStealth) {
                        "Pins fuzz to your neighborhood — buyers see only \"Park Slope\", never your block."
                    } else {
                        "Pins drop within a block of you. Exact address only shared after a task is accepted."
                    },
                rows = emptyList(),
                fuzz =
                    GroupedListFuzz(
                        leadIn = "How exact your task and listing pins appear on the map.",
                        stop = fuzz,
                    ),
            )

        private fun activityGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "activity",
                overline = "Activity",
                rows =
                    PrivacyCatalog.activitySpecs.map { spec ->
                        GroupedListRow(
                            id = spec.key,
                            label = spec.label,
                            subtext = spec.sub,
                            control = RowControl.Toggle(activity[spec.key] ?: false),
                        )
                    },
            )

        private fun dataGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "data",
                overline = "Your data",
                rows =
                    listOf(
                        GroupedListRow(
                            id = "downloadData",
                            label = "Download your data",
                            subtext = "ZIP of profile, tasks, messages — emailed to you",
                            control = RowControl.Chevron,
                            leadingIcon = PantopusIcon.Download,
                        ),
                        GroupedListRow(
                            id = "whatWeCollect",
                            label = "What we collect",
                            subtext = "Full data policy & current categories",
                            control = RowControl.Chevron,
                            leadingIcon = PantopusIcon.FileText,
                        ),
                    ),
            )

        private fun deleteGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "delete",
                rows =
                    listOf(
                        GroupedListRow(
                            id = ROW_DELETE_ACCOUNT,
                            label = "Delete account",
                            // The design frame reads "Permanent. 30-day
                            // grace period." — `users.js:3945` has no
                            // grace window, it hard-deletes on the spot,
                            // so the row can't promise one. Mirrored on
                            // iOS; flagged for design review.
                            subtext = "Permanent. This can't be undone.",
                            control = RowControl.Chevron,
                            destructive = true,
                        ),
                    ),
            )
    }

/** `searchVisibility.<everyone|mutuals|nobody>` row-id prefix. */
private const val SEARCH_VISIBILITY_PREFIX = "searchVisibility."

/** Delete account: OAuth-only account without a usable biometric step-up key on this device. */
internal const val PASSWORDLESS_DELETE_HELP =
    "Biometric verification isn't set up on this device. Sign in again with Google or Apple, then try again."
private const val ROW_FINDABLE_BY_NAME = "findableByName"
private const val ROW_DELETE_ACCOUNT = "deleteAccount"

/**
 * A14.7 privacy catalog — the radio options, activity specs, and seeds.
 * Top-level (mirror of the iOS static data) so the view-model stays
 * lean. Copy here is the parity contract with iOS.
 */
internal object PrivacyCatalog {
    const val FUZZ = "fuzz"
    const val BIOMETRIC_SECURITY = "biometricSecurity"
    const val SEARCH_PRIVACY = "searchPrivacy"

    data class Option(
        val key: String,
        val label: String,
        val sub: String?,
    )

    /** `search_visibility` enum values + RN's labels
     *  (`settings/privacy.tsx:20-28`). Order is RN's. */
    val searchVisibilityOptions: List<Option> =
        listOf(
            Option("everyone", "Everyone", null),
            Option("mutuals", "Connections", null),
            Option("nobody", "Hidden", null),
        )

    /** Helper line under the card — describes the *selected* option, as
     *  RN does (`SEARCH_VISIBILITY_HELP`, `settings/privacy.tsx:30-33`). */
    val searchVisibilityHelp: Map<String, String> =
        mapOf(
            "everyone" to "Your profile can appear when people search your handle or display name.",
            "mutuals" to "Only connected people can find your profile in search.",
            "nobody" to "Your profile is hidden from search and public discovery.",
        )

    val visibilityOptions: List<Option> =
        listOf(
            Option("public", "Public", "Anyone with the link can see your profile"),
            Option("verified", "Verified neighbors only", "People with a verified address can see you"),
            Option("connections", "Connections only", "Only people you've interacted with"),
            Option("hidden", "Hidden", "Profile not browsable. Existing chats still work"),
        )

    val addressOptions: List<Option> =
        listOf(
            Option("full", "Full address", "14 Elm Park Lane, Brooklyn NY"),
            Option("street", "Street only", "Elm Park Lane, Brooklyn"),
            Option("neighborhood", "Neighborhood", "Park Slope, Brooklyn"),
            Option("hidden", "Hidden", "Verified badge shown, address not"),
        )

    val activitySpecs: List<Option> =
        listOf(
            Option("online", "Show online status", "Green dot when you're active"),
            Option("recent", "Show recent activity", "\"Posted a task 2h ago\" on profile"),
            Option("nearby", "Appear in nearby search", "Neighbors can find you by proximity"),
            Option("ratings", "Show ratings publicly", null),
        )

    fun seedActivity(stealth: Boolean): Map<String, Boolean> = activitySpecs.associate { it.key to !stealth }
}
