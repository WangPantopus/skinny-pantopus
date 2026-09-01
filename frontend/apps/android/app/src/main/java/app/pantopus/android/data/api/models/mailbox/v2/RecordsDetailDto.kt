@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/**
 * Issuer of the record (institution + dept + regulated identifier).
 * Rendered as a slate-gradient avatar + name + dept + mono CRD line +
 * DKIM-verified trust note inside the A17.10 IssuerCard.
 */
data class RecordsIssuer(
    val initials: String,
    val name: String,
    val dept: String,
    val identifier: String,
    val trustNote: String,
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        fun decode(value: Any?): RecordsIssuer? {
            val map = value as? Map<String, Any?> ?: return null
            val initials = map["initials"] as? String
            val name = map["name"] as? String
            val dept = map["dept"] as? String
            val identifier = map["identifier"] as? String
            val trustNote = map["trust_note"] as? String

            val requiredFields = listOf(initials, name, dept, identifier, trustNote)
            if (requiredFields.any { it == null }) {
                return null
            }

            return RecordsIssuer(
                initials = requireNotNull(initials),
                name = requireNotNull(name),
                dept = requireNotNull(dept),
                identifier = requireNotNull(identifier),
                trustNote = requireNotNull(trustNote),
            )
        }
    }
}

/** One row in the records key-facts grid. */
data class RecordsFact(
    val kind: Kind,
    val label: String,
    val value: String,
    val note: String? = null,
    val mono: Boolean = false,
    val tone: Tone = Tone.Neutral,
    val emphasis: Boolean = false,
) {
    /** Drives the leading glyph. */
    enum class Kind(val raw: String) {
        Account("account"),
        Period("period"),
        Balance("balance"),
        Change("change"),
        StatementDate("statementDate"),
        Status("status"),
        ;

        companion object {
            fun fromRaw(value: String?): Kind? = entries.firstOrNull { it.raw == value }
        }
    }

    /** Value tint — positive change shows success emerald. */
    enum class Tone(val raw: String) {
        Neutral("neutral"),
        Positive("positive"),
        ;

        companion object {
            fun fromRaw(value: String?): Tone = entries.firstOrNull { it.raw == value } ?: Neutral
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): RecordsFact? {
            val kind = Kind.fromRaw(map["kind"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            val value = map["value"] as? String ?: return null
            return RecordsFact(
                kind = kind,
                label = label,
                value = value,
                note = map["note"] as? String,
                mono = (map["mono"] as? Boolean) ?: false,
                tone = Tone.fromRaw(map["tone"] as? String),
                emphasis = (map["emphasis"] as? Boolean) ?: false,
            )
        }
    }
}

/** One bullet in the records elf card. */
data class RecordsElfBullet(
    val glyph: Glyph,
    val label: String,
    val text: String,
) {
    enum class Glyph(val raw: String) {
        FileCheck("fileCheck"),
        TrendingUp("trendingUp"),
        Archive("archive"),
        Lock("lock"),
        CalendarClock("calendarClock"),
        Search("search"),
        ;

        companion object {
            fun fromRaw(value: String?): Glyph? = entries.firstOrNull { it.raw == value }
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): RecordsElfBullet? {
            val glyph = Glyph.fromRaw(map["glyph"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            val text = map["text"] as? String ?: return null
            return RecordsElfBullet(glyph, label, text)
        }
    }
}

/** The "Pantopus opened this for you" elf card. */
data class RecordsElfContent(
    val headline: String,
    val summary: String,
    val bullets: List<RecordsElfBullet>,
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        fun decode(value: Any?): RecordsElfContent? {
            val map = value as? Map<String, Any?> ?: return null
            val headline = map["headline"] as? String ?: return null
            val summary = map["summary"] as? String ?: return null
            val bullets =
                (map["bullets"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(RecordsElfBullet::decode)
                }
            return RecordsElfContent(headline, summary, bullets)
        }
    }
}

/** One crumb in the Vault destination breadcrumb. */
data class RecordsVaultCrumb(
    val glyph: Glyph,
    val label: String,
    val isCurrent: Boolean,
) {
    enum class Glyph(val raw: String) {
        Inbox("inbox"),
        Archive("archive"),
        Landmark("landmark"),
        FileText("fileText"),
        Calendar("calendar"),
        ;

        companion object {
            fun fromRaw(value: String?): Glyph? = entries.firstOrNull { it.raw == value }
        }
    }

    companion object {
        fun decode(map: Map<String, Any?>): RecordsVaultCrumb? {
            val glyph = Glyph.fromRaw(map["glyph"] as? String) ?: return null
            val label = map["label"] as? String ?: return null
            return RecordsVaultCrumb(glyph, label, (map["current"] as? Boolean) ?: false)
        }
    }
}

/** One row in the related-records strip (sibling quarterlies). */
data class RelatedRecord(
    val id: String,
    val period: String,
    val amount: String,
    val filedWhen: String,
) {
    companion object {
        fun decode(map: Map<String, Any?>): RelatedRecord? {
            val period = map["period"] as? String ?: return null
            val amount = map["amount"] as? String ?: return null
            val filedWhen = map["filed_when"] as? String ?: return null
            return RelatedRecord(
                id = (map["id"] as? String) ?: period,
                period = period,
                amount = amount,
                filedWhen = filedWhen,
            )
        }
    }
}

/**
 * Records-mail sub-payload decoded from `mail.object_payload` when
 * `mail_type == "records"`. An archival delivery: a financial /
 * medical / legal document with an issuer, a per-document fact set,
 * a cover-letter excerpt, the destination Vault path, retention
 * policy, and the related-record siblings shown once filed.
 * [decodeFromObjectPayload] returns null when the payload lacks a
 * title or its presentation blocks (`issuer`, `elf_open`, `elf_filed`).
 */
data class RecordsDetailDto(
    val title: String,
    val reference: String,
    val docKind: String,
    val docClassLabel: String,
    val retentionLine: String,
    val issuer: RecordsIssuer,
    val openingFacts: List<RecordsFact>,
    val bodyParagraphs: List<String>,
    val coverPageHint: String,
    val pageCount: Int,
    val vaultTrail: List<RecordsVaultCrumb>,
    val related: List<RelatedRecord>,
    val elfOpen: RecordsElfContent,
    val elfFiled: RecordsElfContent,
    val filedAtLabel: String? = null,
    /** True once the user has filed the record in their Vault. */
    val isFiled: Boolean = false,
) {
    /**
     * Facts ordered for the KeyFacts panel. In filed state the
     * `Status · Filed in Vault` row is prepended.
     */
    fun factsForState(filed: Boolean): List<RecordsFact> {
        if (!filed) return openingFacts
        val statusRow =
            RecordsFact(
                kind = RecordsFact.Kind.Status,
                label = "Status",
                value = "Filed in Vault",
                note = "Locked · indexed · searchable",
                tone = RecordsFact.Tone.Positive,
                emphasis = true,
            )
        return listOf(statusRow) + openingFacts
    }

    companion object {
        @Suppress("UNCHECKED_CAST", "ReturnCount")
        fun decodeFromObjectPayload(payload: JsonValue?): RecordsDetailDto? {
            if (payload == null) return null
            val title = (payload["title"] as? String)?.takeIf { it.isNotEmpty() } ?: return null
            val issuer = RecordsIssuer.decode(payload["issuer"]) ?: return null
            val elfOpen = RecordsElfContent.decode(payload["elf_open"]) ?: return null
            val elfFiled = RecordsElfContent.decode(payload["elf_filed"]) ?: return null

            val trail =
                (payload["vault_trail"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(RecordsVaultCrumb::decode)
                }
            if (trail.isEmpty()) return null

            val related =
                (payload["related"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(RelatedRecord::decode)
                }
            val facts =
                (payload["facts"] as? List<*>).orEmpty().mapNotNull {
                    (it as? Map<String, Any?>)?.let(RecordsFact::decode)
                }
            val body = (payload["body"] as? List<*>).orEmpty().mapNotNull { it as? String }

            return RecordsDetailDto(
                title = title,
                reference = (payload["reference"] as? String) ?: "",
                docKind = (payload["doc_kind"] as? String) ?: "Records",
                docClassLabel = (payload["doc_class_label"] as? String) ?: "Record",
                retentionLine = (payload["retention_line"] as? String) ?: "",
                issuer = issuer,
                openingFacts = facts,
                bodyParagraphs = body,
                coverPageHint = (payload["cover_page_hint"] as? String) ?: "p. 1 / 1",
                pageCount = (payload["page_count"] as? Number)?.toInt() ?: 1,
                vaultTrail = trail,
                related = related,
                elfOpen = elfOpen,
                elfFiled = elfFiled,
                filedAtLabel = payload["filed_at_label"] as? String,
                isFiled = (payload["is_filed"] as? Boolean) ?: false,
            )
        }
    }
}
