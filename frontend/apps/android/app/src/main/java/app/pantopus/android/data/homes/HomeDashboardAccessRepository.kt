package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.services.HomeDashboardApi
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import retrofit2.HttpException
import javax.inject.Inject

class HomeDashboardAccessRepository
    @Inject
    constructor(
        private val api: HomeDashboardApi,
        moshi: Moshi,
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
    }
