@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AIDraftRepository
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.ai.AIDraftPostRequest
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.e164Phone
import app.pantopus.android.ui.screens.shared.form.isoDateOrEmpty
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.optionalLength
import app.pantopus.android.ui.screens.shared.form.required
import app.pantopus.android.ui.screens.shared.form.urlOrEmpty
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Stable identifiers for every editable field in the Edit Profile form.
 * Mirrors the iOS `EditProfileField` enum 1:1 — order matches
 * `updateProfileSchema` (`backend/routes/users.js:324-351`).
 */
enum class EditProfileField(val key: String) {
    // About
    FirstName("firstName"),
    MiddleName("middleName"),
    LastName("lastName"),
    Bio("bio"),
    Tagline("tagline"),

    // Contact
    PhoneNumber("phoneNumber"),
    DateOfBirth("dateOfBirth"),

    // Address
    Address("address"),
    City("city"),
    State("state"),
    Zipcode("zipcode"),

    // Social — backend stores these in the `social_links` jsonb column
    // but accepts them as flat keys on PATCH.
    Website("website"),
    Linkedin("linkedin"),
    Twitter("twitter"),
    Instagram("instagram"),
    Facebook("facebook"),

    // Visibility
    ProfileVisibility("profileVisibility"),

    /**
     * Contact visibility — `"true"` / `"false"` strings so the whole form
     * stays on one [FormFieldState] machinery. Mapped to the booleans
     * `showEmail` / `showPhone` on PATCH (`backend/routes/users.js:2076`).
     */
    ShowEmail("showEmail"),
    ShowPhone("showPhone"),
}

/** Render states for the Edit Profile screen. */
sealed interface EditProfileUiState {
    data object Loading : EditProfileUiState

    data object Loaded : EditProfileUiState

    data class Error(val message: String) : EditProfileUiState
}

/** Tone-tagged transient message surfaced by the form. */
data class EditProfileToast(
    val text: String,
    val isError: Boolean,
)

/**
 * Avatar leg state. Separate from [EditProfileUiState] because the form
 * stays fully usable while a photo uploads, and an upload failure must not
 * blank the form. Mirrors iOS `EditProfileAvatarState`.
 */
sealed interface EditProfileAvatarState {
    data object Idle : EditProfileAvatarState

    data object Uploading : EditProfileAvatarState

    /**
     * Read *and* upload failures land here so the block renders a real
     * error line instead of a silent no-op — a denied/revoked photo grant
     * shows up as an unreadable `Uri`.
     */
    data class Failed(val message: String) : EditProfileAvatarState
}

/**
 * "Generate with AI" leg state for the bio field. Separate from
 * [EditProfileUiState] for the same reason as the avatar: the form stays
 * usable while the draft is in flight, and a failed draft must not blank
 * the bio the user already typed. Mirrors iOS `EditProfileBioDraftState`.
 */
sealed interface EditProfileBioDraftState {
    data object Idle : EditProfileBioDraftState

    data object Generating : EditProfileBioDraftState

    data class Failed(val message: String) : EditProfileBioDraftState
}

/**
 * Backs `EditProfileScreen`. Fetches `GET /api/users/profile`
 * (`backend/routes/users.js:1962`) and submits
 * `PATCH /api/users/profile` (`backend/routes/users.js:2052`). The
 * editable field set is defined by `updateProfileSchema`
 * (`backend/routes/users.js:324-351`) and is mirrored 1:1 by
 * [EditProfileField].
 *
 * The avatar is NOT part of `updateProfileSchema` — it has its own
 * multipart route, `POST /api/upload/profile-picture`
 * (`backend/routes/upload.js:236`), which writes `profile_picture_url`
 * server-side. [uploadAvatar] drives that leg and then refreshes the
 * session user so the new photo appears app-wide (RN
 * `src/app/profile/edit.tsx:75-106`).
 *
 * Skills are the other exception: they live in `UserSkill`, not on
 * `User`, and commit through `PUT /api/users/skills`
 * (`backend/routes/users.js:2246`) in the same [save] as the profile
 * PATCH. The bio's "Generate with AI" action drafts through
 * `POST /api/ai/draft/post` (`backend/routes/ai.js:218`) and writes the
 * result into the bio field, so it rides the PATCH like any typed edit.
 *
 * Note: the design also calls for an editable email when unverified and
 * boolean visibility toggles (`profile_visibility_public` +
 * `show_in_neighbor_discovery`). Neither exists in `updateProfileSchema`
 * today, so those affordances stay omitted on both platforms until the
 * backend adds the keys.
 */
@HiltViewModel
class EditProfileViewModel
    @Inject
    constructor(
        private val repo: ProfileRepository,
        private val uploads: UploadRepository,
        private val authRepository: AuthRepository,
        private val networkMonitor: NetworkMonitor,
        private val aiDraftRepository: AIDraftRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<EditProfileUiState>(EditProfileUiState.Loading)
        val state: StateFlow<EditProfileUiState> = _state.asStateFlow()

        private val _fields =
            MutableStateFlow(
                EditProfileField.entries.associateWith {
                    FormFieldState(id = it.key)
                },
            )
        val fields: StateFlow<Map<EditProfileField, FormFieldState>> = _fields.asStateFlow()

        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        private val _toast = MutableStateFlow<EditProfileToast?>(null)
        val toast: StateFlow<EditProfileToast?> = _toast.asStateFlow()

        private val _shouldDismiss = MutableStateFlow(false)
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        /** Increments on a save attempt whose validation fails — drives
         *  the first-invalid shake on the iOS counterpart. */
        private val _shakeTrigger = MutableStateFlow(0)
        val shakeTrigger: StateFlow<Int> = _shakeTrigger.asStateFlow()

        private val _email = MutableStateFlow("")
        val email: StateFlow<String> = _email.asStateFlow()

        private val _emailVerified = MutableStateFlow(false)
        val emailVerified: StateFlow<Boolean> = _emailVerified.asStateFlow()

        /** Current avatar, replaced in place after a successful upload. */
        private val _avatarUrl = MutableStateFlow<String?>(null)
        val avatarUrl: StateFlow<String?> = _avatarUrl.asStateFlow()

        /** Fallback glyph rendered when there is no avatar yet. */
        private val _avatarInitial = MutableStateFlow("?")
        val avatarInitial: StateFlow<String> = _avatarInitial.asStateFlow()

        private val _avatarState = MutableStateFlow<EditProfileAvatarState>(EditProfileAvatarState.Idle)
        val avatarState: StateFlow<EditProfileAvatarState> = _avatarState.asStateFlow()

        /**
         * Working skill list, saved with `PUT /api/users/skills` next to
         * the profile PATCH. `GET /api/users/profile` returns the list
         * (`backend/routes/users.js:2020`) but `PATCH /api/users/profile`
         * does NOT echo it, so the baseline is seeded on load and
         * re-seeded from the skills PUT — never from the PATCH response.
         */
        private val _skills = MutableStateFlow<List<String>>(emptyList())
        val skills: StateFlow<List<String>> = _skills.asStateFlow()

        /** Last-saved skill list — the dirty baseline for [skills]. */
        private val _savedSkills = MutableStateFlow<List<String>>(emptyList())
        val savedSkills: StateFlow<List<String>> = _savedSkills.asStateFlow()

        /** Text sitting in the add-skill input. */
        private val _skillDraft = MutableStateFlow("")
        val skillDraft: StateFlow<String> = _skillDraft.asStateFlow()

        /** Bio "Generate with AI" leg state. */
        private val _bioDraftState = MutableStateFlow<EditProfileBioDraftState>(EditProfileBioDraftState.Idle)
        val bioDraftState: StateFlow<EditProfileBioDraftState> = _bioDraftState.asStateFlow()

        /**
         * Push a picked image to `POST /api/upload/profile-picture`, then
         * refresh the session user so every avatar in the app flips at once.
         *
         * `bytes == null` means the picker handed back a `Uri` we couldn't
         * open — a revoked/denied media grant or a Drive-backed file that
         * won't materialise. That is surfaced as a real error state, never a
         * silent no-op.
         */
        fun uploadAvatar(
            bytes: ByteArray?,
            filename: String,
            mimeType: String,
        ) {
            if (_avatarState.value is EditProfileAvatarState.Uploading) return
            if (bytes == null || bytes.isEmpty()) {
                _avatarState.value =
                    EditProfileAvatarState.Failed(
                        "Couldn't read that photo. Check photo access for Pantopus and try again.",
                    )
                _toast.value = EditProfileToast("Couldn't read that photo.", isError = true)
                return
            }
            if (!networkMonitor.isOnline.value) {
                val message = "You're offline. Try again when you're back online."
                _avatarState.value = EditProfileAvatarState.Failed(message)
                _toast.value = EditProfileToast(message, isError = true)
                return
            }
            _avatarState.value = EditProfileAvatarState.Uploading
            val payload = UploadFile(filename = filename, mimeType = mimeType, bytes = bytes)
            viewModelScope.launch {
                when (val result = uploads.uploadProfilePicture(payload)) {
                    is NetworkResult.Success -> {
                        _avatarUrl.value = result.data.user?.profilePictureUrl ?: result.data.url
                        _avatarState.value = EditProfileAvatarState.Idle
                        _toast.value = EditProfileToast("Profile photo updated.", isError = false)
                        authRepository.refreshSessionUser()
                    }
                    is NetworkResult.Failure -> {
                        val message = result.error.message.ifBlank { "Couldn't upload that photo." }
                        _avatarState.value = EditProfileAvatarState.Failed(message)
                        _toast.value = EditProfileToast(message, isError = true)
                    }
                }
            }
        }

        /** Clear a failed upload so the block returns to its resting pose. */
        fun dismissAvatarError() {
            if (_avatarState.value is EditProfileAvatarState.Failed) {
                _avatarState.value = EditProfileAvatarState.Idle
            }
        }

        val aggregate: FormAggregate
            get() = FormAggregate.from(EditProfileField.entries.mapNotNull { _fields.value[it] })

        val isValid: Boolean get() = aggregate.isValid

        /** Skills ride their own PUT, so they widen the form's dirty state
         *  without appearing in [aggregate]. */
        val isDirty: Boolean get() = aggregate.isDirty || isSkillsDirty

        /** True when the working skill list differs from the last-saved one. */
        val isSkillsDirty: Boolean get() = _skills.value != _savedSkills.value

        /** The skill list counts as one dirty field on the sticky pill. */
        val dirtyFieldCount: Int
            get() = _fields.value.values.count { it.isDirty } + if (isSkillsDirty) 1 else 0

        /** Whether the add-skill CTA can fire — an empty input or a full
         *  list would only produce a no-op or a server rejection. */
        val canAddSkill: Boolean
            get() = _skillDraft.value.trim().isNotEmpty() && _skills.value.size < MAX_SKILLS

        /** Whether "Generate with AI" can fire. False while a draft is in
         *  flight and false when the form carries nothing to prompt with —
         *  a CTA the route would refuse must not be tappable. */
        val canGenerateBio: Boolean
            get() = _bioDraftState.value !is EditProfileBioDraftState.Generating && bioPrompt().isNotEmpty()

        /** Idempotent — refuses to refetch when already loaded. */
        fun load() {
            if (_state.value is EditProfileUiState.Loaded) return
            _state.value = EditProfileUiState.Loading
            viewModelScope.launch {
                when (val result = repo.ownProfile()) {
                    is NetworkResult.Success -> {
                        hydrate(result.data.user)
                        // Seeded here rather than in `hydrate`: the PATCH
                        // echo carries no `skills` key
                        // (`backend/routes/users.js:2194`), so hydrating
                        // skills there would blank the list after a save.
                        _skills.value = result.data.user.skills.orEmpty()
                        _savedSkills.value = _skills.value
                        _state.value = EditProfileUiState.Loaded
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            EditProfileUiState.Error(
                                result.error.message.ifBlank { "Couldn't load profile." },
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        fun update(
            field: EditProfileField,
            value: String,
        ) {
            val map = _fields.value.toMutableMap()
            val snapshot = map[field] ?: FormFieldState(id = field.key)
            map[field] =
                snapshot.copy(
                    value = value,
                    touched = true,
                    error = validator(field).validate(value),
                )
            _fields.value = map
        }

        fun dismissToast() {
            _toast.value = null
        }

        /** Text change on the add-skill input. */
        fun updateSkillDraft(value: String) {
            _skillDraft.value = value
        }

        /**
         * Commit the add-skill input to the working list. Mirrors the web
         * editor (`frontend/apps/web/src/hooks/useProfileForm.ts:233`) and
         * pre-applies the route's own trim / dedupe / cap rules so the CTA
         * never sends something the server would reject.
         */
        fun addSkill() {
            val trimmed = _skillDraft.value.trim()
            if (trimmed.isEmpty()) return
            if (trimmed.length > MAX_SKILL_LENGTH) {
                _toast.value = EditProfileToast("Skills are capped at $MAX_SKILL_LENGTH characters.", isError = true)
                return
            }
            if (_skills.value.size >= MAX_SKILLS) {
                _toast.value = EditProfileToast("You can list up to $MAX_SKILLS skills.", isError = true)
                return
            }
            // The route dedupes exactly; we match case-insensitively so the
            // chip row doesn't show "Plumbing" and "plumbing" side by side.
            if (_skills.value.none { it.equals(trimmed, ignoreCase = true) }) {
                _skills.value = _skills.value + trimmed
            }
            _skillDraft.value = ""
        }

        /** Drop one skill from the working list (tap-to-remove on the chip). */
        fun removeSkill(skill: String) {
            _skills.value = _skills.value.filterNot { it == skill }
        }

        fun discardChanges() {
            val map = _fields.value.toMutableMap()
            for (field in EditProfileField.entries) {
                val snapshot = map[field] ?: continue
                map[field] =
                    snapshot.copy(
                        value = snapshot.originalValue,
                        touched = false,
                        error = validator(field).validate(snapshot.originalValue),
                    )
            }
            _fields.value = map
            _skills.value = _savedSkills.value
            _skillDraft.value = ""
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        /** Run every validator. Returns the first invalid field, if any. */
        fun validateAll(): EditProfileField? {
            var firstInvalid: EditProfileField? = null
            val map = _fields.value.toMutableMap()
            for (field in EditProfileField.entries) {
                val snapshot = map[field] ?: FormFieldState(id = field.key)
                val message = validator(field).validate(snapshot.value)
                map[field] = snapshot.copy(error = message, touched = true)
                if (firstInvalid == null && message != null) firstInvalid = field
            }
            _fields.value = map
            return firstInvalid
        }

        fun save() {
            if (_isSaving.value) return
            val invalid = validateAll()
            if (invalid != null) {
                _shakeTrigger.value = _shakeTrigger.value + 1
                _toast.value = EditProfileToast("Fix the highlighted field.", isError = true)
                Analytics.track(AnalyticsEvent.FormEditProfileValidationError(field = invalid.key))
                return
            }
            val fieldsDirty = aggregate.isDirty
            val skillsDirty = isSkillsDirty
            if (!fieldsDirty && !skillsDirty) return
            if (!networkMonitor.isOnline.value) {
                // P15: don't silently queue. Surface the error inline.
                _toast.value =
                    EditProfileToast(
                        "You're offline. Try again when you're back online.",
                        isError = true,
                    )
                Analytics.track(AnalyticsEvent.FormEditProfileSubmit(result = AnalyticsResult.ERROR))
                return
            }
            _isSaving.value = true
            viewModelScope.launch {
                // The two legs are independent on the wire, so each
                // re-baselines itself the moment it lands: a failure on one
                // never discards the other's edits, and a retry re-sends
                // only what is still dirty.
                var failure: String? = null
                if (fieldsDirty) {
                    when (val result = repo.updateProfile(buildRequest())) {
                        is NetworkResult.Success -> hydrate(result.data.user)
                        is NetworkResult.Failure ->
                            failure = result.error.message.ifBlank { "Couldn't save profile." }
                    }
                }
                if (skillsDirty) {
                    when (val result = repo.updateSkills(_skills.value)) {
                        is NetworkResult.Success -> {
                            // The route trims, dedupes and caps the list,
                            // then echoes the cleaned array — so the echo,
                            // not the local list, becomes the new baseline.
                            _skills.value = result.data.skills
                            _savedSkills.value = result.data.skills
                        }
                        is NetworkResult.Failure ->
                            failure = failure ?: result.error.message.ifBlank { "Couldn't save skills." }
                    }
                }
                val message = failure
                if (message != null) {
                    _toast.value = EditProfileToast(message, isError = true)
                    Analytics.track(AnalyticsEvent.FormEditProfileSubmit(result = AnalyticsResult.ERROR))
                } else {
                    _toast.value = EditProfileToast("Profile updated.", isError = false)
                    _shouldDismiss.value = true
                    Analytics.track(AnalyticsEvent.FormEditProfileSubmit(result = AnalyticsResult.SUCCESS))
                }
                _isSaving.value = false
            }
        }

        /**
         * Draft a bio through `POST /api/ai/draft/post` and write the
         * result into the bio field, where it stays dirty-tracked and
         * rides the existing profile PATCH. The prompt is composed only
         * from what the user already entered — name, skills, tagline, city.
         */
        fun generateBio() {
            if (_bioDraftState.value is EditProfileBioDraftState.Generating) return
            val prompt = bioPrompt()
            if (prompt.isEmpty()) {
                _bioDraftState.value =
                    EditProfileBioDraftState.Failed(
                        "Add your name, tagline, city or a skill first so the draft has something to work from.",
                    )
                return
            }
            if (!networkMonitor.isOnline.value) {
                _bioDraftState.value =
                    EditProfileBioDraftState.Failed("You're offline. Try again when you're back online.")
                return
            }
            _bioDraftState.value = EditProfileBioDraftState.Generating
            viewModelScope.launch {
                when (val result = aiDraftRepository.draftPost(AIDraftPostRequest(text = prompt))) {
                    is NetworkResult.Success -> {
                        val content = result.data.draft.content.trim()
                        if (content.isEmpty()) {
                            _bioDraftState.value =
                                EditProfileBioDraftState.Failed("The draft came back empty. Try again.")
                        } else {
                            // `update` re-runs the bio validator (max 2000,
                            // per `updateProfileSchema`) and marks it dirty.
                            update(EditProfileField.Bio, content)
                            _bioDraftState.value = EditProfileBioDraftState.Idle
                        }
                    }
                    is NetworkResult.Failure ->
                        _bioDraftState.value =
                            EditProfileBioDraftState.Failed(
                                result.error.message.ifBlank { "Couldn't draft a bio. Try again." },
                            )
                }
            }
        }

        /** Clear a failed draft so the row returns to its resting pose. */
        fun dismissBioDraftError() {
            if (_bioDraftState.value is EditProfileBioDraftState.Failed) {
                _bioDraftState.value = EditProfileBioDraftState.Idle
            }
        }

        /**
         * Compose the draft prompt from the fields the user already
         * filled. Returns "" when there is nothing to work with, so
         * [canGenerateBio] can keep the CTA disabled instead of sending an
         * empty prompt the route's `min(1)` rule would 400 on.
         */
        fun bioPrompt(): String {
            fun value(field: EditProfileField): String = _fields.value[field]?.value.orEmpty().trim()

            val name =
                listOf(value(EditProfileField.FirstName), value(EditProfileField.LastName))
                    .filter { it.isNotEmpty() }
                    .joinToString(" ")
            val lines = mutableListOf<String>()
            if (name.isNotEmpty()) lines += "Name: $name"
            value(EditProfileField.Tagline).takeIf { it.isNotEmpty() }?.let { lines += "Tagline: $it" }
            value(EditProfileField.City).takeIf { it.isNotEmpty() }?.let { lines += "City: $it" }
            if (_skills.value.isNotEmpty()) lines += "Skills: ${_skills.value.joinToString(", ")}"
            if (lines.isEmpty()) return ""
            val instruction = "Write a short first-person profile bio (2-3 sentences) for this neighbor."
            return (listOf(instruction) + lines).joinToString("\n").take(MAX_BIO_PROMPT_LENGTH)
        }

        private fun hydrate(profile: UserProfile) {
            _email.value = profile.email
            _emailVerified.value = profile.verified
            // A just-uploaded avatar wins over the PATCH echo: `PATCH
            // /api/users/profile` never touches `profile_picture_url`, so a
            // stale row would otherwise flip the block back to initials.
            if (_avatarUrl.value == null) {
                _avatarUrl.value = profile.profilePictureUrl ?: profile.avatarUrl
            }
            _avatarInitial.value = displayInitial(profile.firstName, profile.name, profile.username)
            seed(EditProfileField.FirstName, profile.firstName)
            seed(EditProfileField.MiddleName, profile.middleName.orEmpty())
            seed(EditProfileField.LastName, profile.lastName)
            seed(EditProfileField.Bio, profile.bio.orEmpty())
            seed(EditProfileField.Tagline, profile.tagline.orEmpty())
            seed(EditProfileField.PhoneNumber, profile.phoneNumber.orEmpty())
            seed(EditProfileField.DateOfBirth, profile.dateOfBirth.orEmpty())
            seed(EditProfileField.Address, profile.address.orEmpty())
            seed(EditProfileField.City, profile.city.orEmpty())
            seed(EditProfileField.State, profile.state.orEmpty())
            seed(EditProfileField.Zipcode, profile.zipcode.orEmpty())
            seed(EditProfileField.Website, profile.socialLinks?.website.orEmpty())
            seed(EditProfileField.Linkedin, profile.socialLinks?.linkedin.orEmpty())
            seed(EditProfileField.Twitter, profile.socialLinks?.twitter.orEmpty())
            seed(EditProfileField.Instagram, profile.socialLinks?.instagram.orEmpty())
            seed(EditProfileField.Facebook, profile.socialLinks?.facebook.orEmpty())
            seed(EditProfileField.ProfileVisibility, profile.profileVisibility ?: "public")
            seed(EditProfileField.ShowEmail, boolString(profile.showEmail))
            seed(EditProfileField.ShowPhone, boolString(profile.showPhone))
        }

        private fun seed(
            field: EditProfileField,
            value: String,
        ) {
            val error = validator(field).validate(value)
            val map = _fields.value.toMutableMap()
            map[field] =
                FormFieldState(
                    id = field.key,
                    value = value,
                    originalValue = value,
                    touched = false,
                    error = error,
                )
            _fields.value = map
        }

        private fun validator(field: EditProfileField): FormValidator = VALIDATORS[field] ?: FormValidator { null }

        /**
         * Assemble a PATCH body containing only the dirty fields. Empty
         * strings are kept for fields whose schema entry has
         * `.allow('', null)` so the user can clear them; non-nullable
         * fields are skipped when blank so the server doesn't reject the
         * call.
         */
        private fun buildRequest(): ProfileUpdateRequest {
            val map = _fields.value

            fun trimmed(field: EditProfileField): String? {
                val snapshot = map[field] ?: return null
                if (!snapshot.isDirty) return null
                val text = snapshot.value.trim()
                if (text.isEmpty() && field !in ALLOWS_EMPTY) return null
                return text
            }

            /** Boolean-backed field → `true` only when it was actually toggled. */
            fun boolean(field: EditProfileField): Boolean? {
                val snapshot = map[field] ?: return null
                if (!snapshot.isDirty) return null
                return snapshot.value == "true"
            }
            return ProfileUpdateRequest(
                firstName = trimmed(EditProfileField.FirstName),
                middleName = trimmed(EditProfileField.MiddleName),
                lastName = trimmed(EditProfileField.LastName),
                phoneNumber = trimmed(EditProfileField.PhoneNumber),
                address = trimmed(EditProfileField.Address),
                city = trimmed(EditProfileField.City),
                state = trimmed(EditProfileField.State),
                zipcode = trimmed(EditProfileField.Zipcode),
                dateOfBirth = trimmed(EditProfileField.DateOfBirth),
                bio = trimmed(EditProfileField.Bio),
                tagline = trimmed(EditProfileField.Tagline),
                profileVisibility = trimmed(EditProfileField.ProfileVisibility),
                showEmail = boolean(EditProfileField.ShowEmail),
                showPhone = boolean(EditProfileField.ShowPhone),
                website = trimmed(EditProfileField.Website),
                linkedin = trimmed(EditProfileField.Linkedin),
                twitter = trimmed(EditProfileField.Twitter),
                instagram = trimmed(EditProfileField.Instagram),
                facebook = trimmed(EditProfileField.Facebook),
            )
        }

        companion object {
            /** `PUT /api/users/skills` caps the list at 50 entries and each
             *  entry at 100 characters (`backend/routes/users.js:2256-2263`). */
            const val MAX_SKILLS = 50
            const val MAX_SKILL_LENGTH = 100

            /** Joi `draftPostSchema` caps `text` at 2000 (`backend/routes/ai.js:82`). */
            const val MAX_BIO_PROMPT_LENGTH = 2000

            /**
             * First glyph of the best available display name — matches the RN
             * `displayInitial` fallback on the avatar circle and the iOS
             * `EditProfileViewModel.initial(...)` helper.
             */
            fun displayInitial(
                firstName: String,
                name: String,
                username: String,
            ): String =
                listOf(firstName, name, username)
                    .firstNotNullOfOrNull { it.trim().firstOrNull() }
                    ?.uppercaseChar()
                    ?.toString()
                    ?: "?"

            /** Fields whose Joi declaration allows `''` / `null`. */
            private val ALLOWS_EMPTY: Set<EditProfileField> =
                setOf(
                    EditProfileField.MiddleName,
                    EditProfileField.Bio,
                    EditProfileField.Tagline,
                    EditProfileField.DateOfBirth,
                    EditProfileField.Website,
                    EditProfileField.Linkedin,
                    EditProfileField.Twitter,
                    EditProfileField.Instagram,
                    EditProfileField.Facebook,
                )

            /** Validators keyed by field — mirrors iOS exactly. */
            private val VALIDATORS: Map<EditProfileField, FormValidator> =
                mapOf(
                    EditProfileField.FirstName to
                        FormValidator.all(
                            listOf(FormValidator.required("First name"), FormValidator.maxLength(255)),
                        ),
                    EditProfileField.LastName to
                        FormValidator.all(
                            listOf(FormValidator.required("Last name"), FormValidator.maxLength(255)),
                        ),
                    EditProfileField.MiddleName to
                        FormValidator.optionalLength("Middle name", min = 1, max = 255),
                    EditProfileField.Bio to FormValidator.maxLength(2000),
                    EditProfileField.Tagline to FormValidator.maxLength(255),
                    EditProfileField.PhoneNumber to FormValidator.e164Phone(),
                    EditProfileField.DateOfBirth to FormValidator.isoDateOrEmpty(),
                    EditProfileField.Address to FormValidator.optionalLength("Address", min = 5, max = 255),
                    EditProfileField.City to FormValidator.optionalLength("City", min = 2, max = 100),
                    EditProfileField.State to FormValidator.optionalLength("State", min = 2, max = 50),
                    EditProfileField.Zipcode to FormValidator.optionalLength("Zipcode", min = 3, max = 20),
                    EditProfileField.Website to FormValidator.urlOrEmpty(),
                    EditProfileField.Linkedin to FormValidator.urlOrEmpty(),
                    EditProfileField.Twitter to FormValidator.urlOrEmpty(),
                    EditProfileField.Instagram to FormValidator.urlOrEmpty(),
                    EditProfileField.Facebook to FormValidator.urlOrEmpty(),
                    EditProfileField.ProfileVisibility to
                        FormValidator { value ->
                            if (value in VISIBILITY_OPTIONS) null else "Pick a visibility option."
                        },
                    // Boolean-backed toggles — the only invalid state is an
                    // unseeded field, which the loader never produces.
                    EditProfileField.ShowEmail to
                        FormValidator { value -> if (value in BOOL_OPTIONS) null else "Pick an option." },
                    EditProfileField.ShowPhone to
                        FormValidator { value -> if (value in BOOL_OPTIONS) null else "Pick an option." },
                )

            internal val VISIBILITY_OPTIONS: List<String> = listOf("public", "registered", "private")

            private val BOOL_OPTIONS: List<String> = listOf("true", "false")

            /**
             * Bridge between the string-valued form machinery and the two
             * boolean contact-visibility keys. Mirrors the iOS
             * `EditProfileViewModel.boolString(_:)`.
             */
            fun boolString(value: Boolean?): String = if (value == true) "true" else "false"
        }
    }
