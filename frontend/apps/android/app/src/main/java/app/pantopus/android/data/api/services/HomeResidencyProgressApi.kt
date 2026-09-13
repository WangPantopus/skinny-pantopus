package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyPage
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyProgress
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.Path
import retrofit2.http.Query

interface HomeResidencyProgressApi {
    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/my-residency")
    suspend fun requests(
        @Query("after") after: String?,
    ): PersonalHomeResidencyPage

    @Headers("Cache-Control: no-cache, no-store")
    @GET("api/homes/{home}/my-residency")
    suspend fun progress(
        @Path("home") home: String,
    ): PersonalHomeResidencyProgress
}
