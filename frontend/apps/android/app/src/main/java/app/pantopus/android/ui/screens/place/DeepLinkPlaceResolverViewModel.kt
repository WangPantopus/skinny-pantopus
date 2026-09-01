package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/**
 * On-demand primary-home resolution for BARE Place deep links
 * (`pantopus://place?section=risk` — a push names a section but no home).
 * iOS resolves the primary home and still lands on the group detail
 * (`HubTabRoot.primaryHomeId()`); Android used to drop the slug and dump
 * the user on the generic Home tab. Deliberately fetches nothing at
 * construction — the deep-link handler calls it only when needed.
 */
@HiltViewModel
class DeepLinkPlaceResolverViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
    ) : ViewModel() {
        /** The `is_primary_owner` home, else the first home, else null. */
        suspend fun primaryHomeId(): String? =
            when (val result = homesRepository.myHomes()) {
                is NetworkResult.Success -> {
                    val homes = result.data.homes
                    (homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull())?.id
                }
                is NetworkResult.Failure -> null
            }
    }
