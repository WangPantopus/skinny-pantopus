@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.identity_center

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.identity.AudienceProfileDto
import app.pantopus.android.data.api.models.identity.BridgesDto
import app.pantopus.android.data.api.models.identity.BusinessIdentityDto
import app.pantopus.android.data.api.models.identity.IdentityCenterResponse
import app.pantopus.android.data.api.models.identity.LocalProfileDto
import app.pantopus.android.data.api.models.identity.PrivateAccountDto
import app.pantopus.android.data.api.models.identity.UpdateBridgesBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.IdentityCenterRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Backs the T3.2 Profiles & Privacy screen. Fetches
 * `GET /api/identity-center` and projects the backend payload into
 * four identity cards + Profile-links toggles + privacy + disclosure
 * rows. Toggle taps PATCH `/api/identity-center/bridges/:personaId`
 * optimistically with rollback.
 */
@HiltViewModel
class IdentityCenterViewModel
    @Inject
    constructor(
        private val repository: IdentityCenterRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<IdentityCenterUiState>(IdentityCenterUiState.Loading)
        val state: StateFlow<IdentityCenterUiState> = _state.asStateFlow()

        private var raw: IdentityCenterResponse? = null

        fun load() {
            _state.value = IdentityCenterUiState.Loading
            viewModelScope.launch {
                when (val result = repository.overview()) {
                    is NetworkResult.Success -> {
                        raw = result.data
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = IdentityCenterUiState.Error("Couldn't load Profiles & Privacy.")
                    }
                }
            }
        }

        /**
         * Toggle one of the "Profile links" rows. Apply optimistically;
         * PATCH the backend; roll back the local `bridges` snapshot on
         * failure.
         */
        fun setBridge(
            rowId: String,
            isOn: Boolean,
        ) {
            val snapshot = raw ?: return
            val personaId = snapshot.audienceProfile?.id ?: return
            val previous = snapshot.bridges
            // Backend `Joi` schema requires BOTH booleans on every PATCH
            // — seed with the current snapshot so the untouched row
            // keeps its server-canonical value.
            val basePersonaOnLocal = previous?.showPersonaOnLocal ?: false
            val baseLocalOnPersona = previous?.showLocalOnPersona ?: false
            val body =
                when (rowId) {
                    "showPublicOnLocal" ->
                        UpdateBridgesBody(showPersonaOnLocal = isOn, showLocalOnPersona = baseLocalOnPersona)
                    "showLocalOnPublic" ->
                        UpdateBridgesBody(showPersonaOnLocal = basePersonaOnLocal, showLocalOnPersona = isOn)
                    else -> return
                }
            raw = snapshot.updatingBridges(rowId = rowId, isOn = isOn)
            rebuild()
            viewModelScope.launch {
                when (repository.updateBridges(personaId, body)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        raw = snapshot.copy(bridges = previous)
                        rebuild()
                    }
                }
            }
        }

        private fun rebuild() {
            val snapshot = raw ?: return
            _state.value = IdentityCenterUiState.Loaded(project(snapshot))
        }

        companion object {
            internal fun project(response: IdentityCenterResponse): IdentityCenterLoaded {
                val identities =
                    listOf(
                        localCard(response.localProfile),
                        personalCard(response.privateAccount),
                        publicProfileCard(response.audienceProfile, response.personaCount ?: 0),
                        professionalCard(response.businessProfiles.orEmpty()),
                    )
                val bridges =
                    if (response.audienceProfile != null) {
                        listOf(
                            IdentityBridgeRow(
                                id = "showPublicOnLocal",
                                label = "Show my Public profile on my Local Profile",
                                subtext = "Neighbors can find your Public profile from your Local Profile.",
                                isOn = response.bridges?.showPersonaOnLocal ?: false,
                            ),
                            IdentityBridgeRow(
                                id = "showLocalOnPublic",
                                label = "Show my Local Profile on my Public profile",
                                subtext = "Followers can see your neighbor name and home if they tap through.",
                                isOn = response.bridges?.showLocalOnPersona ?: false,
                            ),
                        )
                    } else {
                        emptyList()
                    }
                val homes = response.homes.orEmpty()
                val homesValue = if (homes.isEmpty()) "Not connected" else "${homes.size} connected"
                val privacyRows =
                    listOf(
                        IdentityRowContent(
                            id = "blockedPersonal",
                            icon = PantopusIcon.Shield,
                            label = "Blocked accounts",
                            trailing = "${response.blockCounts?.personal ?: 0}",
                        ),
                        IdentityRowContent(
                            id = "blockedAudience",
                            icon = PantopusIcon.Shield,
                            label = "Blocked followers",
                            trailing = "${response.blockCounts?.audience ?: 0}",
                        ),
                        IdentityRowContent(
                            id = "privacyPreview",
                            icon = PantopusIcon.Eye,
                            label = "Privacy Preview",
                            subtext = "Open the visitor's view of your profiles.",
                        ),
                    )
                val disclosureRows =
                    listOf(
                        IdentityRowContent(
                            id = "homes",
                            icon = PantopusIcon.Home,
                            label = "Homes",
                            trailing = homesValue,
                        ),
                        IdentityRowContent(
                            id = "businessProfiles",
                            icon = PantopusIcon.Briefcase,
                            label = "Business Profiles",
                            trailing = "${response.businessProfiles?.size ?: 0}",
                        ),
                        IdentityRowContent(
                            id = "dataExport",
                            icon = PantopusIcon.File,
                            label = "Data export",
                            subtext = "Download everything we know about your identities.",
                        ),
                    )
                val setupRemaining =
                    identities.count { card ->
                        card.status is IdentityStatus.SetupNeeded
                    }
                return IdentityCenterLoaded(
                    identities = identities,
                    bridges = bridges,
                    privacyRows = privacyRows,
                    disclosureRows = disclosureRows,
                    setupRemainingCount = setupRemaining,
                )
            }

            private fun localCard(dto: LocalProfileDto?): IdentityCardContent {
                if (dto == null) {
                    return IdentityCardContent(
                        id = "local",
                        kind = IdentityKind.Local,
                        overline = "Local Profile",
                        name = "Set up your neighbor identity",
                        summary = "Local Profile lets verified neighbors find you in posts, gigs, and marketplace.",
                        status = IdentityStatus.SetupNeeded(cta = "Set up"),
                    )
                }
                val posts = dto.postCount ?: 0
                val connections = dto.connectionCount ?: 0
                val verified = dto.verified ?: false
                val stats =
                    buildString {
                        append("$posts ${if (posts == 1) "post" else "posts"}")
                        append(" · $connections ${if (connections == 1) "connection" else "connections"}")
                        if (verified) append(" · Verified neighbor")
                    }
                return IdentityCardContent(
                    id = dto.id,
                    kind = IdentityKind.Local,
                    overline = "Local Profile",
                    name = dto.displayName ?: "Local Profile",
                    handle = dto.handle?.let { "/$it" },
                    stats = stats,
                    summary = "For nearby posts, gigs, marketplace, and neighbors.",
                )
            }

            private fun personalCard(dto: PrivateAccountDto?): IdentityCardContent {
                val name = dto?.email ?: dto?.name ?: "Personal"
                return IdentityCardContent(
                    id = dto?.id ?: "personal",
                    kind = IdentityKind.Personal,
                    overline = "Personal",
                    name = name,
                    stats = "Visible only to verified connections",
                    summary = "Account-level identity. Used for sign-in and direct correspondence.",
                )
            }

            private fun publicProfileCard(
                dto: AudienceProfileDto?,
                personaCount: Int,
            ): IdentityCardContent {
                if (dto == null) {
                    val cta = if (personaCount > 0) "Activate" else "Create"
                    return IdentityCardContent(
                        id = "publicProfile",
                        kind = IdentityKind.PublicProfile,
                        overline = "Public profile",
                        name = "Create your public face",
                        summary = "Followers find your Public profile here. Update them when you ship work.",
                        status = IdentityStatus.SetupNeeded(cta = cta),
                    )
                }
                val followers = dto.followerCount ?: 0
                val stats =
                    buildString {
                        append("$followers ${if (followers == 1) "follower" else "followers"}")
                        dto.postCadence?.let { append(" · $it") }
                    }
                val chip =
                    if (dto.status?.lowercase() == "live") {
                        IdentityChip("Live", IdentityChip.Tone.Success)
                    } else {
                        val rightLabel =
                            if (followers >= 1_000) {
                                "${followers / 1_000}.${followers % 1_000 / 100}k followers"
                            } else {
                                "$followers followers"
                            }
                        IdentityChip(rightLabel, IdentityChip.Tone.Neutral)
                    }
                return IdentityCardContent(
                    id = dto.id,
                    kind = IdentityKind.PublicProfile,
                    overline = "Public profile",
                    name = dto.displayName ?: "Public profile",
                    handle = dto.handle?.let { "@$it" },
                    stats = stats,
                    summary = "Your public creator face. Followers stay with you here.",
                    chip = chip,
                )
            }

            private fun professionalCard(businesses: List<BusinessIdentityDto>): IdentityCardContent {
                val first = businesses.firstOrNull()
                if (first == null) {
                    return IdentityCardContent(
                        id = "professional",
                        kind = IdentityKind.Professional,
                        overline = "Professional",
                        name = "Add your trade",
                        summary = "Hireable identity. Surfaced in Gigs and Marketplace.",
                        status = IdentityStatus.SetupNeeded(cta = "Add"),
                    )
                }
                return IdentityCardContent(
                    id = first.id,
                    kind = IdentityKind.Professional,
                    overline = "Professional",
                    name = first.displayName ?: "Business",
                    stats = if (businesses.size > 1) "+ ${businesses.size - 1} more" else "Available for hire",
                    summary = "Hireable trade profile. Surfaced in Gigs and Marketplace.",
                )
            }
        }
    }

private fun IdentityCenterResponse.updatingBridges(
    rowId: String,
    isOn: Boolean,
): IdentityCenterResponse {
    val current = bridges ?: BridgesDto(showPersonaOnLocal = false, showLocalOnPersona = false)
    val next =
        when (rowId) {
            "showPublicOnLocal" ->
                BridgesDto(showPersonaOnLocal = isOn, showLocalOnPersona = current.showLocalOnPersona)
            "showLocalOnPublic" ->
                BridgesDto(showPersonaOnLocal = current.showPersonaOnLocal, showLocalOnPersona = isOn)
            else -> current
        }
    return copy(bridges = next)
}
