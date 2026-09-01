@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.edit_persona

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.audience.PersonaPublicLinkDto
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaWriteBody
import java.util.UUID

/**
 * A13.12 — Edit Beacon. Editable form models for the creator-facing Beacon
 * (persona) editor. Mirrors iOS `EditPersonaContent.swift` field for field.
 *
 * Everything here maps 1:1 onto the persona write contract:
 * ```
 * POST  /api/personas          backend/routes/personas.js:271
 * PATCH /api/personas/:id      backend/routes/personas.js:850
 * POST  /api/upload/persona-media/:id?type=avatar|banner
 *                              backend/routes/upload.js:312
 * ```
 *
 * Beacon accent is sky / `primary600`, flat — the design source renders a
 * fuchsia gradient hero, but there is no fuchsia token in the design system
 * and every shipped Beacon surface uses the sky primary.
 */

/** Creating the first Beacon vs. editing the one the user already owns. */
sealed interface EditPersonaMode {
    data object Create : EditPersonaMode

    data class Edit(val personaId: String) : EditPersonaMode

    val isCreate: Boolean get() = this is Create
}

/** One `{ label, url }` row in `public_links`, with a stable local id. */
@Immutable
data class PersonaLinkDraft(
    val id: String = UUID.randomUUID().toString(),
    val label: String = "",
    val url: String = "",
) {
    val isBlank: Boolean get() = label.isBlank() && url.isBlank()

    /**
     * RN parity (`persona.tsx:456`): a row with only one half filled in
     * blocks the save with "Each public link needs both a label and a URL."
     */
    val isIncomplete: Boolean get() = label.isNotBlank() != url.isNotBlank()

    /** Normalised for the wire — bare hosts get an `https://` scheme. */
    fun wireValue(): PersonaPublicLinkDto? {
        if (isBlank) return null
        val raw = url.trim()
        val hasScheme = SCHEME_REGEX.containsMatchIn(raw)
        return PersonaPublicLinkDto(
            label = label.trim(),
            url = if (hasScheme) raw else "https://$raw",
        )
    }

    private companion object {
        val SCHEME_REGEX = Regex("^[a-z][a-z0-9+.-]*://", RegexOption.IGNORE_CASE)
    }
}

/**
 * A selectable Beacon category, sourced from
 * `GET /api/personas/compliance/categories`. [enabled] `false` means the
 * category is modeled but gated behind credential verification, so the chip
 * renders disabled.
 */
@Immutable
data class PersonaCategoryOption(
    val value: String,
    val label: String,
    val enabled: Boolean,
    val sensitive: Boolean = false,
    val requirements: List<String> = emptyList(),
) {
    companion object {
        /**
         * Fallback ladder used until `/compliance/categories` answers.
         * Mirrors `LOW_RISK_PERSONA_CATEGORIES`
         * (`backend/utils/personaCompliance.js:1`) and RN's `CATEGORIES`.
         */
        val FALLBACK =
            listOf(
                PersonaCategoryOption("creator", "Creator", enabled = true),
                PersonaCategoryOption("writer", "Writer", enabled = true),
                PersonaCategoryOption("coach", "Coach", enabled = true),
                PersonaCategoryOption("consultant", "Consultant", enabled = true),
                PersonaCategoryOption("community_leader", "Community Leader", enabled = true),
                PersonaCategoryOption("public_figure", "Public Figure", enabled = true),
                PersonaCategoryOption("other", "Other Public Role", enabled = true),
            )
    }
}

/**
 * What the Beacon calls its audience — the `audience_label` enum in
 * `personaSchemaFields` (`backend/routes/personas.js:63`), ordered as RN's
 * `AUDIENCE_LABELS`.
 */
enum class PersonaAudienceLabel(val wire: String, val label: String) {
    Followers("followers", "Followers"),
    Subscribers("subscribers", "Subscribers"),
    Members("members", "Members"),
    Students("students", "Students"),
    Clients("clients", "Clients"),
    Customers("customers", "Customers"),
    Patients("patients", "Patients"),
    ;

    companion object {
        fun from(wire: String?): PersonaAudienceLabel = entries.firstOrNull { it.wire == wire } ?: Followers
    }
}

/**
 * How someone joins the audience. `invite_only` / `organization_managed`
 * exist on the wire but RN only offers the two self-serve modes.
 */
enum class PersonaAudienceMode(val wire: String, val label: String, val blurb: String) {
    Open("open", "Open", "Anyone can follow instantly."),
    ApprovalRequired("approval_required", "Approval Required", "You approve each new follower."),
    ;

    companion object {
        fun from(wire: String?): PersonaAudienceMode = entries.firstOrNull { it.wire == wire } ?: Open
    }
}

/**
 * A locally-picked image awaiting upload. Held alongside the remote URL so
 * the editor can preview the pick before `save()` pushes it.
 */
@Immutable
data class PersonaImagePick(
    val bytes: ByteArray,
    val fileName: String,
    val mimeType: String,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is PersonaImagePick &&
                    fileName == other.fileName &&
                    mimeType == other.mimeType &&
                    bytes.contentEquals(other.bytes)
            )

    override fun hashCode(): Int {
        var result = fileName.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + bytes.contentHashCode()
        return result
    }
}

/**
 * The editable Beacon. Every field is accepted by `createPersonaSchema` /
 * `updatePersonaSchema`; the two image slots are pushed separately by the
 * persona-media route.
 */
@Immutable
data class EditPersonaForm(
    val handle: String = "",
    val displayName: String = "",
    val bio: String = "",
    val category: String = "creator",
    val audienceLabel: PersonaAudienceLabel = PersonaAudienceLabel.Followers,
    val audienceMode: PersonaAudienceMode = PersonaAudienceMode.Open,
    val links: List<PersonaLinkDraft> = emptyList(),
    /** Already-hosted images (null until the Beacon has one). */
    val avatarUrl: String? = null,
    val bannerUrl: String? = null,
    /** Freshly picked images awaiting upload. */
    val avatarPick: PersonaImagePick? = null,
    val bannerPick: PersonaImagePick? = null,
) {
    val normalizedHandle: String get() = handle.trim().trimStart('@')

    val atHandle: String get() = normalizedHandle.let { if (it.isEmpty()) "" else "@$it" }

    val bioCharCount: String get() = "${bio.length} / $BIO_LIMIT"

    val hasIncompleteLink: Boolean get() = links.any { it.isIncomplete }

    /** The public URL RN prints on the share card (`persona.tsx:527`). */
    val shareUrl: String
        get() = normalizedHandle.let { if (it.isEmpty()) "" else "https://pantopus.com/@$it" }

    fun wireBody(): PersonaWriteBody =
        PersonaWriteBody(
            handle = normalizedHandle,
            displayName = displayName.trim(),
            bio = bio.trim().ifEmpty { null },
            category = category,
            audienceLabel = audienceLabel.wire,
            audienceMode = audienceMode.wire,
            publicLinks = links.mapNotNull { it.wireValue() },
        )

    companion object {
        /** Max 1500 (`personaSchemaFields.bio`). */
        const val BIO_LIMIT = 1500

        /** Max 8 (`personaSchemaFields.public_links`). */
        const val LINK_LIMIT = 8

        /** Project a persona the server just handed back onto the form. */
        fun from(dto: PersonaSummaryDto): EditPersonaForm =
            EditPersonaForm(
                handle = dto.handle.orEmpty(),
                displayName = dto.displayName.orEmpty(),
                bio = dto.bio.orEmpty(),
                category = dto.category ?: "creator",
                audienceLabel = PersonaAudienceLabel.from(dto.audienceLabel),
                audienceMode = PersonaAudienceMode.from(dto.audienceMode),
                links =
                    dto.publicLinks.orEmpty().take(LINK_LIMIT).map {
                        PersonaLinkDraft(label = it.label, url = it.url)
                    },
                avatarUrl = dto.avatarUrl,
                bannerUrl = dto.bannerUrl,
            )
    }
}

/**
 * Save lifecycle — drives the sticky-bar CTA label exactly like RN's
 * `saveButtonLabel` (`persona.tsx:525`).
 */
enum class EditPersonaSavePhase { Idle, Profile, Avatar, Banner }

/**
 * Top-level editor state. `Editing` carries the live form plus everything
 * the sticky bar needs; the form itself is replaced wholesale on each edit
 * so Compose recomposes off a single immutable value.
 */
sealed interface EditPersonaUiState {
    data object Loading : EditPersonaUiState

    data class Editing(
        val mode: EditPersonaMode,
        val form: EditPersonaForm,
        val categories: List<PersonaCategoryOption> = PersonaCategoryOption.FALLBACK,
        val savePhase: EditPersonaSavePhase = EditPersonaSavePhase.Idle,
        val statusMessage: String? = null,
        val saveError: String? = null,
        val isDirty: Boolean = false,
    ) : EditPersonaUiState {
        val isSaving: Boolean get() = savePhase != EditPersonaSavePhase.Idle

        /** `handle` + `display_name` are the only server-required fields. */
        val isValid: Boolean
            get() =
                form.normalizedHandle.isNotEmpty() &&
                    form.displayName.isNotBlank() &&
                    !form.hasIncompleteLink &&
                    form.bio.length <= EditPersonaForm.BIO_LIMIT

        val canAddLink: Boolean get() = form.links.size < EditPersonaForm.LINK_LIMIT

        val saveButtonLabel: String
            get() =
                when (savePhase) {
                    EditPersonaSavePhase.Avatar -> "Uploading avatar..."
                    EditPersonaSavePhase.Banner -> "Uploading banner..."
                    EditPersonaSavePhase.Profile -> "Saving profile..."
                    EditPersonaSavePhase.Idle -> if (mode.isCreate) "Publish Beacon" else "Save Beacon"
                }
    }

    data class Error(val message: String) : EditPersonaUiState
}
