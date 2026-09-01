@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.catalog

import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemRequest
import app.pantopus.android.ui.theme.PantopusIcon
import java.util.Locale

/**
 * Render models for the owner catalog manager (A10.7 → Services →
 * "Manage"). Mirrors the React Native `CatalogTab`
 * (`src/components/business/tabs/CatalogTab.tsx`) field-for-field:
 * create / edit / archive items, create / rename / delete categories, and
 * move-up / move-down reorder.
 *
 * iOS twin: `Features/Businesses/Catalog/BusinessCatalogContent.swift`.
 */

/** `CATALOG_ITEM_KINDS` — `backend/routes/businesses.js:93`. */
enum class BusinessCatalogKind(
    val wire: String,
    val label: String,
    val icon: PantopusIcon,
) {
    Service("service", "Service", PantopusIcon.Wrench),
    Product("product", "Product", PantopusIcon.Package),
    MenuItem("menu_item", "Menu item", PantopusIcon.ShoppingBag),
    ClassSession("class", "Class", PantopusIcon.Users),
    Rental("rental", "Rental", PantopusIcon.Clock),
    Membership("membership", "Membership", PantopusIcon.Star),
    Donation("donation", "Donation", PantopusIcon.Heart),
    Event("event", "Event", PantopusIcon.Calendar),
    Other("other", "Other", PantopusIcon.Tag),
    ;

    companion object {
        fun from(raw: String?): BusinessCatalogKind = entries.firstOrNull { it.wire == raw } ?: Service
    }
}

/** `CATALOG_ITEM_STATUSES` — `backend/routes/businesses.js:94`. */
enum class BusinessCatalogStatus(
    val wire: String,
) {
    Active("active"),
    Draft("draft"),
    Archived("archived"),
    ;

    companion object {
        fun from(raw: String?): BusinessCatalogStatus = entries.firstOrNull { it.wire == raw } ?: Active
    }
}

/** One category row in the category manager sheet. */
data class BusinessCatalogCategoryRow(
    val id: String,
    val name: String,
    val detail: String? = null,
)

/**
 * One catalog item row. Carries both the rendered strings and the raw
 * values the editor seeds from, so the sheet never re-parses labels.
 */
data class BusinessCatalogItemRow(
    val id: String,
    val name: String,
    val description: String? = null,
    val kind: BusinessCatalogKind,
    val status: BusinessCatalogStatus,
    val priceCents: Int? = null,
    val priceMaxCents: Int? = null,
    val priceUnit: String? = null,
    val durationMinutes: Int? = null,
    val isFeatured: Boolean = false,
    val taxDeductible: Boolean = false,
    val suggestedAmounts: List<Int> = emptyList(),
    val categoryId: String? = null,
    val categoryName: String? = null,
) {
    /** "Service · 60 min" — the RN sub-line. */
    val metaLabel: String
        get() =
            buildList {
                add(kind.label)
                durationMinutes?.takeIf { it > 0 }?.let { add("$it min") }
            }.joinToString(" · ")

    /**
     * "$15.00", "$15.00–$40.00/hour", "Open amount" for donations, or null
     * when the item has no price at all.
     */
    val priceLabel: String?
        get() {
            if (kind == BusinessCatalogKind.Donation) return "Open amount"
            val cents = priceCents ?: return null
            val builder = StringBuilder(money(cents))
            priceMaxCents?.takeIf { it > cents }?.let { builder.append("–").append(money(it)) }
            priceUnit?.takeIf { it.isNotEmpty() }?.let { builder.append("/").append(it) }
            return builder.toString()
        }

    private fun money(cents: Int): String = String.format(Locale.US, "$%.2f", cents / 100.0)
}

/**
 * The editable pose of a catalog item. Strings mirror the text fields so a
 * partially-typed price never has to round-trip through `Int`.
 */
data class BusinessCatalogItemDraft(
    val name: String = "",
    val description: String = "",
    val kind: BusinessCatalogKind = BusinessCatalogKind.Service,
    val priceCents: String = "",
    val priceMaxCents: String = "",
    val priceUnit: String = "",
    val durationMinutes: String = "",
    val isFeatured: Boolean = false,
    val isDraft: Boolean = false,
    val categoryId: String? = null,
) {
    val isValid: Boolean get() = name.trim().isNotEmpty()

    /**
     * Donation items reject a fixed price server-side
     * (`DONATION_NO_FIXED_PRICE`, `backend/routes/businesses.js:2350`), so
     * the price is nulled rather than sent and 400'd.
     */
    fun asRequest(): BusinessCatalogItemRequest {
        val isDonation = kind == BusinessCatalogKind.Donation
        return BusinessCatalogItemRequest(
            name = name.trim(),
            description = description.trim(),
            kind = kind.wire,
            status = (if (isDraft) BusinessCatalogStatus.Draft else BusinessCatalogStatus.Active).wire,
            priceCents = if (isDonation) null else priceCents.trim().toIntOrNull(),
            priceMaxCents = if (isDonation) null else priceMaxCents.trim().toIntOrNull(),
            priceUnit = priceUnit.trim(),
            durationMinutes = durationMinutes.trim().toIntOrNull(),
            isFeatured = isFeatured,
            categoryId = categoryId,
        )
    }

    companion object {
        /** Seed an editor from an existing row (RN `startEditCatalogItem`). */
        fun from(row: BusinessCatalogItemRow): BusinessCatalogItemDraft =
            BusinessCatalogItemDraft(
                name = row.name,
                description = row.description.orEmpty(),
                kind = row.kind,
                priceCents = row.priceCents?.toString().orEmpty(),
                priceMaxCents = row.priceMaxCents?.toString().orEmpty(),
                priceUnit = row.priceUnit.orEmpty(),
                durationMinutes = row.durationMinutes?.toString().orEmpty(),
                isFeatured = row.isFeatured,
                isDraft = row.status == BusinessCatalogStatus.Draft,
                categoryId = row.categoryId,
            )
    }
}

/** Loaded catalog payload — items in `sort_order` plus the categories. */
data class BusinessCatalogContent(
    val items: List<BusinessCatalogItemRow>,
    val categories: List<BusinessCatalogCategoryRow>,
)

/** Four render states for the catalog manager. */
sealed interface BusinessCatalogUiState {
    data object Loading : BusinessCatalogUiState

    /** No items yet — categories still load so "Add item" can assign one. */
    data class Empty(
        val categories: List<BusinessCatalogCategoryRow>,
    ) : BusinessCatalogUiState

    data class Loaded(
        val content: BusinessCatalogContent,
    ) : BusinessCatalogUiState

    data class Error(
        val message: String,
    ) : BusinessCatalogUiState
}

/** Categories regardless of which loaded-ish state we're in. */
val BusinessCatalogUiState.categoryRows: List<BusinessCatalogCategoryRow>
    get() =
        when (this) {
            is BusinessCatalogUiState.Empty -> categories
            is BusinessCatalogUiState.Loaded -> content.categories
            else -> emptyList()
        }

/** Direction for the move-up / move-down reorder affordance. */
enum class BusinessCatalogMoveDirection { Up, Down }
