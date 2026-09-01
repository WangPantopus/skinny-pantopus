@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateDocumentRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav arg key for the upload document route. */
const val UPLOAD_DOCUMENT_HOME_ID_KEY = "homeId"

/**
 * Nine user-facing categories from the P2.10 design spec. Each carries
 * a wire-format [docType] string that maps onto the canonical backend
 * `doc_type` enum, and a [palette] swatch for the chip selector.
 */
enum class UploadDocumentCategory(
    val id: String,
    val label: String,
    val docType: String,
    val palette: DocumentCategory,
) {
    Insurance("insurance", "Insurance", "insurance", DocumentCategory.Insurance),
    Mortgage("mortgage", "Mortgage", "lease", DocumentCategory.Lease),
    Warranty("warranty", "Warranty", "warranty", DocumentCategory.Warranty),
    Receipt("receipt", "Receipt", "receipt", DocumentCategory.Tax),
    Contract("contract", "Contract", "permit", DocumentCategory.Permit),
    Identity("id", "ID", "other", DocumentCategory.Identity),
    Medical("medical", "Medical", "manual", DocumentCategory.Warranty),
    Tax("tax", "Tax", "receipt", DocumentCategory.Tax),
    Other("other", "Other", "other", DocumentCategory.Other),
    ;

    companion object {
        private val SUGGESTION_KEYWORDS: List<Pair<UploadDocumentCategory, List<String>>> =
            listOf(
                Mortgage to listOf("lease", "mortgage"),
                Insurance to listOf("insurance", "policy"),
                Warranty to listOf("warranty", "manual"),
                Tax to listOf("tax", "1098", "1099"),
                Receipt to listOf("receipt"),
                Contract to listOf("contract"),
                Identity to listOf("passport", "license", "id "),
                Medical to listOf("medical", "vet", "vaccine"),
            )

        /** Filename heuristic — picks a sensible default category. */
        fun suggestFor(filename: String): UploadDocumentCategory? {
            val lower = filename.lowercase()
            return SUGGESTION_KEYWORDS.firstOrNull { (_, keywords) ->
                keywords.any { it in lower }
            }?.first
        }
    }
}

/** Visibility scope for a newly uploaded document. */
enum class UploadDocumentVisibility(val wire: String, val label: String) {
    Owners("managers", "Owners only"),
    AllMembers("members", "All members"),
}

/** Kind of entity that can be linked from a document. */
enum class UploadDocumentLinkKind(val id: String, val label: String) {
    Bill("bill", "Bill"),
    Maintenance("maintenance", "Maintenance"),
    Pet("pet", "Pet"),
}

/** One row in the linked-to picker sheet. */
data class UploadDocumentLinkOption(
    val id: String,
    val kind: UploadDocumentLinkKind,
    val title: String,
    val subtitle: String? = null,
)

/** Lifecycle state for the linked-to picker. */
sealed interface UploadDocumentLinkOptionsState {
    data object Idle : UploadDocumentLinkOptionsState

    data object Loading : UploadDocumentLinkOptionsState

    data class Loaded(val options: List<UploadDocumentLinkOption>) : UploadDocumentLinkOptionsState

    data class Error(val message: String) : UploadDocumentLinkOptionsState
}

/** Display-only handle on a picked file. */
data class PickedFile(
    val filename: String,
    val sizeBytes: Long? = null,
    val mimeType: String? = null,
) {
    val fileType: DocumentFileType
        get() = DocumentFileType.fromMime(mimeType = mimeType, filename = filename)
}

/** Toast payload surfaced by the screen. */
data class UploadDocumentToast(val text: String, val isError: Boolean)

/** Aggregate UI state for the Upload Document form. */
data class UploadDocumentFormState(
    val pickedFile: PickedFile? = null,
    val title: FormFieldState = FormFieldState(id = "title"),
    val category: UploadDocumentCategory = UploadDocumentCategory.Other,
    val tags: List<String> = emptyList(),
    val tagDraft: String = "",
    val linkedEntity: UploadDocumentLinkOption? = null,
    val visibility: UploadDocumentVisibility = UploadDocumentVisibility.AllMembers,
    val linkOptionsState: UploadDocumentLinkOptionsState = UploadDocumentLinkOptionsState.Idle,
    val isSaving: Boolean = false,
    val toast: UploadDocumentToast? = null,
    val shouldDismiss: Boolean = false,
) {
    private val trimmedTitle: String get() = title.value.trim()

    val isValid: Boolean
        get() = pickedFile != null && trimmedTitle.isNotEmpty() && title.error == null

    val isDirty: Boolean
        get() =
            pickedFile != null ||
                trimmedTitle.isNotEmpty() ||
                tags.isNotEmpty() ||
                linkedEntity != null
}

@HiltViewModel
class UploadDocumentFormViewModel
    @Inject
    constructor(
        private val homesRepo: HomesRepository,
        private val petsRepo: HomePetsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(UPLOAD_DOCUMENT_HOME_ID_KEY)) {
                "UploadDocumentFormViewModel requires a $UPLOAD_DOCUMENT_HOME_ID_KEY arg"
            }

        private val _state = MutableStateFlow(UploadDocumentFormState())
        val state: StateFlow<UploadDocumentFormState> = _state.asStateFlow()

        /**
         * Called by the file-picker contract once the user picks a
         * file. Seeds the title from the filename when the title field
         * is still untouched.
         */
        fun acceptPicked(
            filename: String,
            sizeBytes: Long?,
            mimeType: String?,
        ) {
            val previous = _state.value.pickedFile
            val picked = PickedFile(filename = filename, sizeBytes = sizeBytes, mimeType = mimeType)
            _state.update { snapshot ->
                val needsTitle = snapshot.title.value.isEmpty() || !snapshot.title.touched
                val newTitle =
                    if (needsTitle) {
                        val stripped = filename.substringBeforeLast('.', filename)
                        FormFieldState(id = "title", value = stripped, originalValue = stripped)
                    } else {
                        snapshot.title
                    }
                val suggested = UploadDocumentCategory.suggestFor(filename)
                val newCategory = if (suggested != null && previous == null) suggested else snapshot.category
                snapshot.copy(
                    pickedFile = picked,
                    title = newTitle,
                    category = newCategory,
                )
            }
        }

        fun clearPickedFile() {
            _state.update { it.copy(pickedFile = null) }
        }

        fun updateTitle(value: String) {
            _state.update { snapshot ->
                snapshot.copy(
                    title =
                        snapshot.title.copy(
                            value = value,
                            touched = true,
                            error = validateTitle(value),
                        ),
                )
            }
        }

        fun selectCategory(category: UploadDocumentCategory) {
            _state.update { it.copy(category = category) }
        }

        fun selectVisibility(visibility: UploadDocumentVisibility) {
            _state.update { it.copy(visibility = visibility) }
        }

        fun updateTagDraft(value: String) {
            _state.update { it.copy(tagDraft = value) }
        }

        /** Commit the tag draft as a chip. Trims, dedupes case-insensitively, caps at 12 chips. */
        fun commitTagDraft() {
            _state.update { snapshot ->
                val trimmed = snapshot.tagDraft.trim()
                if (trimmed.isEmpty() || trimmed.length > 24 || snapshot.tags.size >= 12) {
                    return@update snapshot.copy(tagDraft = "")
                }
                val normalized = trimmed.lowercase()
                if (snapshot.tags.map { it.lowercase() }.contains(normalized)) {
                    return@update snapshot.copy(tagDraft = "")
                }
                snapshot.copy(tags = snapshot.tags + trimmed, tagDraft = "")
            }
        }

        fun removeTag(tag: String) {
            _state.update { snapshot -> snapshot.copy(tags = snapshot.tags - tag) }
        }

        fun selectLink(option: UploadDocumentLinkOption) {
            _state.update { it.copy(linkedEntity = option) }
        }

        fun clearLinkedEntity() {
            _state.update { it.copy(linkedEntity = null) }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        /**
         * Lazy-fetch link options on first sheet open. Bills, maintenance,
         * and pets are loaded in parallel and concatenated.
         */
        fun loadLinkOptionsIfNeeded() {
            val current = _state.value.linkOptionsState
            if (current is UploadDocumentLinkOptionsState.Loaded ||
                current is UploadDocumentLinkOptionsState.Loading
            ) {
                return
            }
            _state.update { it.copy(linkOptionsState = UploadDocumentLinkOptionsState.Loading) }
            viewModelScope.launch {
                val bills = async { fetchBills() }
                val maintenance = async { fetchMaintenance() }
                val pets = async { fetchPets() }
                val combined = bills.await() + maintenance.await() + pets.await()
                _state.update {
                    it.copy(linkOptionsState = UploadDocumentLinkOptionsState.Loaded(combined))
                }
            }
        }

        private suspend fun fetchBills(): List<UploadDocumentLinkOption> =
            when (val result = homesRepo.getHomeBills(homeId)) {
                is NetworkResult.Success ->
                    result.data.bills.map { bill ->
                        UploadDocumentLinkOption(
                            id = bill.id,
                            kind = UploadDocumentLinkKind.Bill,
                            title = bill.providerName ?: bill.billType.replaceFirstChar { it.uppercase() },
                            subtitle = bill.dueDate?.let { "Due $it" },
                        )
                    }
                is NetworkResult.Failure -> emptyList()
            }

        private suspend fun fetchMaintenance(): List<UploadDocumentLinkOption> =
            when (val result = homesRepo.getHomeMaintenance(homeId)) {
                is NetworkResult.Success ->
                    result.data.tasks.map { task ->
                        UploadDocumentLinkOption(
                            id = task.id,
                            kind = UploadDocumentLinkKind.Maintenance,
                            title = task.task,
                            subtitle = task.dueDate?.let { "Due $it" } ?: task.vendor,
                        )
                    }
                is NetworkResult.Failure -> emptyList()
            }

        private suspend fun fetchPets(): List<UploadDocumentLinkOption> =
            when (val result = petsRepo.list(homeId)) {
                is NetworkResult.Success ->
                    result.data.pets.map { pet ->
                        UploadDocumentLinkOption(
                            id = pet.id,
                            kind = UploadDocumentLinkKind.Pet,
                            title = pet.name,
                            subtitle = pet.species.replaceFirstChar { it.uppercase() },
                        )
                    }
                is NetworkResult.Failure -> emptyList()
            }

        /**
         * Submit the form. Validates inputs first; on success surfaces a
         * toast and sets [UploadDocumentFormState.shouldDismiss] so the
         * screen can pop.
         */
        fun submit() {
            val snapshot = _state.value
            val validatedTitle =
                snapshot.title.copy(
                    touched = true,
                    error = validateTitle(snapshot.title.value),
                )
            _state.update { it.copy(title = validatedTitle) }
            if (snapshot.pickedFile == null || validatedTitle.error != null ||
                validatedTitle.value.trim().isEmpty()
            ) {
                _state.update {
                    it.copy(toast = UploadDocumentToast("Pick a file and add a title.", isError = true))
                }
                return
            }
            if (snapshot.isSaving) return
            _state.update { it.copy(isSaving = true, toast = null) }

            val details =
                buildMap {
                    if (snapshot.tags.isNotEmpty()) put("tags", snapshot.tags.joinToString(","))
                    snapshot.linkedEntity?.let { link ->
                        put("linked_entity_kind", link.kind.id)
                        put("linked_entity_id", link.id)
                        put("linked_entity_title", link.title)
                    }
                }
            val request =
                CreateDocumentRequest(
                    docType = snapshot.category.docType,
                    title = validatedTitle.value.trim(),
                    mimeType = snapshot.pickedFile.mimeType,
                    sizeBytes = snapshot.pickedFile.sizeBytes,
                    visibility = snapshot.visibility.wire,
                    details = if (details.isEmpty()) null else details,
                )
            viewModelScope.launch {
                when (val result = homesRepo.createHomeDocument(homeId, request)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast = UploadDocumentToast("Document uploaded.", isError = false),
                                shouldDismiss = true,
                            )
                        }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast = UploadDocumentToast(result.error.message, isError = true),
                            )
                        }
                }
            }
        }

        private fun validateTitle(value: String): String? {
            val trimmed = value.trim()
            if (trimmed.isEmpty()) return "Title is required."
            if (trimmed.length > 255) return "Title must be 255 characters or fewer."
            return null
        }
    }
