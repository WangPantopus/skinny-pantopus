@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes.search

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.accesscodes.AccessCategory
import app.pantopus.android.ui.screens.homes.accesscodes.AccessCodesViewModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P4.6 — Access codes search. Mirrors iOS `AccessCodesSearchViewModel`.
 * Reuses the shared `SearchListShell`; the only per-surface customization
 * is the client-side filter (label / notes / category — never the secret
 * value) and the row template (type tile + label + masked value +
 * chevron). Values stay masked in the transient search surface — tapping
 * a result opens the code's editor where it can be revealed and copied.
 */
@HiltViewModel
class AccessCodesSearchViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String =
            savedStateHandle.get<String>(HOME_ID_KEY)
                ?: error("AccessCodesSearchViewModel requires a homeId in SavedStateHandle")

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _isLoading = MutableStateFlow(false)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private val _error = MutableStateFlow<String?>(null)
        val error: StateFlow<String?> = _error.asStateFlow()

        private val _results = MutableStateFlow<List<HomeAccessSecretDto>>(emptyList())
        val results: StateFlow<List<HomeAccessSecretDto>> = _results.asStateFlow()

        private var corpus: List<HomeAccessSecretDto> = emptyList()
        private var loadedOnce = false
        private var active = true
        private var generation = 0
        private var readJob: Job? = null

        /** Routing callback wired by the screen before [load]. */
        var onOpenCode: (String) -> Unit = {}

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun resume() {
            active = true
            reload()
        }

        fun pause() {
            active = false
            generation++
            readJob?.cancel()
            corpus = emptyList()
            _results.value = emptyList()
            _isLoading.value = false
            _error.value = null
        }

        fun retry() = reload()

        fun setQuery(value: String) {
            _query.value = value
            recompute()
        }

        private fun reload() {
            if (!active) return
            val request = ++generation
            readJob?.cancel()
            corpus = emptyList()
            _results.value = emptyList()
            _isLoading.value = true
            _error.value = null
            readJob = viewModelScope.launch {
                val result = repo.getHomeAccessSecrets(homeId)
                if (!active || generation != request) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        corpus = result.data.secrets
                        loadedOnce = true
                    }
                    is NetworkResult.Failure -> _error.value = "Couldn't load access codes. Try again."
                }
                _isLoading.value = false
                recompute()
            }
        }

        private fun recompute() {
            val needle = _query.value.trim().lowercase()
            _results.value =
                if (needle.isEmpty()) {
                    emptyList()
                } else {
                    corpus.filter { searchableText(it).contains(needle) }
                }
        }

        // ─── Filtering ─────────────────────────────────────────────

        private fun searchableText(secret: HomeAccessSecretDto): String =
            listOfNotNull(
                secret.label,
                secret.notes,
                AccessCategory.from(secret.accessType).label,
            ).joinToString(" ").lowercase()

        // ─── Row mapping ───────────────────────────────────────────

        /**
         * Mirrors the Access codes list row visual (category tile + label +
         * masked value) but with a drill-in chevron: search is a find-then-
         * open surface, so the reveal + copy live on the editor it pushes
         * to, keeping secrets masked in the transient results list.
         */
        fun rowFor(secret: HomeAccessSecretDto): RowModel {
            val category = AccessCategory.from(secret.accessType)
            return RowModel(
                id = secret.id,
                title = secret.label,
                subtitle = AccessCodesViewModel.mask(secret.secretValue),
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.TypeIcon(
                        icon = category.icon,
                        background = category.background,
                        foreground = category.foreground,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = { if (active && corpus.any { it.id == secret.id }) onOpenCode(secret.id) },
                body = secret.notes,
            )
        }

        companion object {
            const val HOME_ID_KEY = "homeId"
        }
    }
