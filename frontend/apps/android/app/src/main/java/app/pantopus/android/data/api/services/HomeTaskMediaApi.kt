package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeTaskMediaList
import app.pantopus.android.data.api.models.homes.HomeTaskMediaRemoval
import app.pantopus.android.data.api.models.homes.HomeTaskMediaUpload
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Streaming

interface HomeTaskMediaApi {
    @Headers("Cache-Control: no-store")
    @GET("api/upload/home-task-media/{home}/{task}")
    suspend fun list(
        @Path("home") homeId: String,
        @Path("task") taskId: String,
        @Header("x-pantopus-session-scope") session: String,
    ): HomeTaskMediaList

    @Multipart
    @POST("api/upload/home-task-media/{home}/{task}")
    suspend fun upload(
        @Path("home") homeId: String,
        @Path("task") taskId: String,
        @Header("x-pantopus-session-scope") session: String,
        @Part("upload_id") uploadId: RequestBody,
        @Part file: MultipartBody.Part,
    ): HomeTaskMediaUpload

    @Streaming
    @Headers("Cache-Control: no-store")
    @GET("api/upload/home-task-media/{home}/{task}/{media}/download")
    suspend fun download(
        @Path("home") homeId: String,
        @Path("task") taskId: String,
        @Path("media") mediaId: String,
        @Header("x-pantopus-session-scope") session: String,
    ): Response<ResponseBody>

    @DELETE("api/upload/home-task-media/{home}/{task}/{media}")
    suspend fun remove(
        @Path("home") homeId: String,
        @Path("task") taskId: String,
        @Path("media") mediaId: String,
        @Header("x-pantopus-session-scope") session: String,
    ): HomeTaskMediaRemoval
}
