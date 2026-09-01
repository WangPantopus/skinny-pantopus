@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.emergency

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * P2.8 — Form-side category enum for the Add Emergency Info form.
 * Carries the seven user-facing categories called out in the prompt
 * (allergy / medical condition / medication / contact / pet-medical /
 * power-of-attorney / other) and maps each onto the existing four-
 * bucket [EmergencyCategory] palette so the form, detail, and list
 * tiles re-use the same visual language.
 *
 * Mirrors `EmergencyFormCategory.swift` on iOS so the two platforms
 * reason about the same set of categories and palette mappings.
 */
enum class EmergencyFormCategory(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val supportsSeverity: Boolean,
    val palette: EmergencyCategory,
) {
    Allergy(
        id = "allergy",
        label = "Allergy",
        icon = PantopusIcon.AlertTriangle,
        supportsSeverity = true,
        palette = EmergencyCategory.Medical,
    ),
    MedicalCondition(
        id = "medical_condition",
        label = "Medical condition",
        icon = PantopusIcon.HeartPulse,
        supportsSeverity = true,
        palette = EmergencyCategory.Medical,
    ),
    Medication(
        id = "medication",
        label = "Medication",
        icon = PantopusIcon.Cross,
        supportsSeverity = true,
        palette = EmergencyCategory.Medical,
    ),
    Contact(
        id = "contact",
        label = "Contact",
        icon = PantopusIcon.Phone,
        supportsSeverity = false,
        palette = EmergencyCategory.Contact,
    ),
    PetMedical(
        id = "pet_medical",
        label = "Pet medical",
        icon = PantopusIcon.PawPrint,
        supportsSeverity = true,
        palette = EmergencyCategory.Medical,
    ),
    PowerOfAttorney(
        id = "power_of_attorney",
        label = "Power of attorney",
        icon = PantopusIcon.FileSignature,
        supportsSeverity = false,
        palette = EmergencyCategory.Contact,
    ),
    Other(
        id = "other",
        label = "Other",
        icon = PantopusIcon.Info,
        supportsSeverity = true,
        palette = EmergencyCategory.Contact,
    ),
    ;

    /** Backend `type` string sent on `POST /api/homes/:id/emergencies`. */
    val backendType: String get() = id

    companion object {
        /**
         * Resolve the form category for a backend type string. Returns
         * `null` for legacy list-of-rows types (`shutoff_water`,
         * `evac_plan`, etc.) — those rows render in the list view but
         * are not editable through this form.
         */
        fun fromType(type: String): EmergencyFormCategory? = entries.firstOrNull { it.id == type }
    }
}
