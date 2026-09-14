@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homedashboard

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Minimal current Home authority; a denied response contains no shared Home content. */
@JsonClass(generateAdapter = true)
data class HomeDashboardAuthorityDto(
    val hasAccess: Boolean,
    val permissions: List<String>,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "access_revision") val accessRevision: String,
    @Json(name = "is_owner") val isOwner: Boolean? = null,
    @Json(name = "role_base") val roleBase: String? = null,
    @Json(name = "verification_required") val verificationRequired: Boolean = false,
    @Json(name = "verification_kind") val verificationKind: String? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
)
