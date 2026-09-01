package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Unlisted (Wave 4) — "type your address to get it off the internet".
 *
 * Routes: `backend/routes/public.js:567` (anonymous, persists NOTHING)
 * and `backend/routes/unlisted.js:31 / :64` (claimed home, T1+ — NOT
 * gated on verification). Service `backend/services/unlistedService.js`.
 *
 * TWO NULLS CARRY MEANING HERE, and the UI must render them
 * differently from empty:
 *
 *  * [UnlistedProfile.stateProgram] `null` means WE DID NOT CHECK this
 *    state — never "this state has no program". Those are different
 *    claims and only the second one, which arrives as
 *    `exists: false` with its own source, is ours to make. Collapsing
 *    them tells someone in danger that no help exists when we simply
 *    did not look.
 *  * [UnlistedProfile.removals] `null` means the progress READ FAILED.
 *    An empty list means "nothing recorded yet" — a confident claim we
 *    cannot make when the read failed.
 *
 * NOTHING HERE ASSERTS THAT A PERSON IS LISTED ANYWHERE. We do not
 * query these sites: searching them would hand them the address. That
 * is why there is no `found` field, and why [UnlistedProfile.methodNote]
 * must be rendered verbatim near the broker list — without it the page
 * implies a scan it never performed.
 */

/** How a broker's opt-out is actually filed. */
enum class UnlistedRemovalMethod {
    @Json(name = "web_form")
    WEB_FORM,

    @Json(name = "email")
    EMAIL,

    @Json(name = "phone")
    PHONE,

    @Json(name = "mail")
    MAIL,

    @Json(name = "account_required")
    ACCOUNT_REQUIRED,

    /** Registered in `PlaceEnumAdapterFactory` — a declared but
     * unregistered UNKNOWN still throws. */
    UNKNOWN,
}

/**
 * Where the resident has got to with one broker. The removal happens on
 * the broker's own site — this is bookkeeping the resident owns, never
 * a claim that Pantopus removed anything for them.
 *
 * [wire] is the exact value the PUT body accepts; UNKNOWN carries none
 * and must never be sent (the server answers `BAD_STATUS`).
 */
enum class UnlistedRemovalStatus(
    val wire: String,
) {
    @Json(name = "todo")
    TODO("todo"),

    @Json(name = "requested")
    REQUESTED("requested"),

    @Json(name = "confirmed")
    CONFIRMED("confirmed"),

    /** The site put the address back. Not a failure state — a real one. */
    @Json(name = "relisted")
    RELISTED("relisted"),

    UNKNOWN(""),
    ;

    val isSendable: Boolean get() = wire.isNotEmpty()
}

/**
 * The state's escape hatch — a legal substitute address that fixes this
 * at the SOURCE instead of chasing it across thirty sites forever. For
 * the reader this page has, it is worth more than every opt-out link
 * combined, so it leads.
 *
 * [exists] `false` is a VERIFIED ABSENCE with a source, and
 * [eligibility] then carries what the state DOES offer instead. The
 * un-checked case never reaches this type at all — it is a null
 * [UnlistedProfile.stateProgram].
 */
@JsonClass(generateAdapter = true)
data class UnlistedStateProgram(
    /**
     * NULL when the server did not state it. **ABSENT IS NOT `false`.**
     * Defaulting an unread field to `false` would make the view say
     * "your state has none" off a fact we never actually read — the
     * exact collapse the three answers exist to prevent. A null here
     * resolves to [UnlistedStateProgramAnswer.Unconfirmed], never to
     * [UnlistedStateProgramAnswer.NoProgram]. Parity twin of the iOS
     * `UnlistedStateProgram.exists: Bool?`.
     */
    val exists: Boolean? = null,
    val name: String = "",
    val url: String = "",
    /** One sentence: who qualifies — or, when [exists] is false, what
     * the state offers in its place. Never empty on the wire. */
    val eligibility: String = "",
    @Json(name = "source_url") val sourceUrl: String = "",
    @Json(name = "verified_at") val verifiedAt: String? = null,
) {
    /** A program that exists must be reachable; one that does not must
     * not carry a dangling link. */
    val hasOfficialLink: Boolean get() = exists == true && url.startsWith("http")
}

/**
 * Which of the THREE state answers this profile carries. They are three
 * different claims and only one of them — [NoProgram] — says the state
 * has none, which is only ever ours to say when we actually checked.
 *
 * Read this instead of testing [UnlistedProfile.stateProgram] directly:
 * it is the single place the collapse can be prevented, and the only
 * one a test can pin.
 */
sealed interface UnlistedStateProgramAnswer {
    /** `exists: true` — the program, who qualifies, and its official page. */
    data class Program(
        val program: UnlistedStateProgram,
    ) : UnlistedStateProgramAnswer

    /** `exists: false` — a VERIFIED absence, with a source, and
     * `eligibility` carrying what the state does offer instead. */
    data class NoProgram(
        val program: UnlistedStateProgram,
    ) : UnlistedStateProgramAnswer

    /**
     * We did not check — a null `state_program`, or one whose `exists`
     * we could not read. NEVER rendered as "your state has none".
     */
    data object Unconfirmed : UnlistedStateProgramAnswer
}

/** One site that republishes county property records, and the way out. */
@JsonClass(generateAdapter = true)
data class UnlistedBroker(
    /** Stable kebab-case slug — removal rows key on it. */
    val id: String,
    val name: String,
    val category: String = "",
    /** Tokens resolved through [UnlistedProfile.exposureLabels]. */
    val exposes: List<String> = emptyList(),
    @Json(name = "opt_out_url") val optOutUrl: String = "",
    val method: UnlistedRemovalMethod = UnlistedRemovalMethod.UNKNOWN,
    @Json(name = "requires_id") val requiresId: Boolean = false,
    @Json(name = "requires_email") val requiresEmail: Boolean = false,
    /** `0` means NO processing time is published — "not stated", never
     * "0 days". */
    @Json(name = "typical_days") val typicalDays: Int = 0,
    /** The caveat the person actually needs: a dead form, a flow only
     * partly verified, a site that relists you. Render it whole. */
    val note: String = "",
    @Json(name = "source_url") val sourceUrl: String = "",
    @Json(name = "verified_at") val verifiedAt: String? = null,
) {
    val statesProcessingTime: Boolean get() = typicalDays > 0
}

/** Brokers grouped in the order a person should work through them. */
@JsonClass(generateAdapter = true)
data class UnlistedGroup(
    val category: String = "",
    val label: String = "",
    val brokers: List<UnlistedBroker> = emptyList(),
)

/** One recorded step. Stamps are never cleared by a later transition. */
@JsonClass(generateAdapter = true)
data class UnlistedRemoval(
    @Json(name = "broker_id") val brokerId: String,
    val status: UnlistedRemovalStatus = UnlistedRemovalStatus.UNKNOWN,
    @Json(name = "requested_at") val requestedAt: String? = null,
    @Json(name = "confirmed_at") val confirmedAt: String? = null,
)

/**
 * The exposure profile. Identical for everyone in a state by
 * construction — it is law and a public registry, not anything about
 * the person — which is exactly why the anonymous path can serve it
 * without storing the address.
 */
@JsonClass(generateAdapter = true)
data class UnlistedProfile(
    val state: String? = null,
    /** NULL = we did not check. NEVER render as "your state has none". */
    @Json(name = "state_program") val stateProgram: UnlistedStateProgram? = null,
    val groups: List<UnlistedGroup> = emptyList(),
    @Json(name = "broker_count") val brokerCount: Int = 0,
    /** Exposure token → human label. */
    @Json(name = "exposure_labels") val exposureLabels: Map<String, String> = emptyMap(),
    /** MUST be rendered verbatim, visibly, near the broker list. */
    @Json(name = "method_note") val methodNote: String = "",
    @Json(name = "registry_verified_at") val registryVerifiedAt: String? = null,
    /**
     * NULL = the progress read FAILED (present only on the claimed-home
     * route). An empty list = nothing recorded yet. The UI must not
     * show a confident empty checklist for a failed read.
     */
    val removals: List<UnlistedRemoval>? = null,
) {
    /**
     * WHICH of the three state answers this is. Only [
     * UnlistedStateProgramAnswer.NoProgram] says the state runs none,
     * and it is reached only from a `false` we actually read. A null
     * program — or one with no readable `exists` — is
     * [UnlistedStateProgramAnswer.Unconfirmed].
     */
    val stateProgramAnswer: UnlistedStateProgramAnswer
        get() {
            val program = stateProgram ?: return UnlistedStateProgramAnswer.Unconfirmed
            val exists = program.exists ?: return UnlistedStateProgramAnswer.Unconfirmed
            return if (exists) {
                UnlistedStateProgramAnswer.Program(program)
            } else {
                UnlistedStateProgramAnswer.NoProgram(program)
            }
        }

    /** This broker's recorded step, or null when nothing is recorded. */
    fun removalFor(brokerId: String): UnlistedRemoval? = removals?.firstOrNull { it.brokerId == brokerId }

    /**
     * The label for one `exposes` token. A token this build has never
     * heard of still reads as English rather than as a raw slug —
     * parity with the iOS `exposureLabel(_:)`.
     */
    fun exposureLabel(token: String): String {
        exposureLabels[token]?.takeIf { it.isNotEmpty() }?.let { return it }
        val words = token.split('_').filter { it.isNotEmpty() }
        val head = words.firstOrNull() ?: return token
        return (listOf(head.replaceFirstChar { it.uppercase() }) + words.drop(1)).joinToString(" ")
    }

    /** Merge one server-confirmed step in place, preserving order. */
    fun withRemoval(removal: UnlistedRemoval): UnlistedProfile {
        val current = removals ?: return this
        val merged = current.filterNot { it.brokerId == removal.brokerId } + removal
        return copy(removals = merged)
    }
}

/** `GET /api/homes/:id/unlisted`. */
@JsonClass(generateAdapter = true)
data class HomeUnlistedResponse(
    val unlisted: UnlistedProfile,
)

/** ready / could_not_place / unsupported_region for the anonymous look-up. */
enum class UnlistedPreviewStatus {
    @Json(name = "ready")
    READY,

    /**
     * We could not read a state out of what was typed. NOT the same as
     * [UNSUPPORTED_REGION]: the removal list is national and still
     * arrives in full, with `stateProgram` absent rather than negative.
     * Rendering the two alike told US residents the product had nothing
     * for them whenever the address failed to parse.
     */
    @Json(name = "could_not_place")
    COULD_NOT_PLACE,

    @Json(name = "unsupported_region")
    UNSUPPORTED_REGION,

    UNKNOWN,
}

/**
 * State only — `city` is always null on this route, because resolving one
 * would mean a third-party geocode and the anonymous path promises the
 * typed address is not sent anywhere.
 */
@JsonClass(generateAdapter = true)
data class UnlistedPreviewPlace(
    val city: String? = null,
    val state: String? = null,
)

/**
 * `GET /api/public/unlisted?address=…` — anonymous (T0). Persists
 * NOTHING: the address resolves to a state and is never stored, logged
 * with the result, or sent to any third party.
 */
@JsonClass(generateAdapter = true)
data class PublicUnlistedResponse(
    val status: UnlistedPreviewStatus = UnlistedPreviewStatus.UNKNOWN,
    /** Always "preview". */
    val tier: String = "preview",
    /** Present on UNSUPPORTED_REGION. */
    val message: String? = null,
    val place: UnlistedPreviewPlace? = null,
    val unlisted: UnlistedProfile? = null,
    val disclaimer: String? = null,
)

/** `PUT /api/homes/:id/unlisted/removals/:brokerId` body. */
@JsonClass(generateAdapter = true)
data class SetUnlistedRemovalRequest(
    val status: String,
)

/** `{ removal: … }` envelope. */
@JsonClass(generateAdapter = true)
data class UnlistedRemovalResponse(
    val removal: UnlistedRemoval,
)
