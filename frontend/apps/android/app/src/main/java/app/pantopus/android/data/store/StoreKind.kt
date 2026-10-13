package app.pantopus.android.data.store

private const val SECOND = 1_000L
private const val MINUTE = 60 * SECOND
private const val HOUR = 60 * MINUTE
private const val DAY = 24 * HOUR

/** Instant Screens contract §5. Sensitive replies (codes, documents, money, identity) never enter the store. */
enum class StoreTier {
    /** Public place facts, weather, Today, Nearby, your own profile and settings. */
    EVERYDAY,

    /** My Homes, a Home's dashboard, members, tasks, the Messages list: shown from a copy to owners and household roles only. */
    HOUSEHOLD,
}

/**
 * Instant Screens contract §4. Each kind of data has three separate settings: [freshForMs] (coming back inside it sends
 * no request), [maxShownAgeMs] (an older copy gets the quiet "Couldn't refresh" line when a read fails) and
 * [savedOnPhone] (whether the saved copy may keep it). These are the coordinator's starting values; tune the table in
 * the contract, never one platform.
 */
enum class StoreKind(
    val freshForMs: Long,
    val maxShownAgeMs: Long,
    val tier: StoreTier,
    val savedOnPhone: Boolean,
) {
    PUBLIC_PLACE(DAY, 7 * DAY, StoreTier.EVERYDAY, true),
    TODAY(10 * MINUTE, 2 * HOUR, StoreTier.EVERYDAY, true),
    TODAY_ALERTS(5 * MINUTE, 30 * MINUTE, StoreTier.EVERYDAY, true),
    PLACE(10 * MINUTE, DAY, StoreTier.HOUSEHOLD, true),
    HOMES(2 * MINUTE, DAY, StoreTier.HOUSEHOLD, true),
    NEARBY(2 * MINUTE, DAY, StoreTier.EVERYDAY, true),
    POST(MINUTE, DAY, StoreTier.EVERYDAY, false),
    MESSAGES_LIST(30 * SECOND, DAY, StoreTier.HOUSEHOLD, true),
    CONVERSATION(0, DAY, StoreTier.HOUSEHOLD, false),
    NOTIFICATIONS(30 * SECOND, DAY, StoreTier.EVERYDAY, false),
    YOU(10 * MINUTE, 7 * DAY, StoreTier.EVERYDAY, true),
    PEOPLE(5 * MINUTE, DAY, StoreTier.EVERYDAY, false),
    SUPPORT_TRAINS(MINUTE, DAY, StoreTier.EVERYDAY, false),
}
