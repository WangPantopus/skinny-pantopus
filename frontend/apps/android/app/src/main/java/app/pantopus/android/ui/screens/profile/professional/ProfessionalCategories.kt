@file:Suppress("MatchingDeclarationName", "PackageNaming")

package app.pantopus.android.ui.screens.profile.professional

/**
 * The professional-category enum the backend validates against —
 * `VALID_CATEGORIES` in `backend/routes/professional.js:32`. A value outside
 * this list fails Joi validation on both `POST api/professional/profile` and
 * `PATCH api/professional/profile/me`, so the enable form picks from here
 * rather than free text.
 *
 * Mirrors the iOS `ProfessionalCategory` and the RN option list at
 * `pantopus/frontend/apps/mobile/src/app/professional.tsx:25`.
 */
data class ProfessionalCategory(
    val key: String,
    val label: String,
) {
    companion object {
        /** Maximum categories the server accepts (`Joi.array().max(5)`). */
        const val SELECTION_LIMIT = 5

        /** The 30 server-valid categories, in the RN screen's order. */
        val all: List<ProfessionalCategory> =
            listOf(
                ProfessionalCategory("handyman", "Handyman"),
                ProfessionalCategory("plumber", "Plumber"),
                ProfessionalCategory("electrician", "Electrician"),
                ProfessionalCategory("landscaping", "Landscaping"),
                ProfessionalCategory("cleaning", "Cleaning"),
                ProfessionalCategory("painting", "Painting"),
                ProfessionalCategory("moving", "Moving"),
                ProfessionalCategory("pet_care", "Pet Care"),
                ProfessionalCategory("tutoring", "Tutoring"),
                ProfessionalCategory("photography", "Photography"),
                ProfessionalCategory("catering", "Catering"),
                ProfessionalCategory("personal_training", "Personal Training"),
                ProfessionalCategory("auto_repair", "Auto Repair"),
                ProfessionalCategory("carpentry", "Carpentry"),
                ProfessionalCategory("roofing", "Roofing"),
                ProfessionalCategory("hvac", "HVAC"),
                ProfessionalCategory("pest_control", "Pest Control"),
                ProfessionalCategory("appliance_repair", "Appliance Repair"),
                ProfessionalCategory("interior_design", "Interior Design"),
                ProfessionalCategory("event_planning", "Event Planning"),
                ProfessionalCategory("music_lessons", "Music Lessons"),
                ProfessionalCategory("web_development", "Web Development"),
                ProfessionalCategory("graphic_design", "Graphic Design"),
                ProfessionalCategory("writing", "Writing"),
                ProfessionalCategory("consulting", "Consulting"),
                ProfessionalCategory("childcare", "Childcare"),
                ProfessionalCategory("elder_care", "Elder Care"),
                ProfessionalCategory("delivery", "Delivery"),
                ProfessionalCategory("errand_running", "Errand Running"),
                ProfessionalCategory("other", "Other"),
            )

        /**
         * Display label for a backend key — falls back to a title-cased split
         * so an unknown key still reads cleanly.
         */
        fun label(key: String): String =
            all.firstOrNull { it.key == key }?.label
                ?: key.split("_").joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } }
    }
}
