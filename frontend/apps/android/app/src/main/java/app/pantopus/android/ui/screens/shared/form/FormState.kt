@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.form

/**
 * Live + canonical pose for a single form field. Mirrors iOS
 * `FormFieldState` so the two platforms reason about dirty / valid
 * identically.
 */
data class FormFieldState(
    val id: String,
    val value: String = "",
    val originalValue: String = "",
    val touched: Boolean = false,
    val error: String? = null,
) {
    /** True when the current value differs from [originalValue]. */
    val isDirty: Boolean
        get() = value != originalValue

    /**
     * Reset the original-value baseline to the current value. Call
     * after a successful POST/PATCH to clear dirty tracking.
     */
    fun committed(): FormFieldState = copy(originalValue = value, touched = false)
}

/** Aggregate dirty + validity snapshot for an entire form. */
data class FormAggregate(
    val isDirty: Boolean,
    val isValid: Boolean,
) {
    companion object {
        fun from(fields: Collection<FormFieldState>): FormAggregate =
            FormAggregate(
                isDirty = fields.any { it.isDirty },
                isValid = fields.all { it.error == null },
            )
    }
}
