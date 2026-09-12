package app.pantopus.android.data.homes

import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeResidencyProgressApi
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeResidencyProgressRepository
    @Inject
    constructor(retrofit: Retrofit) {
        private val api = retrofit.create(HomeResidencyProgressApi::class.java)

        suspend fun requests(after: String?) = safeApiCall { api.requests(after).also { check(it.follows(after)) } }

        suspend fun progress(home: String) = safeApiCall { api.progress(home).also { check(it.matches(home)) } }
    }
