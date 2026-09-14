package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeRelationshipApi
import retrofit2.Retrofit
import javax.inject.Inject

class HomeRelationshipService
    @Inject
    constructor(retrofit: Retrofit) {
        val api: HomeRelationshipApi = retrofit.create(HomeRelationshipApi::class.java)
        val origin: String = retrofit.baseUrl().toString()
    }
