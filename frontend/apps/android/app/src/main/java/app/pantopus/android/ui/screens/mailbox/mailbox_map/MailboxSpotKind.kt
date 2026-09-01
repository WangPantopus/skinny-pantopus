@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A11.4 Mailbox map — the five mailbox-spot kinds. Each carries its pin
 * color (sourced from `mailbox-map-frames.jsx` KINDS) and a Lucide
 * glyph. The palette is mailbox-local, the same way `GigsCategory`
 * keeps the gig palette local. `Color(0xFF…)` on the enum is the
 * CI-safe escape hatch (the hex-grep guard only rejects `#RRGGBB`).
 *
 * Where the exact Lucide glyph isn't in the token set we fall back to
 * the closest match (mirrors `NearbyMapView.iconFor`).
 */
enum class MailboxSpotKind(
    val key: String,
    val label: String,
    val color: Color,
    val glyph: PantopusIcon,
) {
    Post("post", "Post offices", Color(0xFF1E40AF), PantopusIcon.Building2),
    Drop("drop", "Drop boxes", Color(0xFF0EA5E9), PantopusIcon.Mailbox),
    Locker("locker", "Lockers", Color(0xFF7C3AED), PantopusIcon.Package),
    Carrier("carrier", "Carriers", Color(0xFFB45309), PantopusIcon.Send), // closest token to lucide "truck"
    Civic("civic", "Civic", Color(0xFF15803D), PantopusIcon.Landmark),
}
