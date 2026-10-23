package app.pantopus.android.data.api.models.identity

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Your Local Profile as How neighbors see you shows it: `GET`/`PATCH /api/local-profiles/me` and
 * `POST /api/upload/local-profile-picture` (`backend/utils/identityProfiles.js` ownLocalProfileView). The server
 * sends these keys in camelCase. Mirrors iOS `OwnLocalProfileResponse`.
 */
@JsonClass(generateAdapter = true)
data class OwnLocalProfileResponse(
    /** What other people see. */
    val profile: OwnLocalProfile,
    /** Your account's name and photo, for "Use my account name/photo". */
    val account: LocalProfileAccount,
    /** Whether each still follows your account: true until you choose another one for neighbors. */
    val followsAccount: LocalProfileFollows,
)

@JsonClass(generateAdapter = true)
data class OwnLocalProfile(
    val id: String,
    val handle: String? = null,
    val displayName: String,
    val avatarUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class LocalProfileAccount(
    val displayName: String,
    val avatarUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class LocalProfileFollows(
    val displayName: Boolean,
    val avatarUrl: Boolean,
)

/** `PATCH /api/local-profiles/me` body: the name, the photo, or both. */
data class LocalProfileUpdateRequest(
    val displayName: String? = null,
    val photo: Photo = Photo.Unchanged,
) {
    sealed interface Photo {
        data object Unchanged : Photo

        /** No photo: neighbors see initials (`avatar_url: null`). */
        data object None : Photo

        /** The account's photo, or the one the profile has. */
        data class Url(
            val url: String,
        ) : Photo
    }
}

/** Leaves an unchanged photo out while sending "no photo" as JSON null. */
class LocalProfileUpdateRequestJsonAdapter {
    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: LocalProfileUpdateRequest,
    ) {
        val previous = writer.serializeNulls
        writer.serializeNulls = true
        try {
            writer.beginObject()
            value.displayName?.let { writer.name("display_name").value(it) }
            when (val photo = value.photo) {
                LocalProfileUpdateRequest.Photo.Unchanged -> Unit
                LocalProfileUpdateRequest.Photo.None -> writer.name("avatar_url").nullValue()
                is LocalProfileUpdateRequest.Photo.Url -> writer.name("avatar_url").value(photo.url)
            }
            writer.endObject()
        } finally {
            writer.serializeNulls = previous
        }
    }

    @Suppress("UnusedParameter")
    @FromJson
    fun fromJson(reader: JsonReader): LocalProfileUpdateRequest =
        error("LocalProfileUpdateRequest is request-only; deserialization is not supported.")
}
