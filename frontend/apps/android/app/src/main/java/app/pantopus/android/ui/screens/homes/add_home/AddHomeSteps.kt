@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

/**
 * The four pre-success steps of the Add-Home wizard, in order. The
 * success state is a sentinel terminal step used to render the success
 * hero block.
 */
enum class AddHomeStep(
    val ordinal0: Int,
) {
    Address(0),
    Confirm(1),
    Role(2),
    Review(3),
    Success(4),
    ;

    /** One-indexed position used in the "N of M" top-bar readout, or null
     *  for the success terminal. */
    val stepNumber: Int?
        get() =
            when (this) {
                Address -> 1
                Confirm -> 2
                Role -> 3
                Review -> 4
                Success -> null
            }

    companion object {
        /** Total number of "step N of M" steps shown in the readout. */
        const val PROGRESS_TOTAL: Int = 4

        fun fromOrdinal(value: Int): AddHomeStep = entries.firstOrNull { it.ordinal0 == value } ?: Address
    }
}

/**
 * Structured address fields selected by the search-first step. The
 * source is a deterministic candidate fixture until the API contract
 * lands, but downstream wizard steps keep consuming this shape.
 */
data class AddHomeAddressFields(
    val street: String = "",
    val unit: String = "",
    val city: String = "",
    val state: String = "",
    val zipCode: String = "",
) {
    /** True when every required component has at least one non-blank char. */
    val isComplete: Boolean
        get() =
            street.trim().isNotEmpty() &&
                city.trim().isNotEmpty() &&
                state.trim().isNotEmpty() &&
                zipCode.trim().isNotEmpty()
}

/** User's role on the home being added — picked in step 3. */
enum class AddHomeRole(
    val label: String,
    /**
     * `claimed_role` sent with `POST /api/homes/:id/claim`
     * (`backend/routes/home.js:6482`). Values mirror RN's role picker
     * (`src/components/homes/types.ts:17-20`).
     */
    val claimedRole: String,
) {
    Owner("Owner", "owner"),
    Tenant("Tenant", "renter"),
    HouseholdMember("Household member", "household"),
}

/**
 * Canonical `home_type` values accepted by `createHomeSchema`
 * (`backend/routes/home.js:70`), paired with the chip labels RN shows in
 * its Details step (`src/components/homes/types.ts:12-14`).
 *
 * RN's picker sends its own label lowercased, which emits `duplex` — a
 * value the Joi enum rejects. We carry the canonical key on the case and
 * show only the label, so the chip reads "Duplex" and the wire value is
 * the valid `multi_unit`.
 */
enum class AddHomeHomeType(
    val wireValue: String,
    val label: String,
) {
    House("house", "House"),
    Apartment("apartment", "Apartment"),
    Condo("condo", "Condo"),
    Townhouse("townhouse", "Townhouse"),
    Studio("studio", "Studio"),
    MultiUnit("multi_unit", "Duplex"),
    MobileHome("mobile_home", "Mobile Home"),
    Rv("rv", "RV"),
    Trailer("trailer", "Trailer"),
    Other("other", "Other"),
    ;

    companion object {
        /** Decode a canonical `home_type` from `property-suggestions`. */
        fun fromCanonical(value: String?): AddHomeHomeType? {
            val key = value?.lowercase() ?: return null
            return entries.firstOrNull { it.wireValue == key }
        }
    }
}

/**
 * The eight editable property fields RN's Details step collects
 * (`src/components/homes/DetailsStep.tsx:113-172`), pre-filled from
 * `POST /api/homes/property-suggestions`. Kept as strings so partially
 * typed numeric input round-trips without clobbering the user's edit.
 */
data class AddHomeDetailsFields(
    val nickname: String = "",
    val homeType: AddHomeHomeType = AddHomeHomeType.House,
    val bedrooms: String = "",
    val bathrooms: String = "",
    val sqFt: String = "",
    val lotSqFt: String = "",
    val yearBuilt: String = "",
    val description: String = "",
)

/**
 * `access_type` values RN offers on the Setup step
 * (`src/components/homes/types.ts:26-34`). [wireValue] is the value sent
 * on `POST /api/homes/:id/access` (`backend/routes/home.js:5735`).
 */
enum class AddHomeAccessType(
    val wireValue: String,
    val label: String,
    /**
     * Fallback label applied when the user picks a type without having
     * typed one (RN `DEFAULT_ACCESS_LABELS`, `types.ts:36-44`).
     */
    val defaultLabel: String,
) {
    Wifi("wifi", "WiFi", "Main WiFi"),
    DoorCode("door_code", "Door code", "Front door"),
    GateCode("gate_code", "Gate code", "Gate"),
    Lockbox("lockbox", "Lockbox", "Lockbox"),
    Garage("garage", "Garage", "Garage"),
    Alarm("alarm", "Alarm", "Alarm"),
    Other("other", "Other", "Access code"),
    ;

    val valueFieldLabel: String get() = if (this == Wifi) "Password" else "Code / value"

    val valuePlaceholder: String get() = if (this == Wifi) "••••••••" else "Enter code"

    val labelPlaceholder: String
        get() = if (this == Wifi) "e.g. Main WiFi, Guest" else "e.g. Front door"
}

/**
 * One "Networks & codes" row on the Setup step. Filled rows are POSTed to
 * `POST /api/homes/:id/access` once the home exists — RN does the same in
 * `finalizeCreatedHome` (`useHomeForm.ts:321-336`).
 *
 * Deliberately **not** part of [AddHomeFormState]: the secret value is a
 * Wi-Fi / alarm / gate password and must never reach `SavedStateHandle`.
 */
data class AddHomeAccessItem(
    val id: String,
    val accessType: AddHomeAccessType = AddHomeAccessType.Wifi,
    val label: String = "",
    val secretValue: String = "",
    /** Per-row reveal toggle for the masked secret field. */
    val isRevealed: Boolean = false,
    val labelError: String? = null,
    val valueError: String? = null,
) {
    val isComplete: Boolean
        get() = label.isNotBlank() && secretValue.isNotBlank()
}

/**
 * Snapshot of all wizard form state. The view model mirrors each field
 * into [androidx.lifecycle.SavedStateHandle] so the wizard survives
 * config changes and process death (acceptance criterion #5).
 */
data class AddHomeFormState(
    val step: Int = AddHomeStep.Address.ordinal0,
    val address: AddHomeAddressFields = AddHomeAddressFields(),
    val isPrimary: Boolean = true,
    val role: AddHomeRole? = null,
    /**
     * Details step fields (nickname / type / beds / baths / sizes / year /
     * description).
     */
    val details: AddHomeDetailsFields = AddHomeDetailsFields(),
) {
    val currentStep: AddHomeStep
        get() = AddHomeStep.fromOrdinal(step)

    companion object {
        val EMPTY = AddHomeFormState()
    }
}

/**
 * Parse a `WIFI:`-prefixed QR payload into SSID + password. Verbatim port
 * of RN's `parseWifiQr` (`src/components/homes/utils.ts:17-37`) —
 * including escape handling for `\;`, `\,`, `\:` and `\\`.
 */
fun parseWifiQrPayload(raw: String): Pair<String, String>? {
    if (!raw.startsWith("WIFI:")) return null
    var ssid = ""
    var password = ""
    for (part in raw.removePrefix("WIFI:").split(";")) {
        val separator = part.indexOf(':')
        if (separator <= 0) continue
        val key = part.substring(0, separator)
        val value = unescapeWifiQrValue(part.substring(separator + 1))
        if (key == "S") ssid = value
        if (key == "P") password = value
    }
    if (ssid.isEmpty()) return null
    return ssid to password
}

/** `\;` → `;`, `\,` → `,`, `\:` → `:`, `\\` → `\`. */
fun unescapeWifiQrValue(value: String): String {
    val out = StringBuilder()
    var escaping = false
    for (character in value) {
        when {
            escaping -> {
                if (character in ";,:\\") {
                    out.append(character)
                } else {
                    out.append('\\').append(character)
                }
                escaping = false
            }
            character == '\\' -> escaping = true
            else -> out.append(character)
        }
    }
    if (escaping) out.append('\\')
    return out.toString()
}

/** Outbound navigation events the screen consumes. */
sealed interface AddHomeOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : AddHomeOutboundEvent

    /** Pop the wizard and navigate to the new home dashboard. */
    data class OpenHomeDashboard(
        val homeId: String,
    ) : AddHomeOutboundEvent

    /**
     * `check-address` matched an already-claimed home and the user
     * picked the owner role — hand off to the ownership-claim wizard
     * for that existing home rather than creating a duplicate row.
     * Mirrors RN `useHomeForm.ts:461`.
     */
    data class OpenClaimOwnership(
        val homeId: String,
    ) : AddHomeOutboundEvent

    /**
     * Residency claim filed against an existing home — RN routes to the
     * waiting room (`useHomeForm.ts:466`).
     */
    data class OpenWaitingRoom(
        val homeId: String,
    ) : AddHomeOutboundEvent
}
