@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_ownership

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Steps the claim-ownership wizard can be on. Order is meaningful — the
 * wizard advances `Start → Upload → Success` and back-navigates
 * `Upload → Start`. Success has no back chevron and ends the flow.
 *
 * Chrome (top-bar readout + progress fraction) is computed in the VM's
 * `computeChrome` rather than via per-step metadata on this enum; the
 * wizard doesn't survive process-death so there's nothing to (de)serialise.
 */
enum class ClaimOwnershipStep { Start, Upload, Success }

/**
 * Which verification the wizard is running. Selects both the document
 * slot set and the `claim_type` sent on
 * `POST /api/homes/:id/ownership-claims` (`submitClaimSchema`,
 * `backend/routes/homeOwnership.js:34` — accepts `owner | admin | resident`).
 *
 * Mirrors RN `src/app/homes/[id]/claim-owner/evidence.tsx:33-37, :92-95`,
 * where `verificationType=residency` swaps the doc list and sends
 * `claim_type: 'resident'`.
 */
enum class ClaimVerificationType(
    val claimType: String,
    val wizardTitle: String,
) {
    Owner("owner", "Claim ownership"),
    Residency("resident", "Verify residency"),
    ;

    /**
     * Steps this variant walks. RN's residency entry point
     * (`homes/index.tsx:275`) links straight to the evidence screen, so
     * the residency variant skips the ownership explainer step.
     */
    val steps: List<ClaimOwnershipStep>
        get() =
            when (this) {
                Owner -> listOf(ClaimOwnershipStep.Start, ClaimOwnershipStep.Upload, ClaimOwnershipStep.Success)
                Residency -> listOf(ClaimOwnershipStep.Upload, ClaimOwnershipStep.Success)
            }

    /** Upload tiles required before submit is enabled. */
    val slots: List<ClaimEvidenceSlot>
        get() =
            when (this) {
                Owner -> listOf(ClaimEvidenceSlot.Identity, ClaimEvidenceSlot.Ownership)
                Residency -> listOf(ClaimEvidenceSlot.Residency)
            }

    companion object {
        /** Decodes the nav arg; anything unrecognised falls back to owner. */
        fun fromArg(raw: String?): ClaimVerificationType =
            when (raw?.lowercase()) {
                "residency", "resident" -> Residency
                else -> Owner
            }
    }
}

/**
 * One selectable document kind inside a slot that accepts several
 * `evidence_type` values. [id] is the backend `evidence_type` from
 * `uploadEvidenceSchema` (`backend/routes/homeOwnership.js:44-47`).
 */
data class ClaimDocumentOption(
    val id: String,
    val label: String,
    val detail: String,
    val icon: PantopusIcon,
)

/**
 * Identifier for one of the wizard's upload tiles. [fixedBackendType]
 * matches the `evidence_type` Joi enum at
 * `backend/routes/homeOwnership.js:43`; slots whose type the user picks
 * expose [documentOptions] instead.
 */
enum class ClaimEvidenceSlot(
    val fixedBackendType: String?,
    val title: String,
) {
    Identity("idv", "Government ID"),

    /**
     * Ownership proof — the claimant declares which of the five
     * ownership documents they are attaching (RN
     * `OWNERSHIP_DOC_OPTIONS`, `evidence.tsx:26-32`).
     */
    Ownership(null, "Proof of ownership"),

    /** Residency proof — the user picks the document kind. */
    Residency(null, "Proof of residency"),
    ;

    /** Legacy accessor kept for the owner variant's fixed slots. */
    val backendType: String
        get() = fixedBackendType ?: documentOptions.firstOrNull()?.id ?: "utility_bill"

    /**
     * Document kinds this slot accepts; empty for fixed slots. The
     * ownership list is copied verbatim from RN's
     * `OWNERSHIP_DOC_OPTIONS` (`evidence.tsx:26-32`) and the residency
     * list from `RESIDENCY_DOC_OPTIONS` (`evidence.tsx:34-38`).
     */
    val documentOptions: List<ClaimDocumentOption>
        get() =
            when (this) {
                Identity -> emptyList()
                Ownership ->
                    listOf(
                        ClaimDocumentOption(
                            id = "deed",
                            label = "Deed",
                            detail = "Property deed or title document",
                            icon = PantopusIcon.FileText,
                        ),
                        ClaimDocumentOption(
                            id = "closing_disclosure",
                            label = "Closing Disclosure",
                            detail = "Settlement statement from purchase",
                            icon = PantopusIcon.FileText,
                        ),
                        ClaimDocumentOption(
                            id = "tax_bill",
                            label = "Property Tax Statement",
                            detail = "Tax bill showing property owner",
                            icon = PantopusIcon.Receipt,
                        ),
                        ClaimDocumentOption(
                            id = "escrow_attestation",
                            label = "Title/Escrow Attestation",
                            detail = "Letter from title or escrow company",
                            icon = PantopusIcon.ShieldCheck,
                        ),
                        ClaimDocumentOption(
                            id = "title_match",
                            label = "Title Record Match",
                            detail = "Public record title match",
                            icon = PantopusIcon.CheckCircle,
                        ),
                    )
                Residency ->
                    listOf(
                        ClaimDocumentOption(
                            id = "lease",
                            label = "Lease Agreement",
                            detail = "Current rental or lease agreement",
                            icon = PantopusIcon.FileText,
                        ),
                        ClaimDocumentOption(
                            id = "utility_bill",
                            label = "Utility Bill",
                            detail = "Electric, gas, water, or internet bill at this address",
                            icon = PantopusIcon.Receipt,
                        ),
                        ClaimDocumentOption(
                            id = "tax_bill",
                            label = "Property Tax Statement",
                            detail = "Tax bill showing this address",
                            icon = PantopusIcon.Receipt,
                        ),
                    )
            }

    val acceptHint: String get() = "JPG, PNG, or PDF up to 10 MB"
}

/** Copy shared with the iOS screen — keep both platforms word-for-word. */
object ClaimUploadCopy {
    const val STATEMENT_PLACEHOLDER: String =
        "Add a short statement to help the reviewer (e.g. how long you've owned, anyone else on title)…"
    const val ENCRYPTION_FOOTER: String =
        "Encrypted in transit. Visible only to the reviewer assigned to your claim."
}

/** Per-slot upload state surfaced to the UI. */
sealed interface ClaimSlotState {
    data object Empty : ClaimSlotState

    data class Picked(val file: ClaimPickedFile) : ClaimSlotState

    data class Uploading(val file: ClaimPickedFile, val fraction: Float) : ClaimSlotState

    data class Uploaded(val file: ClaimPickedFile, val fileUrl: String) : ClaimSlotState

    data class Failed(val file: ClaimPickedFile, val message: String) : ClaimSlotState

    val hasFile: Boolean
        get() = this !is Empty

    val pickedFile: ClaimPickedFile?
        get() =
            when (this) {
                is Picked -> file
                is Uploading -> file
                is Uploaded -> file
                is Failed -> file
                is Empty -> null
            }
}

/** A single picked file buffered in memory until upload. */
data class ClaimPickedFile(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
) {
    val sizeBytes: Long get() = bytes.size.toLong()

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ClaimPickedFile) return false
        if (filename != other.filename) return false
        if (mimeType != other.mimeType) return false
        if (!bytes.contentEquals(other.bytes)) return false
        return true
    }

    override fun hashCode(): Int {
        var result = filename.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + bytes.contentHashCode()
        return result
    }
}

/** Outbound navigation events the screen consumes. */
sealed interface ClaimOwnershipOutboundEvent {
    /** Pop the wizard with no further navigation. */
    data object Dismiss : ClaimOwnershipOutboundEvent

    /** Pop the wizard and route to the user's claims list. */
    data object OpenClaimsList : ClaimOwnershipOutboundEvent

    /**
     * Someone else's verification already blocks this home — send the
     * user to the "Find or Add Home" discovery surface so they can
     * request to join instead. Mirrors RN
     * `claim-owner/evidence.tsx:210` (`router.replace('/homes/find')`).
     */
    data object OpenFindHome : ClaimOwnershipOutboundEvent
}

/**
 * How the viewer wants to get onto this home. Mirrors RN
 * `src/app/homes/[id]/claim-owner/index.tsx:14-15` — the document /
 * escrow / IDV methods all funnel into the same evidence upload
 * natively, so they collapse into [VerifyOwnership]; the
 * `ask_verified_owner` branch posts instead of uploading.
 */
enum class ClaimStartMethod {
    VerifyOwnership,
    AskVerifiedOwner,
}
