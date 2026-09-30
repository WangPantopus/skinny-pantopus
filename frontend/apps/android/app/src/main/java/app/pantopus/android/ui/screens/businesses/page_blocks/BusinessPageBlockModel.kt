@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.page_blocks

import app.pantopus.android.data.api.models.business_pages.BusinessPageBlockDto
import app.pantopus.android.data.api.models.business_pages.SaveBusinessPageBlockRequest
import app.pantopus.android.ui.theme.PantopusIcon
import java.net.URI
import java.util.UUID

/**
 * C4 — the typed model behind the business page-block builder. Mirrors RN
 * `src/components/business/blocks/blockRegistry.ts` and iOS
 * `BusinessPageBlockModel.swift`.
 *
 * [BusinessPageBlockKind] is a sealed sum type with an explicit
 * [BusinessPageBlockKind.Unknown] arm so a block type the backend grows later
 * renders as an inert row instead of crashing the editor, and `data` /
 * `settings` round-trip as untyped maps so saving never destroys keys this
 * build doesn't understand.
 */
sealed interface BusinessPageBlockKind {
    /** Wire value sent back to `PUT …/blocks`. */
    val rawValue: String

    data object Hero : BusinessPageBlockKind {
        override val rawValue = "hero"
    }

    data object Text : BusinessPageBlockKind {
        override val rawValue = "text"
    }

    data object Gallery : BusinessPageBlockKind {
        override val rawValue = "gallery"
    }

    data object CatalogGrid : BusinessPageBlockKind {
        override val rawValue = "catalog_grid"
    }

    data object Hours : BusinessPageBlockKind {
        override val rawValue = "hours"
    }

    data object LocationsMap : BusinessPageBlockKind {
        override val rawValue = "locations_map"
    }

    data object Cta : BusinessPageBlockKind {
        override val rawValue = "cta"
    }

    data object Faq : BusinessPageBlockKind {
        override val rawValue = "faq"
    }

    data object Reviews : BusinessPageBlockKind {
        override val rawValue = "reviews"
    }

    data object Embed : BusinessPageBlockKind {
        override val rawValue = "embed"
    }

    data object Divider : BusinessPageBlockKind {
        override val rawValue = "divider"
    }

    data object Stats : BusinessPageBlockKind {
        override val rawValue = "stats"
    }

    data object Team : BusinessPageBlockKind {
        override val rawValue = "team"
    }

    data object ContactForm : BusinessPageBlockKind {
        override val rawValue = "contact_form"
    }

    data object PostsFeed : BusinessPageBlockKind {
        override val rawValue = "posts_feed"
    }

    /** A `block_type` this build doesn't know. Rendered read-only. */
    data class Unknown(
        override val rawValue: String,
    ) : BusinessPageBlockKind

    companion object {
        fun from(raw: String): BusinessPageBlockKind =
            when (raw) {
                "hero" -> Hero
                "text" -> Text
                "gallery" -> Gallery
                "catalog_grid" -> CatalogGrid
                "hours" -> Hours
                "locations_map" -> LocationsMap
                "cta" -> Cta
                "faq" -> Faq
                "reviews" -> Reviews
                "embed" -> Embed
                "divider" -> Divider
                "stats" -> Stats
                "team" -> Team
                "contact_form" -> ContactForm
                "posts_feed" -> PostsFeed
                else -> Unknown(raw)
            }

        /**
         * Order of the "Add block" picker — matches RN's registry order. Gallery, Team and Pulse aren't
         * offered, as on the web: visitors never see them (no photo uploads, public team list or posts feed yet).
         */
        val pickable: List<BusinessPageBlockKind> =
            listOf(
                Hero, Text, CatalogGrid, Hours, LocationsMap, Cta,
                Faq, Reviews, Stats, ContactForm, Embed, Divider,
            )
    }
}

/** Label / icon / description / seed data for one block kind. */
data class BusinessPageBlockRegistryEntry(
    val label: String,
    val icon: PantopusIcon,
    val summary: String,
    val defaultData: Map<String, Any?>,
)

object BusinessPageBlockRegistry {
    /**
     * Registry entry for a kind. Unknown kinds fall back to a neutral package
     * glyph labelled with the raw type — the RN behaviour.
     */
    @Suppress("CyclomaticComplexMethod")
    fun entry(kind: BusinessPageBlockKind): BusinessPageBlockRegistryEntry =
        when (kind) {
            BusinessPageBlockKind.Hero ->
                BusinessPageBlockRegistryEntry(
                    label = "Hero",
                    icon = PantopusIcon.Image,
                    summary = "Full-width banner with headline and CTAs",
                    defaultData = mapOf("headline" to "", "subhead" to "", "cta" to emptyList<Any?>()),
                )
            BusinessPageBlockKind.Text ->
                BusinessPageBlockRegistryEntry(
                    label = "Text",
                    icon = PantopusIcon.FileText,
                    summary = "Heading and body text section",
                    defaultData = mapOf("heading" to "", "body" to ""),
                )
            BusinessPageBlockKind.Gallery ->
                BusinessPageBlockRegistryEntry(
                    label = "Gallery",
                    icon = PantopusIcon.Camera,
                    summary = "Image gallery display",
                    defaultData = mapOf("heading" to "Gallery", "images" to emptyList<Any?>(), "image_count" to 6.0),
                )
            BusinessPageBlockKind.CatalogGrid ->
                BusinessPageBlockRegistryEntry(
                    label = "Catalog",
                    icon = PantopusIcon.Grid3x3,
                    summary = "Product or service catalog grid",
                    defaultData = mapOf("heading" to "Our Services", "filter_kind" to "", "max_items" to 8.0),
                )
            BusinessPageBlockKind.Hours ->
                BusinessPageBlockRegistryEntry(
                    label = "Hours",
                    icon = PantopusIcon.Clock,
                    summary = "Business hours from your locations",
                    defaultData = mapOf("heading" to "Business Hours"),
                )
            BusinessPageBlockKind.LocationsMap ->
                BusinessPageBlockRegistryEntry(
                    label = "Locations",
                    icon = PantopusIcon.MapPin,
                    summary = "Map of your business locations",
                    defaultData = mapOf("heading" to "Our Locations"),
                )
            BusinessPageBlockKind.Cta ->
                BusinessPageBlockRegistryEntry(
                    label = "Call to Action",
                    icon = PantopusIcon.Megaphone,
                    summary = "Section with buttons and actions",
                    defaultData =
                        mapOf(
                            "heading" to "Ready to get started?",
                            "subhead" to "",
                            "buttons" to listOf(mapOf("label" to "Contact Us", "action" to "message")),
                        ),
                )
            BusinessPageBlockKind.Faq ->
                BusinessPageBlockRegistryEntry(
                    label = "FAQ",
                    icon = PantopusIcon.HelpCircle,
                    summary = "Frequently asked questions",
                    defaultData = mapOf("heading" to "FAQ", "items" to listOf(mapOf("q" to "", "a" to ""))),
                )
            BusinessPageBlockKind.Reviews ->
                BusinessPageBlockRegistryEntry(
                    label = "Reviews",
                    icon = PantopusIcon.Star,
                    summary = "Customer reviews from your profile",
                    defaultData = mapOf("heading" to "Customer Reviews"),
                )
            BusinessPageBlockKind.Stats ->
                BusinessPageBlockRegistryEntry(
                    label = "Stats",
                    icon = PantopusIcon.BarChart3,
                    summary = "Key numbers and statistics",
                    defaultData = mapOf("stats" to listOf(mapOf("label" to "Customers", "value" to "1,000+"))),
                )
            BusinessPageBlockKind.Team ->
                BusinessPageBlockRegistryEntry(
                    label = "Team",
                    icon = PantopusIcon.UsersRound,
                    summary = "Team members from your settings",
                    defaultData = mapOf("heading" to "Our Team"),
                )
            BusinessPageBlockKind.ContactForm ->
                BusinessPageBlockRegistryEntry(
                    label = "Contact Form",
                    icon = PantopusIcon.Mail,
                    summary = "Visitors send you a message",
                    defaultData = mapOf("heading" to "Contact Us"),
                )
            BusinessPageBlockKind.Embed ->
                BusinessPageBlockRegistryEntry(
                    label = "Embed",
                    icon = PantopusIcon.ExternalLink,
                    summary = "A YouTube or Vimeo video, or a link",
                    defaultData = mapOf("url" to ""),
                )
            BusinessPageBlockKind.PostsFeed ->
                BusinessPageBlockRegistryEntry(
                    label = "Pulse",
                    icon = PantopusIcon.Rss,
                    summary = "Recent posts and updates",
                    defaultData = mapOf("heading" to "Latest Updates", "max_items" to 5.0),
                )
            BusinessPageBlockKind.Divider ->
                BusinessPageBlockRegistryEntry(
                    label = "Divider",
                    icon = PantopusIcon.Minus,
                    summary = "Horizontal separator",
                    defaultData = emptyMap(),
                )
            is BusinessPageBlockKind.Unknown ->
                BusinessPageBlockRegistryEntry(
                    label = kind.rawValue,
                    icon = PantopusIcon.Package,
                    summary = "",
                    defaultData = emptyMap(),
                )
        }
}

/**
 * Which field set the block editor sheet renders. A sum type so an unknown
 * block type lands on [Unsupported] instead of a crash.
 */
sealed interface BusinessPageBlockForm {
    data object Hero : BusinessPageBlockForm

    data object Text : BusinessPageBlockForm

    data object Gallery : BusinessPageBlockForm

    data object Catalog : BusinessPageBlockForm

    data object Cta : BusinessPageBlockForm

    data object Faq : BusinessPageBlockForm

    data object Stats : BusinessPageBlockForm

    data object Embed : BusinessPageBlockForm

    data object PostsFeed : BusinessPageBlockForm

    /** Blocks whose body is server-derived — only a heading is editable. */
    data class HeadingOnly(
        val hint: String,
    ) : BusinessPageBlockForm

    /** No editable fields (divider). */
    data class Note(
        val text: String,
    ) : BusinessPageBlockForm

    data class Unsupported(
        val type: String,
    ) : BusinessPageBlockForm

    companion object {
        fun of(kind: BusinessPageBlockKind): BusinessPageBlockForm =
            when (kind) {
                BusinessPageBlockKind.Hero -> Hero
                BusinessPageBlockKind.Text -> Text
                BusinessPageBlockKind.Gallery -> Gallery
                BusinessPageBlockKind.CatalogGrid -> Catalog
                BusinessPageBlockKind.Cta -> Cta
                BusinessPageBlockKind.Faq -> Faq
                BusinessPageBlockKind.Stats -> Stats
                BusinessPageBlockKind.Embed -> Embed
                BusinessPageBlockKind.PostsFeed -> PostsFeed
                BusinessPageBlockKind.Hours -> HeadingOnly("Hours data is pulled from your business locations")
                BusinessPageBlockKind.LocationsMap -> HeadingOnly("Locations are pulled from your business settings")
                BusinessPageBlockKind.Reviews -> HeadingOnly("Reviews are automatically pulled from your profile")
                BusinessPageBlockKind.Team ->
                    HeadingOnly("Your team isn't listed on your public page yet, so visitors don't see this block")
                BusinessPageBlockKind.ContactForm ->
                    HeadingOnly("Signed-in visitors can send you a message here. It arrives in your Inbox as a chat")
                BusinessPageBlockKind.Divider -> Note("A horizontal separator between sections. No settings needed.")
                is BusinessPageBlockKind.Unknown -> Unsupported(kind.rawValue)
            }
    }
}

/** A CTA / hero button: its label, action and, for a Link, the web address it opens. */
data class BusinessPageBlockButton(
    val label: String,
    val action: String,
    val url: String? = null,
) {
    /** Includes the address whenever it is set, so editing a button here never drops a link set on the web. */
    fun toMap(): Map<String, Any?> =
        buildMap {
            put("label", label)
            put("action", action)
            if (!url.isNullOrEmpty()) put("url", url)
        }

    /** Whether [url] is a web address the crew page will open (http or https with a host). */
    val hasWebAddress: Boolean
        get() =
            runCatching { URI(url.orEmpty().trim()) }.getOrNull()?.let { uri ->
                (uri.scheme.equals("https", ignoreCase = true) || uri.scheme.equals("http", ignoreCase = true)) &&
                    !uri.host.isNullOrEmpty()
            } ?: false
}

/** One FAQ question/answer pair. */
data class BusinessPageBlockFaqItem(
    val question: String,
    val answer: String,
) {
    fun toMap(): Map<String, Any?> = mapOf("q" to question, "a" to answer)
}

/** One stat tile. */
data class BusinessPageBlockStat(
    val label: String,
    val value: String,
) {
    fun toMap(): Map<String, Any?> = mapOf("label" to label, "value" to value)
}

/**
 * A page block as the editor holds it. `data` / `settings` stay untyped so
 * unrecognised keys survive the round-trip through `PUT …/blocks`.
 */
data class BusinessPageBlock(
    /** Server id, null for a block added in this session. */
    val serverId: String? = null,
    /** Stable identity for `key(...)` — server id, else a local uuid. */
    val localId: String = UUID.randomUUID().toString(),
    val kind: BusinessPageBlockKind,
    val schemaVersion: Int = 1,
    val sortOrder: Int,
    val data: Map<String, Any?> = emptyMap(),
    val settings: Map<String, Any?> = emptyMap(),
    val locationId: String? = null,
    val showFrom: String? = null,
    val showUntil: String? = null,
    val isVisible: Boolean = true,
) {
    val heading: String get() = string("heading")
    val headline: String get() = string("headline")
    val subhead: String get() = string("subhead")
    val body: String get() = string("body")
    val url: String get() = string("url")
    val filterKind: String get() = string("filter_kind")
    val imageCount: Int get() = int("image_count") ?: DEFAULT_IMAGE_COUNT
    val maxItems: Int get() = int("max_items") ?: DEFAULT_MAX_ITEMS

    /** `[{ label, action, url? }]` used by hero (`cta`) and CTA (`buttons`). A button with only an address is a Link, as on the web. */
    fun buttonList(key: String): List<BusinessPageBlockButton> =
        (data[key] as? List<*>).orEmpty().mapNotNull { element ->
            val map = element as? Map<*, *> ?: return@mapNotNull null
            val url = map["url"] as? String
            BusinessPageBlockButton(
                label = map["label"] as? String ?: "",
                action = map["action"] as? String ?: if (!url.isNullOrEmpty()) "link" else "message",
                url = url,
            )
        }

    /** `[{ q, a }]` for the FAQ block. */
    val faqItems: List<BusinessPageBlockFaqItem>
        get() =
            (data["items"] as? List<*>).orEmpty().mapNotNull { element ->
                val map = element as? Map<*, *> ?: return@mapNotNull null
                BusinessPageBlockFaqItem(
                    question = map["q"] as? String ?: "",
                    answer = map["a"] as? String ?: "",
                )
            }

    /** `[{ label, value }]` for the stats block. */
    val stats: List<BusinessPageBlockStat>
        get() =
            (data["stats"] as? List<*>).orEmpty().mapNotNull { element ->
                val map = element as? Map<*, *> ?: return@mapNotNull null
                BusinessPageBlockStat(
                    label = map["label"] as? String ?: "",
                    value = map["value"] as? String ?: "",
                )
            }

    /** One-line summary under the block title. Mirrors RN `blockPreviewText`. */
    @Suppress("CyclomaticComplexMethod")
    val summaryLine: String
        get() =
            when (kind) {
                BusinessPageBlockKind.Hero -> headline.ifEmpty { "No headline" }
                BusinessPageBlockKind.Text ->
                    when {
                        heading.isNotEmpty() -> heading
                        body.isNotEmpty() -> body.take(SUMMARY_BODY_CHARS)
                        else -> "No content"
                    }
                BusinessPageBlockKind.Gallery -> heading.ifEmpty { "$imageCount images" }
                BusinessPageBlockKind.CatalogGrid -> heading.ifEmpty { "$maxItems items" }
                BusinessPageBlockKind.Cta -> heading.ifEmpty { "No heading" }
                BusinessPageBlockKind.Faq -> "${faqItems.size} questions"
                BusinessPageBlockKind.Stats -> "${stats.size} stats"
                BusinessPageBlockKind.Embed -> url.ifEmpty { "No URL" }
                BusinessPageBlockKind.PostsFeed ->
                    heading.ifEmpty { "${int("max_items") ?: DEFAULT_POSTS_COUNT} posts" }
                BusinessPageBlockKind.Divider -> "Separator"
                is BusinessPageBlockKind.Unknown -> heading.ifEmpty { kind.rawValue }
                else -> heading.ifEmpty { BusinessPageBlockRegistry.entry(kind).label }
            }

    /** Request element for `PUT …/blocks`. */
    fun toSaveRequest(order: Int): SaveBusinessPageBlockRequest =
        SaveBusinessPageBlockRequest(
            blockType = kind.rawValue,
            schemaVersion = schemaVersion,
            sortOrder = order,
            data = data,
            settings = settings,
            locationId = locationId,
            showFrom = showFrom,
            showUntil = showUntil,
            isVisible = isVisible,
        )

    private fun string(key: String): String = data[key] as? String ?: ""

    private fun int(key: String): Int? =
        when (val value = data[key]) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }

    companion object {
        private const val DEFAULT_IMAGE_COUNT = 6
        private const val DEFAULT_MAX_ITEMS = 8
        private const val DEFAULT_POSTS_COUNT = 5
        private const val SUMMARY_BODY_CHARS = 40

        /** Decode from the wire; missing `sort_order` falls back to the index. */
        fun from(
            dto: BusinessPageBlockDto,
            index: Int,
        ): BusinessPageBlock =
            BusinessPageBlock(
                serverId = dto.id,
                localId = dto.id ?: UUID.randomUUID().toString(),
                kind = BusinessPageBlockKind.from(dto.blockType),
                schemaVersion = dto.schemaVersion ?: 1,
                sortOrder = dto.sortOrder ?: index,
                data = dto.data ?: emptyMap(),
                settings = dto.settings ?: emptyMap(),
                locationId = dto.locationId,
                showFrom = dto.showFrom,
                showUntil = dto.showUntil,
                isVisible = dto.isVisible != false,
            )

        /** Seed a brand-new block of [kind] from the registry defaults. */
        fun newBlock(
            kind: BusinessPageBlockKind,
            sortOrder: Int,
        ): BusinessPageBlock =
            BusinessPageBlock(
                kind = kind,
                sortOrder = sortOrder,
                data = BusinessPageBlockRegistry.entry(kind).defaultData,
            )
    }
}

/** Option lists mirroring RN `blockRegistry.ts`. */
object BusinessPageBlockOptions {
    val catalogFilterKinds =
        listOf(
            "" to "All Items",
            "service" to "Services",
            "product" to "Products",
            "menu_item" to "Menu Items",
            "class" to "Classes",
            "rental" to "Rentals",
        )

    val ctaActions =
        listOf(
            "message" to "Send Message",
            "call" to "Call",
            "directions" to "Get Directions",
            "link" to "Open Link",
            "book" to "Book Now",
        )

    val padding =
        listOf(
            "none" to "None",
            "small" to "Small",
            "default" to "Default",
            "large" to "Large",
        )

    val background =
        listOf(
            "default" to "White",
            "gray" to "Gray",
            "brand" to "Brand",
            "transparent" to "Transparent",
        )
}
