@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.theme

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair

/**
 * T5.2.1 — Per-species visual tokens for the Pets row. Lifted from the
 * design at `more-designed-pages/pets-frames.jsx:22-30`. Feature code
 * (`PetsListViewModel`, etc.) references these typed swatches; no raw
 * `Color(0xFF...)` ever appears in feature screens.
 *
 * Mirrors iOS `Core/Design/SpeciesPalette.swift` 1:1 — same wire enum,
 * same five gradient palettes plus an `Other` fallback.
 */

/**
 * Backend species enum from `backend/routes/home.js:6766`
 * (`createPetSchema`). Kept lowercase to match the wire format.
 */
enum class PetSpecies(
    val wire: String,
    val label: String,
) {
    Dog("dog", "Dog"),
    Cat("cat", "Cat"),
    Bird("bird", "Bird"),
    Fish("fish", "Fish"),
    Reptile("reptile", "Reptile"),
    Rabbit("rabbit", "Rabbit"),
    Hamster("hamster", "Hamster"),
    Other("other", "Other"),
    ;

    /**
     * Visual bucket — the design ships five canonical palettes (Dog, Cat,
     * Bird, Reptile, Fish) plus one `Other` fallback. Rabbit, hamster, and
     * any unknown future species collapse to `[SpeciesPalette.Other]`.
     */
    val palette: SpeciesPalette
        get() =
            when (this) {
                Dog -> SpeciesPalette.Dog
                Cat -> SpeciesPalette.Cat
                Bird -> SpeciesPalette.Bird
                Fish -> SpeciesPalette.Fish
                Reptile -> SpeciesPalette.Reptile
                Rabbit, Hamster, Other -> SpeciesPalette.Other
            }

    companion object {
        /** Best-effort parser for the wire value. */
        fun parse(raw: String?): PetSpecies {
            if (raw.isNullOrEmpty()) return Other
            val lower = raw.lowercase()
            return entries.firstOrNull { it.wire == lower } ?: Other
        }
    }
}

/**
 * Six canonical species swatches from the design. Each carries:
 *   - `iconBackground` — 2-stop linear gradient (135°)
 *   - `iconForeground` — fallback icon tint
 *   - `chipBackground` / `chipForeground` — inline species chip
 *   - `icon` — fallback `[PantopusIcon]` rendered when no `photo_url`
 */
@Suppress("EnumNaming")
enum class SpeciesPalette {
    Dog,
    Cat,
    Bird,
    Reptile,
    Fish,
    Other,
    ;

    val iconBackground: GradientPair
        get() =
            when (this) {
                Dog -> GradientPair(Color(0xFFFED7AA), Color(0xFFFB923C))
                Cat -> GradientPair(Color(0xFFDDD6FE), Color(0xFFA78BFA))
                Bird -> GradientPair(Color(0xFFBFDBFE), Color(0xFF60A5FA))
                Reptile -> GradientPair(Color(0xFFBBF7D0), Color(0xFF4ADE80))
                Fish -> GradientPair(Color(0xFFA5F3FC), Color(0xFF22D3EE))
                Other -> GradientPair(Color(0xFFE5E7EB), Color(0xFF9CA3AF))
            }

    val iconForeground: Color
        get() =
            when (this) {
                Dog -> Color(0xFF7C2D12)
                Cat -> Color(0xFF4C1D95)
                Bird -> Color(0xFF1E3A8A)
                Reptile -> Color(0xFF14532D)
                Fish -> Color(0xFF155E75)
                Other -> Color(0xFF1F2937)
            }

    val chipBackground: Color
        get() =
            when (this) {
                Dog -> Color(0xFFFFEDD5)
                Cat -> Color(0xFFEDE9FE)
                Bird -> Color(0xFFDBEAFE)
                Reptile -> Color(0xFFDCFCE7)
                Fish -> Color(0xFFCFFAFE)
                Other -> Color(0xFFF3F4F6)
            }

    val chipForeground: Color
        get() =
            when (this) {
                Dog -> Color(0xFF9A3412)
                Cat -> Color(0xFF5B21B6)
                Bird -> Color(0xFF1E40AF)
                Reptile -> Color(0xFF166534)
                Fish -> Color(0xFF155E75)
                Other -> Color(0xFF374151)
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Dog -> PantopusIcon.Dog
                Cat -> PantopusIcon.Cat
                Bird -> PantopusIcon.Bird
                Reptile -> PantopusIcon.Turtle
                Fish -> PantopusIcon.Fish
                Other -> PantopusIcon.PawPrint
            }
}
