@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import app.pantopus.android.data.api.models.scheduling.EventTypeQuestionDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar

/** Intake answer types — design labels mapped to the backend `field_type` enum. */
enum class QuestionType(
    val label: String,
    val backend: String,
    val hasOptions: Boolean,
) {
    ShortText("Short text", "text", false),
    Paragraph("Paragraph", "textarea", false),
    Dropdown("Dropdown", "select", true),
    MultiSelect("Multi-select", "multiselect", true),
    Checkbox("Checkbox", "checkbox", true),
    Phone("Phone", "phone", false),
    ;

    val typeCaption: String get() = label

    companion object {
        fun fromBackend(value: String?): QuestionType = entries.firstOrNull { it.backend == value } ?: ShortText
    }
}

/** One in-progress custom question; [localId] is a stable list key (not persisted). */
data class QuestionDraft(
    val localId: String,
    val label: String,
    val type: QuestionType,
    val options: List<String>,
    val required: Boolean,
) {
    val canSave: Boolean
        get() = label.isNotBlank() && (!type.hasOptions || options.any { it.isNotBlank() })
}

/** The inline add/edit field group — [isNew] appends, otherwise replaces by [localId]. */
data class EditingQuestion(
    val draft: QuestionDraft,
    val isNew: Boolean,
)

internal fun EventTypeQuestionDto.toDraft(localId: String): QuestionDraft =
    QuestionDraft(
        localId = localId,
        label = label,
        type = QuestionType.fromBackend(fieldType),
        options = options,
        required = required,
    )

/**
 * B3 Intake questions editor. Name + email are always-asked locked rows; below
 * them is the reorderable set of custom questions with an inline add/edit group.
 * `Done` saves the whole set via `PUT /event-types/:id/questions` (replace-all).
 */
sealed interface IntakeUiState {
    data object Loading : IntakeUiState

    /** The event type isn't created yet (`new`) — questions need a saved id first. */
    data object NeedsSaveFirst : IntakeUiState

    data class Content(
        val eventName: String,
        val pillar: SchedulingPillar,
        val questions: List<QuestionDraft>,
        val editing: EditingQuestion?,
        val isSaving: Boolean,
        val isDirty: Boolean,
    ) : IntakeUiState

    data class Error(
        val message: String,
    ) : IntakeUiState
}
