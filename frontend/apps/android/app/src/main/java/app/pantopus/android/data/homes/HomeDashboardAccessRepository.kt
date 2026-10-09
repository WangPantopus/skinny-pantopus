package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.net.Conditional
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.services.HomeDashboardApi
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.Stored
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import retrofit2.HttpException
import javax.inject.Inject

class HomeDashboardAccessRepository
    @Inject
    constructor(
        private val api: HomeDashboardApi,
        moshi: Moshi,
        private val store: ScreenStore,
    ) {
        private val adapter = moshi.adapter(HomeDashboardAuthorityDto::class.java)

        /** Preserve only this endpoint's typed 403 context, after normal auth/step-up interception. */
        suspend fun read(homeId: String): HomeDashboardAuthorityDto {
            val response = api.dashboardAuthority(homeId)
            val authority =
                when (response.code()) {
                    java.net.HttpURLConnection.HTTP_OK -> response.body()?.takeIf { it.hasAccess && it.isOwner != null }
                    java.net.HttpURLConnection.HTTP_FORBIDDEN ->
                        response.errorBody()?.use { adapter.fromJson(it.source()) }
                            ?.takeIf { !it.hasAccess && it.permissions.isEmpty() }
                    else -> throw HttpException(response)
                }
            return authority ?: throw JsonDataException("Current Home authority could not be confirmed.")
        }

        /**
         * The viewer's access through the screens' store (Instant Screens): a fresh copy answers without a request,
         * otherwise one conditional request. Decides who may see a stored copy of a Home screen (founder decision 3).
         * A 403 or 404 drops the copy; [read] keeps the typed 403 for the dashboard's limited view.
         */
        suspend fun readStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomeDashboardAuthorityDto> =
            store.read(HomeStoreKeys.access(homeId), force) { etag ->
                conditionalApiCall { api.dashboardAuthorityConditional(homeId, etag) }.confirmed(homeId)
            }

        /** The stored access copy, without a request; null when there is none. */
        fun storedAuthority(homeId: String): HomeDashboardAuthorityDto? = store.peek(HomeStoreKeys.access(homeId)).data

        private fun NetworkResult<Conditional<HomeDashboardAuthorityDto>>.confirmed(
            homeId: String,
        ): NetworkResult<Conditional<HomeDashboardAuthorityDto>> {
            val reply = ((this as? NetworkResult.Success)?.data as? Conditional.Fresh)?.data ?: return this
            return if (reply.homeId == homeId && reply.hasAccess && reply.isOwner != null) {
                this
            } else {
                NetworkResult.Failure(NetworkError.Decoding(JsonDataException("Current Home authority could not be confirmed.")))
            }
        }
    }
