package app.pantopus.android.data.crewday

import app.pantopus.android.data.api.models.geo.GeoResolveRequest
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.geo.NormalizedAddress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GeoApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Address autocomplete for Crew Day: a household's home on "Your price" (screen 2) and a crew's center on "Where
 * and when" (screen 14). The existing `GET /api/geo/autocomplete` and `POST /api/geo/resolve`.
 */
@Singleton
open class CrewDayAddresses
    @Inject
    constructor(
        private val geo: GeoApi,
    ) {
        /** Suggestions for [query]; empty under three characters or when the lookup fails. */
        open suspend fun suggest(query: String): List<GeoSuggestion> {
            if (query.trim().length < MIN_QUERY) return emptyList()
            return (safeApiCall { geo.autocomplete(query.trim()) } as? NetworkResult.Success)?.data?.suggestions.orEmpty()
        }

        /** The normalized address (street, city, state, zip and its point) for a picked suggestion. */
        open suspend fun resolve(suggestion: GeoSuggestion): NetworkResult<NormalizedAddress> =
            safeApiCall { geo.resolve(GeoResolveRequest(suggestion.suggestionId)).normalized }

        private companion object {
            const val MIN_QUERY = 3
        }
    }
