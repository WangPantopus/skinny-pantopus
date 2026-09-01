@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.pets

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailSize
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PetSpecies
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav arg key for the home id consumed via [SavedStateHandle]. */
const val PETS_LIST_HOME_ID_KEY = "homeId"

/**
 * Surfaced to the screen so it can present sheets / confirms in response
 * to row interactions without the VM holding view state.
 */
sealed interface PetsListEvent {
    data object OpenAdd : PetsListEvent

    data class OpenEdit(
        val pet: PetDto,
    ) : PetsListEvent

    data class ConfirmDelete(
        val petId: String,
        val name: String,
    ) : PetsListEvent
}

/**
 * Drives the T5.2.1 Pets list. Reads `GET /api/homes/:id/pets` and
 * projects each [PetDto] onto a [RowModel] using shape **E** (64dp
 * rounded-square thumbnail leading + inline species chip + breed
 * subtitle + notes preview + kebab trailing).
 *
 * Mirrors iOS `PetsListViewModel` exactly — same fab variant, same row
 * mapping, same optimistic-delete + rollback shape.
 */
@HiltViewModel
class PetsListViewModel
    @Inject
    constructor(
        private val repo: HomePetsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = savedStateHandle[PETS_LIST_HOME_ID_KEY] ?: ""

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _pendingEvent = MutableStateFlow<PetsListEvent?>(null)
        val pendingEvent: StateFlow<PetsListEvent?> = _pendingEvent.asStateFlow()

        /** Cached list — drives row mappers and optimistic-delete rollback. */
        private var pets: List<PetDto> = emptyList()

        /** Idempotent — re-running won't refetch once content is loaded. */
        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && pets.isNotEmpty()) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        /** Backend doesn't paginate /pets. */
        fun loadMoreIfNeeded() = Unit

        /** Screen calls this after dispatching a pending event. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Fired by the FAB / empty CTA. */
        fun requestAdd() {
            _pendingEvent.value = PetsListEvent.OpenAdd
        }

        /** Fab payload — 52dp secondary-create from `pets-frames.jsx:78`. */
        val fab: FabAction =
            FabAction(
                icon = PantopusIcon.PlusCircle,
                contentDescription = "Add a pet",
                variant = FabVariant.SecondaryCreate,
                onClick = ::requestAdd,
            )

        /** Insert a newly-created pet at the top, mirroring the backend's
         *  `order by created_at desc`. */
        fun handleCreated(pet: PetDto) {
            pets = listOf(pet) + pets
            applyState()
        }

        /** Apply an Edit-wizard result in place. No-op when the pet has
         *  disappeared in the meantime. */
        fun handleUpdated(pet: PetDto) {
            val idx = pets.indexOfFirst { it.id == pet.id }
            if (idx < 0) return
            pets = pets.toMutableList().also { it[idx] = pet }
            applyState()
        }

        /** Optimistic delete + rollback on failure. */
        fun deletePet(petId: String) {
            val previous = pets
            val target = previous.firstOrNull { it.id == petId } ?: return
            pets = previous.filter { it.id != petId }
            applyState()
            viewModelScope.launch {
                when (repo.delete(homeId, petId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        pets = previous
                        applyState()
                        // Surface the failure via the empty/error path
                        // by re-emitting whatever state we restore to —
                        // the row reappears so the user can retry.
                        @Suppress("UNUSED_VARIABLE")
                        val rollbackTarget = target
                    }
                }
            }
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.list(homeId)) {
                    is NetworkResult.Success -> {
                        pets = result.data.pets
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        private fun applyState() {
            if (pets.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.PawPrint,
                        headline = "No pets yet",
                        subcopy =
                            "Add your pets so household members and pet-sitters " +
                                "have the info they need.",
                        ctaTitle = "Add a pet",
                        onCta = ::requestAdd,
                    )
                return
            }
            val rows = pets.map { row(it) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "pets", rows = rows)),
                    hasMore = false,
                )
        }

        private fun row(pet: PetDto): RowModel {
            val species = PetSpecies.parse(pet.species)
            val palette = species.palette
            val thumbnail =
                if (!pet.photoUrl.isNullOrEmpty()) {
                    ThumbnailImage.Remote(
                        url = pet.photoUrl,
                        fallback = palette.icon,
                        gradient = palette.iconBackground,
                    )
                } else {
                    ThumbnailImage.IconOnGradient(
                        icon = palette.icon,
                        gradient = palette.iconBackground,
                    )
                }
            return RowModel(
                id = pet.id,
                title = pet.name,
                subtitle = pet.breed?.takeIf { it.isNotEmpty() },
                template = RowTemplate.AvatarKebab,
                leading =
                    RowLeading.Thumbnail(
                        image = thumbnail,
                        size = ThumbnailSize.Large,
                    ),
                trailing = RowTrailing.Kebab,
                onTap = { _pendingEvent.value = PetsListEvent.OpenEdit(pet) },
                onSecondary = {
                    _pendingEvent.value = PetsListEvent.ConfirmDelete(pet.id, pet.name)
                },
                body = pet.notes?.takeIf { it.isNotEmpty() },
                inlineChip =
                    RowChip(
                        text = species.label,
                        tint =
                            RowChip.Tint.Custom(
                                background = palette.chipBackground,
                                foreground = palette.chipForeground,
                            ),
                    ),
                chips = vetChips(pet),
            )
        }

        /**
         * Vet contact pill under the row body — RN's expanded pet card
         * (`src/app/homes/[id]/pets.tsx:133 + 155-160`) joins `vet_name`
         * and `vet_phone` with "·" behind a medkit icon.
         */
        private fun vetChips(pet: PetDto): List<RowChip>? {
            val parts =
                listOfNotNull(
                    pet.vetName?.takeIf { it.isNotBlank() },
                    pet.vetPhone?.takeIf { it.isNotBlank() },
                )
            if (parts.isEmpty()) return null
            return listOf(
                RowChip(
                    text = parts.joinToString(" · "),
                    icon = PantopusIcon.Stethoscope,
                    tint =
                        RowChip.Tint.Custom(
                            background = PantopusColors.appSurfaceSunken,
                            foreground = PantopusColors.appTextSecondary,
                        ),
                ),
            )
        }

        /**
         * Public for tests: build a row from a DTO with the same projection
         * the VM uses internally.
         */
        internal fun rowForTest(pet: PetDto): RowModel = row(pet)
    }
