package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.sports.ActiveSportsEventsResponse
import retrofit2.http.GET

/**
 * Sports topic lane — read-only event registry backing the Pulse Sports
 * lane's mode chips and its active-event module. Mounted at
 * `/api/sports` (`backend/app.js:328`).
 */
interface SportsApi {
    /**
     * `GET /api/sports/active-events` — currently-active major events,
     * highest priority first. Route `backend/routes/sports.js:27`.
     */
    @GET("api/sports/active-events")
    suspend fun activeEvents(): ActiveSportsEventsResponse
}
