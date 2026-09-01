@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/**
 * One contextual fact behind the memory ("a year ago today", the
 * originating Pulse thread, where it happened, who else helped).
 */
data class MemoryFact(
    val kind: Kind,
    val label: String,
    val value: String,
    val linkHint: String? = null,
) {
    /** Drives the leading glyph and the row's test-tag. */
    enum class Kind(val raw: String) {
        Anniversary("anniversary"),
        PulseThread("pulseThread"),
        Location("location"),
        Others("others"),
        ;

        companion object {
            fun fromRaw(value: String?): Kind? = entries.firstOrNull { it.raw == value }
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): MemoryFact? {
            val kind = Kind.fromRaw(map["kind"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            val value = map["value"] as? String ?: return null
            return MemoryFact(kind, label, value, map["link_hint"] as? String)
        }
    }
}

/** One bullet in the memory elf card. */
data class MemoryElfBullet(
    val glyph: Glyph,
    val label: String,
    val text: String,
) {
    enum class Glyph(val raw: String) {
        Calendar("calendar"),
        Image("image"),
        ShieldCheck("shieldCheck"),
        Archive("archive"),
        EyeOff("eyeOff"),
        Bell("bell"),
        ;

        companion object {
            fun fromRaw(value: String?): Glyph? = entries.firstOrNull { it.raw == value }
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): MemoryElfBullet? {
            val glyph = Glyph.fromRaw(map["glyph"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            val text = map["text"] as? String ?: return null
            return MemoryElfBullet(glyph, label, text)
        }
    }
}

/** The "Pantopus surfaced this" elf card. Distinct copy for fresh vs saved. */
data class MemoryElfContent(
    val headline: String,
    val summary: String,
    val bullets: List<MemoryElfBullet>,
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        fun decode(value: Any?): MemoryElfContent? {
            val map = value as? Map<String, Any?> ?: return null
            val headline = map["headline"] as? String ?: return null
            val summary = map["summary"] as? String ?: return null
            val bullets =
                (map["bullets"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(MemoryElfBullet::decode)
                }
            return MemoryElfContent(headline, summary, bullets)
        }
    }
}

/** One crumb in the vault-location breadcrumb. */
data class MemoryVaultCrumb(
    val glyph: Glyph,
    val label: String,
    val isCurrent: Boolean,
) {
    enum class Glyph(val raw: String) {
        Inbox("inbox"),
        Archive("archive"),
        Heart("heart"),
        Calendar("calendar"),
        ;

        companion object {
            fun fromRaw(value: String?): Glyph? = entries.firstOrNull { it.raw == value }
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): MemoryVaultCrumb? {
            val glyph = Glyph.fromRaw(map["glyph"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            return MemoryVaultCrumb(glyph, label, (map["current"] as? Boolean) ?: false)
        }
    }
}

/** A single counter in the vault summary row. */
data class MemoryVaultStat(
    val value: String,
    val label: String,
) {
    companion object {
        fun decode(map: Map<String, Any?>): MemoryVaultStat? {
            val value = map["value"] as? String ?: return null
            val label = map["label"] as? String ?: return null
            return MemoryVaultStat(value, label)
        }
    }
}

/** Where the memory is filed once kept — replaces the facts grid when saved. */
data class MemoryVaultInfo(
    val trail: List<MemoryVaultCrumb>,
    val stats: List<MemoryVaultStat>,
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        fun decode(value: Any?): MemoryVaultInfo? {
            val map = value as? Map<String, Any?> ?: return null
            val trail =
                (map["trail"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(MemoryVaultCrumb::decode)
                }
            if (trail.isEmpty()) return null
            val stats =
                (map["stats"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(MemoryVaultStat::decode)
                }
            return MemoryVaultInfo(trail, stats)
        }
    }
}

/**
 * Memory-mail sub-payload decoded from `mail.object_payload` when
 * `mail_type == "memory"`. A keepsake delivery: a photograph, a
 * handwritten note, the factual context, and the "why Pantopus surfaced
 * this" elf — plus a vault-location summary for the saved state.
 * [decodeFromObjectPayload] returns null when the payload carries no
 * title or is missing its presentation blocks.
 */
data class MemoryDetailDto(
    val title: String,
    val reference: String,
    val photoUrl: String?,
    val photoCaption: String,
    val photoLabel: String,
    val note: List<String>,
    val noteSignature: String,
    val facts: List<MemoryFact>,
    val elfFresh: MemoryElfContent,
    val elfSaved: MemoryElfContent,
    val vault: MemoryVaultInfo,
    /** True once the user has kept this memory in their vault. */
    val isSaved: Boolean,
) {
    companion object {
        @Suppress("UNCHECKED_CAST", "ReturnCount")
        fun decodeFromObjectPayload(payload: JsonValue?): MemoryDetailDto? {
            if (payload == null) return null
            val title = (payload["title"] as? String)?.takeIf { it.isNotEmpty() } ?: return null
            val elfFresh = MemoryElfContent.decode(payload["elf_fresh"]) ?: return null
            val elfSaved = MemoryElfContent.decode(payload["elf_saved"]) ?: return null
            val vault = MemoryVaultInfo.decode(payload["vault"]) ?: return null

            val photo = payload["photo"] as? Map<String, Any?>
            val note = (payload["note"] as? List<*>).orEmpty().mapNotNull { it as? String }
            val facts =
                (payload["facts"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(MemoryFact::decode)
                }
            return MemoryDetailDto(
                title = title,
                reference = (payload["reference"] as? String) ?: "",
                photoUrl = photo?.get("url") as? String,
                photoCaption = (photo?.get("caption") as? String) ?: "",
                photoLabel = (photo?.get("label") as? String) ?: "",
                note = note,
                noteSignature = (payload["note_signature"] as? String) ?: "",
                facts = facts,
                elfFresh = elfFresh,
                elfSaved = elfSaved,
                vault = vault,
                isSaved = (payload["is_saved"] as? Boolean) ?: false,
            )
        }
    }
}
