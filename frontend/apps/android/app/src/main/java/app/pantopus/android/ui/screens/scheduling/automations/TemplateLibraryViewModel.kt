@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateMessageTemplateRequest
import app.pantopus.android.data.api.models.scheduling.MessageTemplateDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val TOAST_MS = 1700L

/**
 * Stream A16 — H8 Message Template Library. Browse + reuse message templates: a
 * read-only "Starter templates" card (client-side seeds the user can duplicate
 * into real rows) and a "My templates" card from `GET /message-templates`.
 * Duplicate seeds/own rows POST a real copy; delete removes a row. New / edit
 * route to the H5 editor.
 */
@HiltViewModel
class TemplateLibraryViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        // Owner comes from the route's ownerKind/ownerId args (threaded by the
        // settings root); Personal when absent.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )
        val pillar: SchedulingPillar = owner.pillar()

        val starters: List<StarterTemplate> = StarterTemplate.all

        private val _state = MutableStateFlow<TemplateLibraryUiState>(TemplateLibraryUiState.Loading)
        val state: StateFlow<TemplateLibraryUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        /** True while a pull-to-refresh refetch is in flight (drives the indicator). */
        private val _isRefreshing = MutableStateFlow(false)
        val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

        private val needle: String get() = _query.value.trim().lowercase()

        val visibleStarters: List<StarterTemplate>
            get() =
                if (needle.isEmpty()) {
                    starters
                } else {
                    starters.filter { it.name.lowercase().contains(needle) || it.body.lowercase().contains(needle) }
                }

        val visibleTemplates: List<MessageTemplateDto>
            get() {
                val templates = (_state.value as? TemplateLibraryUiState.Loaded)?.templates ?: emptyList()
                return if (needle.isEmpty()) {
                    templates
                } else {
                    templates.filter {
                        it.name.lowercase().contains(needle) || (it.body ?: "").lowercase().contains(needle)
                    }
                }
            }

        fun load() {
            if (_state.value !is TemplateLibraryUiState.Loaded) _state.value = TemplateLibraryUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getMessageTemplates(owner)) {
                    is NetworkResult.Success ->
                        _state.value = TemplateLibraryUiState.Loaded(result.data.templates)
                    is NetworkResult.Failure ->
                        _state.value = TemplateLibraryUiState.Error(errors.decode(result.error).loadMessage())
                }
                _isRefreshing.value = false
            }
        }

        /** Refetch keeping Loaded content on screen (pull-to-refresh). */
        fun refresh() {
            if (_state.value is TemplateLibraryUiState.Loaded) _isRefreshing.value = true
            load()
        }

        fun setQuery(value: String) {
            _query.value = value
        }

        fun clearActionError() {
            _actionError.value = null
        }

        // Navigation route builders.
        fun createNewRoute(): String = SchedulingRoutes.messageTemplateEditor("new", owner.routeKind, owner.ownerRouteId)

        fun templateRoute(id: String): String = SchedulingRoutes.messageTemplateEditor(id, owner.routeKind, owner.ownerRouteId)

        // ── Mutations ──────────────────────────────────────────────────────────

        fun duplicateStarter(starter: StarterTemplate) =
            mutate("Added to your templates") {
                CreateMessageTemplateRequest(
                    name = starter.name,
                    body = starter.body,
                    channel = starter.channel.wire,
                    subject = starter.subject,
                )
            }

        fun duplicate(template: MessageTemplateDto) =
            mutate("Template duplicated") {
                CreateMessageTemplateRequest(
                    name = "${template.name} (copy)",
                    body = template.body.orEmpty(),
                    channel = template.channel,
                    subject = template.subject,
                )
            }

        private fun mutate(
            toastText: String,
            build: () -> CreateMessageTemplateRequest,
        ) {
            viewModelScope.launch {
                when (val result = repo.createMessageTemplate(owner, build())) {
                    is NetworkResult.Success -> {
                        reloadTemplates()
                        flashToast(toastText)
                    }
                    is NetworkResult.Failure ->
                        _actionError.value = errors.decode(result.error).actionMessage()
                }
            }
        }

        fun confirmDelete(template: MessageTemplateDto) {
            viewModelScope.launch {
                when (val result = repo.deleteMessageTemplate(owner, template.id)) {
                    is NetworkResult.Success -> {
                        reloadTemplates()
                        flashToast("Template deleted")
                    }
                    is NetworkResult.Failure ->
                        _actionError.value = errors.decode(result.error).deleteMessage()
                }
            }
        }

        private suspend fun reloadTemplates() {
            when (val result = repo.getMessageTemplates(owner)) {
                is NetworkResult.Success -> _state.value = TemplateLibraryUiState.Loaded(result.data.templates)
                is NetworkResult.Failure -> Unit // keep the existing list; the toast still confirms the action
            }
        }

        private fun flashToast(text: String) {
            viewModelScope.launch {
                _toast.value = text
                delay(TOAST_MS)
                _toast.value = null
            }
        }

        private fun SchedulingError.loadMessage(): String = (this as? SchedulingError.Generic)?.message ?: "Couldn't load your templates."

        private fun SchedulingError.actionMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Something went wrong. Please try again."

        private fun SchedulingError.deleteMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Couldn't delete this template."
    }

@Immutable
sealed interface TemplateLibraryUiState {
    data object Loading : TemplateLibraryUiState

    data class Loaded(val templates: List<MessageTemplateDto>) : TemplateLibraryUiState

    data class Error(val message: String) : TemplateLibraryUiState
}
