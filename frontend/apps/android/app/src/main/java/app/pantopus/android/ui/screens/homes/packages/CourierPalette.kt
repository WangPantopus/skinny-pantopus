@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.packages

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.3d (P14) — Per-courier visual tokens for the Packages row. Lifted
 * from the design at `packages-frames.jsx:51-63`. Feature code
 * ([PackagesListViewModel], etc.) references these typed swatches; no
 * hex literal appears in the `ui/screens/homes/packages` tree outside
 * this file (mirrors the `UtilityCategoryPalette` exception model —
 * these are per-courier chip pairs that don't fit
 * [app.pantopus.android.ui.theme.PantopusColors]'s
 * `name → single Color` semantic model).
 *
 * Carrier inference: client-side substring match on `PackageDto.carrier`
 * (the backend column is free-form text — no enum). Returns [Generic]
 * when the string is empty or doesn't match any known carrier.
 */
enum class CourierKind(val rawValue: String) {
    Amazon("amazon"),
    Ups("ups"),
    Usps("usps"),
    Fedex("fedex"),
    Dhl("dhl"),
    Ontrac("ontrac"),
    Local("local"),
    Generic("generic"),
    ;

    /** User-facing display label. */
    val label: String
        get() =
            when (this) {
                Amazon -> "Amazon"
                Ups -> "UPS"
                Usps -> "USPS"
                Fedex -> "FedEx"
                Dhl -> "DHL"
                Ontrac -> "OnTrac"
                Local -> "Local"
                Generic -> "Other"
            }

    /** 4-letter short code displayed on the courier tile. */
    val code: String
        get() =
            when (this) {
                Amazon -> "AMZN"
                Ups -> "UPS"
                Usps -> "USPS"
                Fedex -> "FDX"
                Dhl -> "DHL"
                Ontrac -> "OTC"
                Local -> "LCL"
                Generic -> "PKG"
            }

    /** Lucide icon glyph for the 40dp courier tile. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Amazon -> PantopusIcon.Package
                Ups -> PantopusIcon.Package
                Usps -> PantopusIcon.Mailbox
                Fedex -> PantopusIcon.Package
                Dhl -> PantopusIcon.Package
                Ontrac -> PantopusIcon.Package
                Local -> PantopusIcon.Package
                Generic -> PantopusIcon.Package
            }

    /**
     * Soft-tinted background for the 40dp courier tile. Hex values
     * mirror `packages-frames.jsx:51-63` exactly.
     */
    val background: Color
        get() =
            when (this) {
                // CSS fef3c7 — amber-100
                Amazon -> Color(0xFFFEF3C7)
                // CSS f5e8da — warm tan
                Ups -> Color(0xFFF5E8DA)
                // CSS dbeafe — blue-100
                Usps -> Color(0xFFDBEAFE)
                // CSS ede9fe — violet-100
                Fedex -> Color(0xFFEDE9FE)
                // CSS fef9c3 — yellow-100
                Dhl -> Color(0xFFFEF9C3)
                // CSS ffedd5 — orange-100
                Ontrac -> Color(0xFFFFEDD5)
                // CSS dcfce7 — green-100
                Local -> Color(0xFFDCFCE7)
                // primary50 — matches PantopusColors.primary50.
                Generic -> Color(0xFFF0F9FF)
            }

    /** Foreground tint for the icon glyph inside the 40dp tile. */
    val foreground: Color
        get() =
            when (this) {
                // CSS c2410c — orange-700
                Amazon -> Color(0xFFC2410C)
                // CSS 7c3a0f — UPS brown
                Ups -> Color(0xFF7C3A0F)
                // CSS 1d4ed8 — blue-700
                Usps -> Color(0xFF1D4ED8)
                // CSS 5b21b6 — violet-800
                Fedex -> Color(0xFF5B21B6)
                // CSS a16207 — yellow-700
                Dhl -> Color(0xFFA16207)
                // CSS c2410c — orange-700
                Ontrac -> Color(0xFFC2410C)
                // CSS 15803d — green-700
                Local -> Color(0xFF15803D)
                // primary600 — matches PantopusColors.primary600.
                Generic -> Color(0xFF0284C7)
            }

    companion object {
        /**
         * Client-side inference from the free-form `carrier` text on
         * `PackageDto`. Case-insensitive substring match, first match
         * wins. Returns [Generic] when no pattern matches.
         */
        @JvmStatic
        fun from(carrier: String?): CourierKind {
            if (carrier.isNullOrBlank()) return Generic
            val lower = carrier.lowercase()
            for (entry in patterns) {
                if (entry.matchers.any { lower.contains(it) }) return entry.kind
            }
            return Generic
        }

        private data class Pattern(
            val kind: CourierKind,
            val matchers: List<String>,
        )

        /**
         * **Order matters** — branded patterns before generic
         * substrings. "ups store" before "ups"; "amazon logistics"
         * matches under "amazon" via substring scan.
         */
        private val patterns: List<Pattern> =
            listOf(
                Pattern(Amazon, listOf("amazon", "amzl")),
                Pattern(Fedex, listOf("fedex", "fed ex")),
                Pattern(Usps, listOf("usps", "united states postal", "us postal")),
                Pattern(Dhl, listOf("dhl")),
                Pattern(Ontrac, listOf("ontrac", "lasership")),
                Pattern(Ups, listOf("ups")),
                Pattern(Local, listOf("local", "courier", "messenger", "bike")),
            )
    }
}
