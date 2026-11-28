package app.pantopus.android.data.api.models.moments

import com.squareup.moshi.JsonClass

/**
 * "Pulse, reinvented" (CONTRACT 10c): the two colours of the backdrop a whole picture sits on, `#RRGGBB` upper-case, so a
 * screen wider or taller than the picture continues the author's backdrop around it.
 */
@JsonClass(generateAdapter = true)
data class MomentBackdropDto(
    // Defaults, so an answer missing one colour still reads (the viewer then reads the picture's own colours).
    val top: String = "",
    val bottom: String = "",
)
