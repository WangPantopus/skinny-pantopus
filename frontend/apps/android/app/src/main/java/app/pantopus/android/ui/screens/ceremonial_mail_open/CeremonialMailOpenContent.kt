@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.ceremonial_mail_open

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

enum class CeremonialMailPhase(val key: String) {
    Sealed("sealed"),
    Breaking("breaking"),
    Open("open"),
    Replying("replying"),
}

/**
 * Stationery palette. Per-tone hex values are documented as a per-feature
 * palette exception (paper-stock colors are not on the design-token
 * scale). T6.5d adds the seasonal themes (Fall / Winter / Spring /
 * Summer / Evergreen) called out in `ceremonial-mail-frames.jsx`.
 */
enum class CeremonialMailStationeryTone(
    val wire: String,
    val paperColor: Color,
    val paperEdgeColor: Color,
    val porchTopColor: Color,
    val porchBottomColor: Color,
) {
    ClassicCream(
        "classic_cream",
        Color(0xFFF8F0DE),
        Color(0xFFDCD2BC),
        Color(0xFFE6D2B4),
        Color(0xFF825A46),
    ),
    MidnightBlue(
        "midnight_blue",
        Color(0xFFE0E4F0),
        Color(0xFFC8CEE0),
        Color(0xFF506496),
        Color(0xFF162046),
    ),
    Linen(
        "linen",
        Color(0xFFFAF7F0),
        Color(0xFFE2DCCE),
        Color(0xFFE6D2B4),
        Color(0xFF825A46),
    ),
    Botanical(
        "botanical",
        Color(0xFFEBF4E8),
        Color(0xFFD0DECC),
        Color(0xFFE6D2B4),
        Color(0xFF825A46),
    ),
    Fall(
        "fall",
        Color(0xFFF0E2C4),
        Color(0xFFD9C49A),
        Color(0xFFF4C97F),
        Color(0xFF6F3439),
    ),
    Winter(
        "winter",
        Color(0xFFECE9E2),
        Color(0xFFD3CFC6),
        Color(0xFFC3D4E2),
        Color(0xFF38465A),
    ),
    Spring(
        "spring",
        Color(0xFFF4EFDC),
        Color(0xFFDAD3B8),
        Color(0xFFC4E2B2),
        Color(0xFF567C4E),
    ),
    Summer(
        "summer",
        Color(0xFFF6E6D3),
        Color(0xFFDECBB4),
        Color(0xFFF4C486),
        Color(0xFF8A4637),
    ),
    Evergreen(
        "evergreen",
        Color(0xFF1F2E26),
        Color(0xFF0F1914),
        Color(0xFF3C5244),
        Color(0xFF121E18),
    ),
    ;

    val paperShadow: Color get() = Color.Black.copy(alpha = 0.12f)

    companion object {
        fun fromWire(value: String?): CeremonialMailStationeryTone = entries.firstOrNull { it.wire == value } ?: ClassicCream
    }
}

enum class CeremonialMailInkTone(val wire: String, val color: Color) {
    Walnut("walnut", Color(0xFF5C3820)),
    Navy("navy", Color(0xFF1E3860)),
    Sepia("sepia", Color(0xFF6E4B28)),
    Forest("forest", Color(0xFF26462C)),
    Iron("iron", Color(0xFF2A2620)),
    Mahogany("mahogany", Color(0xFF3B2418)),
    Ivory("ivory", Color(0xFFF6ECD8)),
    ;

    companion object {
        fun fromWire(value: String?): CeremonialMailInkTone = entries.firstOrNull { it.wire == value } ?: Walnut
    }
}

enum class CeremonialMailSealTone(val wire: String, val color: Color) {
    WaxRed("wax_red", Color(0xFFA82026)),
    WaxBlue("wax_blue", Color(0xFF204082)),
    WaxBlack("wax_black", Color(0xFF1E1E1E)),
    Fall("fall", Color(0xFF8C3B2A)),
    Winter("winter", Color(0xFF4B6478)),
    Spring("spring", Color(0xFF6B8E4E)),
    Summer("summer", Color(0xFFB3613F)),
    Evergreen("evergreen", Color(0xFFC29230)),
    None("none", Color.Transparent),
    ;

    companion object {
        fun fromWire(value: String?): CeremonialMailSealTone = entries.firstOrNull { it.wire == value } ?: WaxRed
    }
}

@Immutable
data class CeremonialSenderCard(
    val displayName: String,
    val handle: String?,
    val trustLabel: String?,
    val avatarUrl: String?,
)

@Immutable
data class CeremonialOutcomeCta(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val style: Style,
) {
    enum class Style { Primary, Ghost }
}

@Immutable
data class CeremonialMailLetter(
    val mailId: String,
    val sender: CeremonialSenderCard,
    val category: String,
    val subject: String,
    val bodyParagraphs: List<String>,
    val stationery: CeremonialMailStationeryTone,
    val ink: CeremonialMailInkTone,
    val seal: CeremonialMailSealTone,
    val voicePostscriptUri: String?,
    val receivedAt: String?,
    val outcomeCtas: List<CeremonialOutcomeCta>,
) {
    companion object {
        fun defaultOutcomeCtas(): List<CeremonialOutcomeCta> =
            listOf(
                CeremonialOutcomeCta(
                    id = "write_back",
                    label = "Write back",
                    icon = PantopusIcon.Send,
                    style = CeremonialOutcomeCta.Style.Primary,
                ),
                CeremonialOutcomeCta(
                    id = "save",
                    label = "Save to records",
                    icon = PantopusIcon.Check,
                    style = CeremonialOutcomeCta.Style.Ghost,
                ),
                CeremonialOutcomeCta(
                    id = "just_read",
                    label = "Just read",
                    icon = PantopusIcon.Check,
                    style = CeremonialOutcomeCta.Style.Ghost,
                ),
            )
    }
}

sealed interface CeremonialMailOpenUiState {
    data object Loading : CeremonialMailOpenUiState

    data class Loaded(val letter: CeremonialMailLetter, val phase: CeremonialMailPhase) : CeremonialMailOpenUiState

    data class Error(val message: String) : CeremonialMailOpenUiState
}
