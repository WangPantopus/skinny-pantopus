package app.pantopus.android.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.identity.LocalProfileUpdateRequest
import app.pantopus.android.data.api.models.identity.OwnLocalProfileResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.identity.LocalProfileRepository
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * How neighbors see you, at the top of Privacy: the name and photo other people see on your posts, comments, chats,
 * tasks and notices (your Local Profile). Your account name stays private. A name or photo chosen here stays when you
 * edit your account; one that is still your account's moves with it (backend `syncLocalProfileFromAccount`).
 *
 * Reads and writes `GET`/`PATCH /api/local-profiles/me`; a new photo goes through
 * `POST /api/upload/local-profile-picture`. Copy and test tags mirror iOS `NeighborsSeeYouViewModel` word for word.
 */
@HiltViewModel
class NeighborsSeeYouViewModel
    @Inject
    constructor(
        private val repository: LocalProfileRepository,
    ) : ViewModel() {
        sealed interface UiState {
            data object Loading : UiState

            data class Loaded(
                val view: OwnLocalProfileResponse,
            ) : UiState

            data object Failed : UiState

            /** The server keeps no Local Profiles (identity firewall off): no card. */
            data object Unavailable : UiState
        }

        enum class Busy { Name, Photo }

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        /** The name field. It follows the saved name until edited. */
        private val _nameText = MutableStateFlow("")
        val nameText: StateFlow<String> = _nameText.asStateFlow()

        private val _nameError = MutableStateFlow<String?>(null)
        val nameError: StateFlow<String?> = _nameError.asStateFlow()

        private val _busy = MutableStateFlow<Busy?>(null)
        val busy: StateFlow<Busy?> = _busy.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        private val loaded: OwnLocalProfileResponse?
            get() = (_state.value as? UiState.Loaded)?.view

        /** First load, and again when your profile changed (an account edit can move a copy). */
        fun load() {
            viewModelScope.launch {
                when (val result = repository.me()) {
                    is NetworkResult.Success -> apply(result.data)
                    is NetworkResult.Failure ->
                        when {
                            result.error is NetworkError.NotFound -> _state.value = UiState.Unavailable
                            // A refresh that fails keeps what is shown.
                            loaded == null -> _state.value = UiState.Failed
                        }
                }
            }
        }

        fun retry() {
            _state.value = UiState.Loading
            load()
        }

        fun editName(text: String) {
            _nameText.value = text
            _nameError.value = null
        }

        fun saveName() {
            val name = normalizedName(_nameText.value)
            when {
                name.isEmpty() -> _nameError.value = "Enter the name neighbors should see."
                name.length > NAME_LIMIT -> _nameError.value = "Use 255 characters or fewer."
                else -> saveName(name)
            }
        }

        fun useAccountName() {
            loaded?.account?.displayName?.let(::saveName)
        }

        fun uploadPhoto(
            bytes: ByteArray?,
            filename: String,
            mimeType: String,
        ) {
            if (bytes == null) {
                _toast.value = ToastMessage("We couldn't read that photo. Try another one.", ToastKind.Error)
                return
            }
            changePhoto("Neighbors now see your new photo") {
                repository.uploadPhoto(UploadFile(filename = filename, mimeType = mimeType, bytes = bytes))
            }
        }

        fun useAccountPhoto() {
            val url = loaded?.account?.avatarUrl ?: return
            changePhoto("Neighbors now see your account photo") {
                repository.update(LocalProfileUpdateRequest(photo = LocalProfileUpdateRequest.Photo.Url(url)))
            }
        }

        fun removePhoto() {
            changePhoto("Neighbors now see your initials") {
                repository.update(LocalProfileUpdateRequest(photo = LocalProfileUpdateRequest.Photo.None))
            }
        }

        fun consumeToast() {
            _toast.value = null
        }

        private fun saveName(name: String) {
            if (_busy.value != null) return
            _busy.value = Busy.Name
            _nameError.value = null
            viewModelScope.launch {
                when (val result = repository.update(LocalProfileUpdateRequest(displayName = name))) {
                    is NetworkResult.Success -> {
                        _nameText.value = result.data.profile.displayName
                        apply(result.data)
                        _toast.value =
                            ToastMessage("Neighbors now see you as ${result.data.profile.displayName}", ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        _nameError.value = result.error.displayMessage("Couldn't save the name. Please try again.")
                }
                _busy.value = null
            }
        }

        private fun changePhoto(
            success: String,
            change: suspend () -> NetworkResult<OwnLocalProfileResponse>,
        ) {
            if (_busy.value != null) return
            _busy.value = Busy.Photo
            viewModelScope.launch {
                when (val result = change()) {
                    is NetworkResult.Success -> {
                        apply(result.data)
                        _toast.value = ToastMessage(success, ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        _toast.value =
                            ToastMessage(result.error.displayMessage("Couldn't change the photo. Please try again."), ToastKind.Error)
                }
                _busy.value = null
            }
        }

        /** Shows a reply; the field follows the saved name unless it holds an edit. */
        private fun apply(view: OwnLocalProfileResponse) {
            val previous = loaded
            if (previous == null || _nameText.value == previous.profile.displayName) {
                _nameText.value = view.profile.displayName
            }
            _state.value = UiState.Loaded(view)
        }

        companion object {
            /** The account name rules (Edit profile): at most 255 characters. */
            const val NAME_LIMIT = 255

            /** The typed name as it would be saved: spaces as in an account name. */
            fun normalizedName(text: String): String = text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")

            fun nameNote(view: OwnLocalProfileResponse): String =
                if (view.followsAccount.displayName) {
                    "Same as your account name: it changes when you change your name in Edit profile."
                } else {
                    "Only for neighbors: changing your account name won't change it."
                }

            fun photoNote(view: OwnLocalProfileResponse): String =
                when {
                    view.profile.avatarUrl == null && view.account.avatarUrl == null -> "No photo: neighbors see your initials."
                    view.profile.avatarUrl == null -> "No photo: neighbors see your initials, not your account photo."
                    view.followsAccount.avatarUrl -> "Your account photo: it changes when you change it in Edit profile."
                    else -> "A photo just for neighbors: changing your account photo won't change it."
                }
        }
    }
