package app.pantopus.android.ui.theme

/**
 * "Pulse, reinvented" (CONTRACT 7g): the paint colours an author picks from for a swatch slider in the Studio, as the
 * `#RRGGBB` the server keeps. Kept here, like [SkyPalette], so no raw colour literal reaches `ui/screens/`.
 */
object SwatchPalette {
    /** Name and colour, in the tray's order. */
    val paints: List<Pair<String, String>> =
        listOf(
            "Charcoal" to "#36454F",
            "Slate" to "#6A7B8C",
            "Navy" to "#1F3A5F",
            "Sage" to "#9CAF88",
            "Emerald" to "#2E8B57",
            "Tan" to "#D2B48C",
            "Cream" to "#F3E5C0",
            "Amber" to "#E8A317",
            "Terracotta" to "#C8643B",
            "Crimson" to "#B22234",
            "Blush" to "#E8B4B8",
            "Off-white" to "#F5F5F0",
        )
}
