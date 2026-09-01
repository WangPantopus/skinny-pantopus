@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.audience_profile.edit_persona

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.data.audience.PersonaEditRepository
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

/**
 * Nav-arg key for the persona id read off the back-stack handle. Matches
 * `ChildRoutes.EDIT_PERSONA` (`personas/{personaId}/edit`). The editor
 * resolves the real Beacon from `GET /api/personas/me` regardless, so the
 * arg is advisory only — an empty value simply means "create".
 */
const val EDIT_PERSONA_PERSONA_ID_KEY = "personaId"

/**
 * Route arg used when the caller wants the create flow. The nav graph
 * declares a non-optional string segment, so "new" stands in for "I don't
 * have a persona id yet" — the editor asks the server either way.
 */
const val EDIT_PERSONA_CREATE_ARG = "new"

/**
 * A13.12 — Backs the creator-facing Edit Beacon editor.
 *
 * [load] resolves the signed-in user's Beacon from `GET /api/personas/me`
 * (`backend/routes/personas.js:367`). `persona: null` opens an empty
 * *create* form; otherwise the form is pre-filled in *edit* mode.
 *
 * [save] mirrors RN `persona.tsx:424-524`:
 *  1. `POST /api/personas` (create) or `PATCH /api/personas/:id` (edit)
 *  2. then the avatar upload, then the banner upload, each via
 *     `POST /api/upload/persona-media/:id?type=...`
 *
 * A media failure after a successful profile write keeps the saved profile
 * and surfaces "Profile details saved. Media still needs attention." — the
 * profile write is never rolled back.
 */
@HiltViewModel
class EditPersonaViewModel
    @Inject
    constructor(
        private val audienceRepository: AudienceProfileRepository,
        private val personaEditRepository: PersonaEditRepository,
        private val uploadRepository: UploadRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<EditPersonaUiState>(EditPersonaUiState.Loading)
        val state: StateFlow<EditPersonaUiState> = _state.asStateFlow()

        /** Set once a save lands so the screen can offer "View Beacon". */
        private val _savedHandle = MutableStateFlow<String?>(null)
        val savedHandle: StateFlow<String?> = _savedHandle.asStateFlow()

        private var loadedForm = EditPersonaForm()

        fun load() {
            _state.value = EditPersonaUiState.Loading
            _savedHandle.value = null
            viewModelScope.launch {
                when (val result = audienceRepository.me()) {
                    is NetworkResult.Success -> {
                        val persona = result.data.persona
                        val form = persona?.let { EditPersonaForm.from(it) } ?: EditPersonaForm()
                        loadedForm = form
                        _state.value =
                            EditPersonaUiState.Editing(
                                mode =
                                    persona
                                        ?.let { EditPersonaMode.Edit(it.id) }
                                        ?: EditPersonaMode.Create,
                                form = form,
                            )
                        loadCategories()
                    }
                    is NetworkResult.Failure ->
                        _state.value = EditPersonaUiState.Error(result.error.message)
                }
            }
        }

        fun refresh() = load()

        /**
         * Best-effort — the fallback ladder already covers the low-risk
         * categories, so a failure here never blocks editing.
         */
        private suspend fun loadCategories() {
            val result = personaEditRepository.categoryPolicies()
            if (result !is NetworkResult.Success) return
            val options =
                result.data.categories.map { policy ->
                    PersonaCategoryOption(
                        value = policy.category,
                        label = titleCase(policy.label ?: policy.category),
                        enabled = policy.enabled ?: true,
                        sensitive = policy.sensitive ?: false,
                        requirements = policy.requirements.orEmpty(),
                    )
                }
            if (options.isEmpty()) return
            editing { it.copy(categories = options) }
        }

        // MARK: - Editing intents

        fun setHandle(value: String) = mutateForm { it.copy(handle = value) }

        fun setDisplayName(value: String) = mutateForm { it.copy(displayName = value) }

        fun setBio(value: String) = mutateForm { it.copy(bio = value) }

        fun setCategory(value: String) = mutateForm { it.copy(category = value) }

        fun setAudienceLabel(value: PersonaAudienceLabel) = mutateForm { it.copy(audienceLabel = value) }

        fun setAudienceMode(value: PersonaAudienceMode) = mutateForm { it.copy(audienceMode = value) }

        fun addLink() {
            val current = _state.value as? EditPersonaUiState.Editing ?: return
            if (!current.canAddLink) return
            mutateForm { it.copy(links = it.links + PersonaLinkDraft()) }
        }

        fun removeLink(id: String) = mutateForm { form -> form.copy(links = form.links.filterNot { it.id == id }) }

        fun updateLink(
            id: String,
            label: String? = null,
            url: String? = null,
        ) = mutateForm { form ->
            form.copy(
                links =
                    form.links.map { link ->
                        if (link.id != id) {
                            link
                        } else {
                            link.copy(
                                label = label ?: link.label,
                                url = url ?: link.url,
                            )
                        }
                    },
            )
        }

        fun attachAvatar(pick: PersonaImagePick) = mutateForm { it.copy(avatarPick = pick) }

        fun attachBanner(pick: PersonaImagePick) = mutateForm { it.copy(bannerPick = pick) }

        fun removeAvatarPick() = mutateForm { it.copy(avatarPick = null) }

        fun removeBannerPick() = mutateForm { it.copy(bannerPick = null) }

        // MARK: - Save

        /**
         * Create or update the Beacon, then push any picked images.
         * [onSaved] fires with the handle only on full success.
         */
        fun save(onSaved: (String) -> Unit = {}) {
            val current = _state.value as? EditPersonaUiState.Editing ?: return
            if (current.isSaving) return
            _savedHandle.value = null

            val form = current.form
            if (form.normalizedHandle.isEmpty() || form.displayName.isBlank()) {
                editing { it.copy(saveError = "Add a handle and display name first.", statusMessage = null) }
                return
            }
            if (form.hasIncompleteLink) {
                editing {
                    it.copy(
                        saveError = "Each public link needs both a label and a URL.",
                        statusMessage = null,
                    )
                }
                return
            }

            editing {
                it.copy(
                    savePhase = EditPersonaSavePhase.Profile,
                    saveError = null,
                    statusMessage = null,
                )
            }

            viewModelScope.launch {
                val writeResult =
                    when (val mode = current.mode) {
                        is EditPersonaMode.Create -> personaEditRepository.createPersona(form.wireBody())
                        is EditPersonaMode.Edit -> personaEditRepository.updatePersona(mode.personaId, form.wireBody())
                    }
                val persona =
                    when (writeResult) {
                        is NetworkResult.Success -> writeResult.data.persona
                        is NetworkResult.Failure -> {
                            editing {
                                it.copy(
                                    savePhase = EditPersonaSavePhase.Idle,
                                    saveError = writeResult.error.message,
                                )
                            }
                            return@launch
                        }
                    }
                if (persona == null) {
                    editing {
                        it.copy(
                            savePhase = EditPersonaSavePhase.Idle,
                            saveError = "Beacon saved, but the server returned no profile.",
                        )
                    }
                    return@launch
                }

                applySaved(persona)
                if (!uploadMedia(persona.id, form)) return@launch

                val saved = _state.value as? EditPersonaUiState.Editing ?: return@launch
                loadedForm = saved.form
                val message = if (current.mode.isCreate) "Beacon created." else "Beacon saved."
                editing {
                    it.copy(
                        savePhase = EditPersonaSavePhase.Idle,
                        statusMessage = message,
                        saveError = null,
                        isDirty = false,
                    )
                }
                _savedHandle.value = saved.form.normalizedHandle
                onSaved(saved.form.normalizedHandle)
            }
        }

        /**
         * Push the picked avatar / banner. Returns false when an upload
         * failed — the profile write already landed, so RN's partial-success
         * copy is surfaced instead of an outright error.
         */
        private suspend fun uploadMedia(
            personaId: String,
            source: EditPersonaForm,
        ): Boolean {
            source.avatarPick?.let { pick ->
                editing { it.copy(savePhase = EditPersonaSavePhase.Avatar) }
                when (val result = uploadRepository.uploadPersonaMedia(personaId, "avatar", pick.asUploadFile())) {
                    is NetworkResult.Success ->
                        mutateForm(markDirty = false) {
                            it.copy(avatarUrl = result.data.url, avatarPick = null)
                        }
                    is NetworkResult.Failure -> {
                        mediaFailed(result.error.message)
                        return false
                    }
                }
            }
            source.bannerPick?.let { pick ->
                editing { it.copy(savePhase = EditPersonaSavePhase.Banner) }
                when (val result = uploadRepository.uploadPersonaMedia(personaId, "banner", pick.asUploadFile())) {
                    is NetworkResult.Success ->
                        mutateForm(markDirty = false) {
                            it.copy(bannerUrl = result.data.url, bannerPick = null)
                        }
                    is NetworkResult.Failure -> {
                        mediaFailed(result.error.message)
                        return false
                    }
                }
            }
            return true
        }

        private fun mediaFailed(message: String?) {
            val saved = _state.value as? EditPersonaUiState.Editing
            if (saved != null) loadedForm = saved.form
            editing {
                it.copy(
                    savePhase = EditPersonaSavePhase.Idle,
                    statusMessage = "Profile details saved. Media still needs attention.",
                    saveError = message ?: "Please try the image upload again.",
                    isDirty = false,
                )
            }
        }

        /**
         * Take the server's normalised persona back into the form, keeping
         * any not-yet-uploaded picks.
         */
        private fun applySaved(persona: PersonaSummaryDto) {
            editing { current ->
                val next =
                    EditPersonaForm.from(persona).copy(
                        avatarPick = current.form.avatarPick,
                        bannerPick = current.form.bannerPick,
                    )
                loadedForm = next
                current.copy(mode = EditPersonaMode.Edit(persona.id), form = next, isDirty = false)
            }
        }

        // MARK: - Helpers

        private fun mutateForm(
            markDirty: Boolean = true,
            transform: (EditPersonaForm) -> EditPersonaForm,
        ) {
            editing { current ->
                val next = transform(current.form)
                current.copy(
                    form = next,
                    isDirty = if (markDirty) next != loadedForm else current.isDirty,
                    statusMessage = if (markDirty) null else current.statusMessage,
                    saveError = if (markDirty) null else current.saveError,
                )
            }
        }

        private fun editing(transform: (EditPersonaUiState.Editing) -> EditPersonaUiState.Editing) {
            _state.update { current ->
                if (current is EditPersonaUiState.Editing) transform(current) else current
            }
        }
    }

/** Randomised filename so the picker's `IMG_xxxx` never reaches S3. */
internal fun PersonaImagePick.asUploadFile(): UploadFile =
    UploadFile(
        filename = fileName.ifBlank { "beacon-${UUID.randomUUID().toString().take(8)}.jpg" },
        mimeType = mimeType,
        bytes = bytes,
    )

internal fun titleCase(value: String): String =
    value
        .replace('_', ' ')
        .split(' ')
        .filter { it.isNotEmpty() }
        .joinToString(" ") { word ->
            word.replaceFirstChar { it.titlecase(Locale.US) }
        }
