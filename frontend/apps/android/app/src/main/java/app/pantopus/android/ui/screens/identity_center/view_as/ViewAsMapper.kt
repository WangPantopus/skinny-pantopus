@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.identity_center.view_as

import app.pantopus.android.data.api.models.identity.ViewAsContextDto
import app.pantopus.android.data.api.models.identity.ViewAsLocality
import app.pantopus.android.data.api.models.identity.ViewAsResponse
import app.pantopus.android.data.api.models.identity.ViewAsStats
import app.pantopus.android.data.api.models.identity.ViewAsViewerRelationship
import app.pantopus.android.ui.components.ViewerAudience
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * P1-F — projects the privacy-resolved `view-as` response onto the design
 * [ViewAsRender] (mirrors iOS `ViewAsViewModel.makeRender`). Optional `visible`
 * fields degrade to [ViewAsFieldDisclosure.Hidden] so a sparse payload never
 * crashes.
 */
object ViewAsMapper {
    private const val RESTRICTED_HIDDEN_FIELD_THRESHOLD = 3

    /** Map the audience onto the backend `surface` + `viewer` query. */
    fun backendParams(audience: ViewerAudience): Pair<String, String> =
        when (audience) {
            ViewerAudience.Public -> "local" to "public"
            ViewerAudience.PersonaAudience -> "persona" to "persona_audience_member"
            ViewerAudience.Neighbor -> "local" to "neighbor"
            ViewerAudience.GigParticipant -> "local" to "gig_participant"
            ViewerAudience.Household -> "local" to "household_member"
            ViewerAudience.Connection -> "local" to "connection"
        }

    fun render(
        response: ViewAsResponse,
        audience: ViewerAudience,
    ): ViewAsRender {
        val visible = response.visible
        val hidden = (response.hidden ?: emptyList()).map { it.lowercase() }.toSet()
        val fields =
            listOf(
                locationField(visible?.locality, hidden),
                ViewAsField("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Hidden),
                ratingField(visible?.stats),
                mutualsField(response.context, hidden),
                contactField(visible?.viewer, hidden),
            )
        val tone =
            if (fields.count { it.disclosure.isHidden } >= RESTRICTED_HIDDEN_FIELD_THRESHOLD) {
                ViewAsTone.Restricted
            } else {
                ViewAsTone.Info
            }
        val label = response.viewerLabel ?: audience.label
        val name = visible?.displayName ?: "You"
        return ViewAsRender(
            viewer = audience,
            banner =
                ViewAsBanner(
                    icon = bannerIcon(audience),
                    viewerLabel = label,
                    subtitle = if (tone == ViewAsTone.Restricted) "Most details are hidden" else "This is what they see",
                    tone = tone,
                ),
            head =
                ViewAsHead(
                    name = name,
                    handle = visible?.handle?.let { "@$it" },
                    initials = initials(name),
                    avatarTone = if (audience == ViewerAudience.Public) ViewAsAvatarTone.Masked else ViewAsAvatarTone.Personal,
                    identity = ViewAsIdentityPill.Personal,
                    verified = visible?.badges?.contains("verified_resident") ?: false,
                ),
            badges = badges(visible?.badges ?: emptyList()),
            fields = fields,
            note =
                ViewAsContextNote(
                    icon = if (tone == ViewAsTone.Restricted) PantopusIcon.EyeOff else PantopusIcon.Users,
                    text = noteText(tone, label),
                    tone = tone,
                ),
            footerText = "Resolved live from your privacy settings.",
        )
    }

    private fun locationField(
        locality: ViewAsLocality?,
        hidden: Set<String>,
    ): ViewAsField {
        val neighborhood = locality?.neighborhood
        val city = locality?.city
        val disclosure =
            when {
                hidden.any { it.contains("local") } -> ViewAsFieldDisclosure.Hidden
                !neighborhood.isNullOrEmpty() -> ViewAsFieldDisclosure.Visible(neighborhood)
                !city.isNullOrEmpty() -> {
                    val state = locality?.state?.let { ", $it" } ?: ""
                    ViewAsFieldDisclosure.Coarse("$city$state")
                }
                else -> ViewAsFieldDisclosure.Hidden
            }
        return ViewAsField("location", PantopusIcon.MapPin, "Location", disclosure)
    }

    private fun ratingField(stats: ViewAsStats?): ViewAsField {
        val reviews = stats?.reviews ?: 0
        val disclosure =
            if (reviews > 0) {
                ViewAsFieldDisclosure.Visible("$reviews review${if (reviews == 1) "" else "s"}")
            } else {
                ViewAsFieldDisclosure.Hidden
            }
        return ViewAsField("rating", PantopusIcon.Star, "Rating", disclosure)
    }

    private fun mutualsField(
        context: ViewAsContextDto?,
        hidden: Set<String>,
    ): ViewAsField {
        val shared =
            (context?.isConnection == true || context?.isNeighbor == true) &&
                hidden.none { it.contains("mutual") || it.contains("connection") }
        val disclosure =
            if (shared) ViewAsFieldDisclosure.Visible("Mutual neighbors in common") else ViewAsFieldDisclosure.Hidden
        return ViewAsField("mutuals", PantopusIcon.Users, "Mutual connections", disclosure)
    }

    private fun contactField(
        viewer: ViewAsViewerRelationship?,
        hidden: Set<String>,
    ): ViewAsField {
        val canContact =
            viewer?.canMessage == true && hidden.none { it.contains("contact") || it.contains("phone") }
        val disclosure =
            if (canContact) ViewAsFieldDisclosure.Visible("Available on request") else ViewAsFieldDisclosure.Hidden
        return ViewAsField("contact", PantopusIcon.Phone, "Contact", disclosure)
    }

    private fun badges(keys: List<String>): List<ViewAsBadge> {
        val set = keys.toSet()
        return listOf(
            ViewAsBadge(
                "resident",
                if (set.contains("verified_resident")) PantopusIcon.BadgeCheck else PantopusIcon.Lock,
                "Verified neighbor",
                set.contains("verified_resident"),
            ),
            ViewAsBadge(
                "id",
                if (set.contains("id_verified")) PantopusIcon.BadgeCheck else PantopusIcon.Lock,
                "ID verified",
                set.contains("id_verified"),
            ),
            ViewAsBadge(
                "phone",
                if (set.contains("phone_verified")) PantopusIcon.Phone else PantopusIcon.Lock,
                "Phone verified",
                set.contains("phone_verified"),
            ),
        )
    }

    private fun bannerIcon(audience: ViewerAudience): PantopusIcon =
        when (audience) {
            ViewerAudience.Public -> PantopusIcon.Globe
            ViewerAudience.PersonaAudience -> PantopusIcon.Megaphone
            ViewerAudience.Neighbor -> PantopusIcon.MapPin
            ViewerAudience.GigParticipant -> PantopusIcon.Briefcase
            ViewerAudience.Household -> PantopusIcon.Home
            ViewerAudience.Connection -> PantopusIcon.UserCheck
        }

    private fun noteText(
        tone: ViewAsTone,
        label: String,
    ): String =
        if (tone == ViewAsTone.Restricted) {
            "Most details stay private to ${label.lowercase()}."
        } else {
            "$label sees your shared local profile and approximate area."
        }

    private fun initials(name: String): String {
        val letters = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString("")
        return letters.ifEmpty { "?" }.uppercase()
    }
}
