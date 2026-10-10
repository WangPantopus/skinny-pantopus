package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.homes.HomeDashboardAccessRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKey
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject

/**
 * Founder decision 3 (Instant Screens contract §5) for one Home screen. Owners and household roles see the screen's
 * stored copy at once while it is re-checked; guests, service providers and anyone whose access expires keep
 * blank-and-re-check, and their entries leave the store with the screen. The viewer's role and expiry come from the
 * stored `dashboard-access` reply, the one Home read that carries the expiry.
 */
class HomeCopyGate(
    private val homeId: String,
    private val access: HomeDashboardAccessRepository,
    private val store: ScreenStore,
    keys: List<StoreKey<*>>,
) {
    private val keys: List<StoreKey<*>> =
        keys +
            listOf(
                HomeStoreKeys.access(homeId), HomeStoreKeys.detail(homeId), HomeStoreKeys.me(homeId), StoreKeys.homeDashboard(homeId),
            )

    /** The last known access is a household one: copies may show before the re-check, and they stay stored. */
    private var allowsCopy: Boolean = householdAccess(access.storedAuthority(homeId))
    var showsCopy: Boolean
        get() = allowsCopy && householdAccess(access.storedAuthority(homeId))
        private set(value) {
            allowsCopy = value
        }

    /**
     * Re-checks the viewer's access through the store, alongside the screen's own reads. [force] for pull to refresh
     * and Retry; a viewer not known to hold household access always reads now.
     */
    suspend fun recheck(force: Boolean): Stored<HomeDashboardAuthorityDto> =
        access.readStored(homeId, force || !showsCopy).also { showsCopy = householdAccess(it.data) }

    /** A screen that reads the viewer's access itself (the dashboard) reports what it read. */
    fun observe(authority: HomeDashboardAuthorityDto?) {
        showsCopy = householdAccess(authority)
    }

    /** An explicit access refusal retires this screen's copies before another visit can show them. */
    fun invalidate() {
        showsCopy = false
        keys.forEach(store::remove)
    }

    /** The screen left: the entries of a viewer without household access go with it. */
    fun leave() {
        if (!showsCopy) keys.forEach(store::remove)
    }

    companion object {
        private val HOUSEHOLD_ROLES = setOf("owner", "admin", "manager", "member", "lease_resident", "restricted_member")

        /** An owner or household role, confirmed, with no expiry. */
        fun householdAccess(authority: HomeDashboardAuthorityDto?): Boolean =
            authority != null &&
                authority.hasAccess &&
                authority.accessExpiresAt == null &&
                (authority.isOwner == true || authority.roleBase in HOUSEHOLD_ROLES)
    }
}

/** Builds one [HomeCopyGate] per Home screen. */
class HomeCopyGateFactory
    @Inject
    constructor(
        private val access: HomeDashboardAccessRepository,
        private val store: ScreenStore,
    ) {
        fun create(
            homeId: String,
            keys: List<StoreKey<*>>,
        ): HomeCopyGate = HomeCopyGate(homeId, access, store, keys)
    }
