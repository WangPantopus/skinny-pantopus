package app.pantopus.android.ui.screens.nearby

// ============================================================
// The Nearby window's cell styling — pure, so it is testable without a
// map. A cell's bucket is the ONLY thing the server tells us about it;
// the viewer's own cell gets an outline, never a dot. Same alphas as
// the web `nearbyCells.ts`.
// ============================================================

private const val ALPHA_FORMING = 0.14f
private const val ALPHA_FEW = 0.32f
private const val ALPHA_GROWING = 0.55f

/** The legend swatch is never invisible, even for "none". */
const val LEGEND_SWATCH_MIN_ALPHA = 0.18f
const val LEGEND_SWATCH_BOOST = 0.15f

/** The meter bar shows a sliver below the k-anon floor. */
const val METER_MIN_FRACTION = 0.08f

/** Fill alpha by bucket: none is transparent, growing is the strongest. */
fun cellFillAlpha(bucket: String): Float =
    when (bucket) {
        "forming" -> ALPHA_FORMING
        "few" -> ALPHA_FEW
        "growing" -> ALPHA_GROWING
        else -> 0f
    }

/** Legend order, lightest to strongest. */
val CELL_LEGEND_ORDER: List<String> = listOf("none", "forming", "few", "growing")

/** Google Maps zoom that frames a 5×5 grid of geohash-6 cells (~6 km across). */
const val CELLS_ZOOM: Float = 12.6f
