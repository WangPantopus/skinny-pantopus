@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.pets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreatePetRequest
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.data.api.models.homes.UpdatePetRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.theme.PetSpecies
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Discrete steps in the wizard. Numeric order = navigation order. */
enum class AddPetStep(
    val number: Int,
    val title: String,
    val subcopy: String,
) {
    Species(
        number = 1,
        title = "Pick a species",
        subcopy = "Sets the icon and chip colour we'll use across the home.",
    ),
    Basics(
        number = 2,
        title = "What's their name?",
        subcopy = "Name is required. Breed is optional and shows under the name.",
    ),
    Details(
        number = 3,
        title = "Anything else?",
        subcopy = "Vet contact and notes show on the row so sitters see the most important info first.",
    ),
    ;

    companion object {
        val total: Int = entries.size
    }
}

/**
 * Form snapshot held by the VM. The vet pair mirrors RN's "Vet name /
 * phone" field (`src/app/homes/[id]/pets.tsx:108`) split across the two
 * columns the backend stores (`vet_name` / `vet_phone`,
 * `createPetSchema` at `backend/routes/home.js:6978-6979`).
 */
data class AddPetForm(
    val species: PetSpecies = PetSpecies.Dog,
    val name: String = "",
    val breed: String = "",
    val photoUrl: String = "",
    val vetName: String = "",
    val vetPhone: String = "",
    val notes: String = "",
)

/** `createPetSchema`'s `vet_name: Joi.string().max(200)`. */
private const val VET_NAME_MAX_LENGTH = 200

/** `createPetSchema`'s `vet_phone: Joi.string().max(30)`. */
private const val VET_PHONE_MAX_LENGTH = 30

/**
 * Combined state the screen observes. Carries the active step, form
 * snapshot, the submit-in-flight flag, and the inline error banner.
 */
data class AddPetState(
    val currentStep: AddPetStep = AddPetStep.Species,
    val form: AddPetForm = AddPetForm(),
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val isEditing: Boolean = false,
)

/** Outbound events the host screen reacts to. */
sealed interface AddPetEvent {
    data class Submitted(
        val pet: PetDto,
    ) : AddPetEvent

    data object Dismiss : AddPetEvent
}

/**
 * Drives the Add / Edit Pet wizard. Conforms to [WizardModel] so
 * [WizardShell] handles the chrome / progress / close-confirm without
 * any bespoke logic.
 *
 * Instantiated by the host screen with the home id + an optional pet to
 * edit (POST vs PUT). Not a Hilt VM — the host owns the lifecycle.
 */
class AddPetWizardViewModel(
    private val homeId: String,
    private val existing: PetDto?,
    private val repo: HomePetsRepository,
    private val viewModelScopeOverride: kotlinx.coroutines.CoroutineScope? = null,
) : ViewModel(), WizardModel {
    private val scope get() = viewModelScopeOverride ?: viewModelScope

    private val _state =
        MutableStateFlow(
            AddPetState(
                form = formFor(existing),
                isEditing = existing != null,
            ),
        )
    val state: StateFlow<AddPetState> = _state.asStateFlow()

    private val _pendingEvent = MutableStateFlow<AddPetEvent?>(null)
    val pendingEvent: StateFlow<AddPetEvent?> = _pendingEvent.asStateFlow()

    fun acknowledgeEvent() {
        _pendingEvent.value = null
    }

    // MARK: - Form mutations

    fun setSpecies(species: PetSpecies) {
        _state.update { it.copy(form = it.form.copy(species = species), errorMessage = null) }
    }

    fun setName(value: String) {
        _state.update { it.copy(form = it.form.copy(name = value), errorMessage = null) }
    }

    fun setBreed(value: String) {
        _state.update { it.copy(form = it.form.copy(breed = value), errorMessage = null) }
    }

    fun setPhotoUrl(value: String) {
        _state.update { it.copy(form = it.form.copy(photoUrl = value), errorMessage = null) }
    }

    fun setVetName(value: String) {
        _state.update {
            it.copy(form = it.form.copy(vetName = value.take(VET_NAME_MAX_LENGTH)), errorMessage = null)
        }
    }

    fun setVetPhone(value: String) {
        _state.update {
            it.copy(form = it.form.copy(vetPhone = value.take(VET_PHONE_MAX_LENGTH)), errorMessage = null)
        }
    }

    fun setNotes(value: String) {
        _state.update { it.copy(form = it.form.copy(notes = value), errorMessage = null) }
    }

    // MARK: - WizardModel

    override val chrome: WizardChrome
        get() {
            val current = _state.value.currentStep
            return WizardChrome(
                title = if (_state.value.isEditing) "Edit pet" else "Add a pet",
                progressLabel =
                    WizardProgressLabel.StepOf(
                        current = current.number,
                        total = AddPetStep.total,
                    ),
                progressFraction = current.number.toFloat() / AddPetStep.total.toFloat(),
                leading = if (current == AddPetStep.Species) WizardLeadingControl.Close else WizardLeadingControl.Back,
                primaryCtaLabel = primaryLabel,
                primaryCtaEnabled = primaryEnabled,
                isSubmitting = _state.value.isSubmitting,
                dirty = isDirty,
                showsProgressBar = true,
            )
        }

    private val primaryLabel: String
        get() =
            when (_state.value.currentStep) {
                AddPetStep.Details -> if (_state.value.isEditing) "Save changes" else "Add pet"
                else -> "Next"
            }

    private val primaryEnabled: Boolean
        get() = _state.value.form.name.trim().isNotEmpty() || _state.value.currentStep == AddPetStep.Species

    private val isDirty: Boolean
        get() = _state.value.isEditing || _state.value.form != formFor(null)

    override fun onLeading() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current == AddPetStep.Species) {
            _pendingEvent.value = AddPetEvent.Dismiss
            return
        }
        val previous = AddPetStep.entries.firstOrNull { it.number == current.number - 1 } ?: return
        _state.update { it.copy(currentStep = previous) }
    }

    override fun onDiscard() {
        _pendingEvent.value = AddPetEvent.Dismiss
    }

    override fun onPrimary() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current != AddPetStep.Details) {
            val next = AddPetStep.entries.firstOrNull { it.number == current.number + 1 } ?: return
            _state.update { it.copy(currentStep = next) }
            return
        }
        submit()
    }

    private fun submit() {
        if (_state.value.isSubmitting) return
        _state.update { it.copy(isSubmitting = true) }
        scope.launch {
            val form = _state.value.form
            val trimmedName = form.name.trim()
            val trimmedBreed = form.breed.trim().ifEmpty { null }
            val trimmedPhoto = form.photoUrl.trim().ifEmpty { null }
            val trimmedVetName = form.vetName.trim().ifEmpty { null }
            val trimmedVetPhone = form.vetPhone.trim().ifEmpty { null }
            val trimmedNotes = form.notes.trim().ifEmpty { null }
            val result =
                if (existing != null) {
                    repo.update(
                        homeId = homeId,
                        petId = existing.id,
                        request =
                            UpdatePetRequest(
                                name = trimmedName,
                                species = form.species.wire,
                                breed = trimmedBreed,
                                vetName = trimmedVetName,
                                vetPhone = trimmedVetPhone,
                                photoUrl = trimmedPhoto,
                                notes = trimmedNotes,
                            ),
                    )
                } else {
                    repo.create(
                        homeId = homeId,
                        request =
                            CreatePetRequest(
                                name = trimmedName,
                                species = form.species.wire,
                                breed = trimmedBreed,
                                vetName = trimmedVetName,
                                vetPhone = trimmedVetPhone,
                                photoUrl = trimmedPhoto,
                                notes = trimmedNotes,
                            ),
                    )
                }
            when (result) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(isSubmitting = false) }
                    _pendingEvent.value = AddPetEvent.Submitted(result.data.pet)
                }
                is NetworkResult.Failure -> {
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = result.error.message,
                        )
                    }
                }
            }
        }
    }

    private fun formFor(pet: PetDto?): AddPetForm =
        pet?.let {
            AddPetForm(
                species = PetSpecies.parse(it.species),
                name = it.name,
                breed = it.breed.orEmpty(),
                photoUrl = it.photoUrl.orEmpty(),
                vetName = it.vetName.orEmpty(),
                vetPhone = it.vetPhone.orEmpty(),
                notes = it.notes.orEmpty(),
            )
        } ?: AddPetForm()
}
