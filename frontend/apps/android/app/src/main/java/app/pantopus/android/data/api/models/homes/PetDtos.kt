@file:Suppress("LongParameterList")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Pet record returned by `GET /api/homes/:id/pets`. Maps the full
 * superset of fields the backend exposes — the design renders `name`,
 * `species`, `breed`, `notes`, and `photoUrl`.
 *
 * Schema: `backend/routes/home.js:6764` (`createPetSchema`).
 */
@JsonClass(generateAdapter = true)
data class PetDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val name: String,
    /** Wire enum: dog / cat / bird / fish / reptile / rabbit / hamster / other. */
    val species: String,
    val breed: String? = null,
    @Json(name = "age_years") val ageYears: Double? = null,
    @Json(name = "weight_lbs") val weightLbs: Double? = null,
    @Json(name = "vet_name") val vetName: String? = null,
    @Json(name = "vet_phone") val vetPhone: String? = null,
    @Json(name = "vet_address") val vetAddress: String? = null,
    @Json(name = "vaccine_notes") val vaccineNotes: String? = null,
    @Json(name = "feeding_schedule") val feedingSchedule: String? = null,
    val medications: String? = null,
    @Json(name = "microchip_id") val microchipId: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    val notes: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Envelope for `GET /api/homes/:id/pets`. */
@JsonClass(generateAdapter = true)
data class PetsResponse(
    val pets: List<PetDto> = emptyList(),
)

/** Envelope for `POST /api/homes/:id/pets` and `PUT …/pets/:petId`. */
@JsonClass(generateAdapter = true)
data class PetResponse(
    val pet: PetDto,
)

/**
 * Body for `POST /api/homes/:id/pets`. Matches `createPetSchema` in
 * `backend/routes/home.js:6764`. `name` and `species` are required; the
 * rest are optional. Nullable fields are serialised as `null` (or
 * omitted by Moshi when the entire field is dropped from the JSON
 * builder) — backend accepts both shapes via Joi's `.allow(null, '')`.
 */
@JsonClass(generateAdapter = true)
data class CreatePetRequest(
    val name: String,
    val species: String,
    val breed: String? = null,
    @Json(name = "age_years") val ageYears: Double? = null,
    @Json(name = "weight_lbs") val weightLbs: Double? = null,
    @Json(name = "vet_name") val vetName: String? = null,
    @Json(name = "vet_phone") val vetPhone: String? = null,
    @Json(name = "vet_address") val vetAddress: String? = null,
    @Json(name = "vaccine_notes") val vaccineNotes: String? = null,
    @Json(name = "feeding_schedule") val feedingSchedule: String? = null,
    val medications: String? = null,
    @Json(name = "microchip_id") val microchipId: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    val notes: String? = null,
)

/**
 * Body for `PUT /api/homes/:id/pets/:petId`. Mirrors `updatePetSchema`
 * (`createPetSchema.fork(['name','species'], optional)`).
 */
@JsonClass(generateAdapter = true)
data class UpdatePetRequest(
    val name: String? = null,
    val species: String? = null,
    val breed: String? = null,
    @Json(name = "age_years") val ageYears: Double? = null,
    @Json(name = "weight_lbs") val weightLbs: Double? = null,
    @Json(name = "vet_name") val vetName: String? = null,
    @Json(name = "vet_phone") val vetPhone: String? = null,
    @Json(name = "vet_address") val vetAddress: String? = null,
    @Json(name = "vaccine_notes") val vaccineNotes: String? = null,
    @Json(name = "feeding_schedule") val feedingSchedule: String? = null,
    val medications: String? = null,
    @Json(name = "microchip_id") val microchipId: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    val notes: String? = null,
)

/** Envelope for `DELETE /api/homes/:id/pets/:petId`. */
@JsonClass(generateAdapter = true)
data class PetDeleteResponse(
    val message: String? = null,
)
