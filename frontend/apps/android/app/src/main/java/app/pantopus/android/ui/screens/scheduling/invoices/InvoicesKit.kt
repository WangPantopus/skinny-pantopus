@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.scheduling.invoices

import app.pantopus.android.data.api.models.scheduling.InvoiceDto
import app.pantopus.android.ui.screens.scheduling.packages.PackagesFormat

/**
 * Stream A15 — invoice helpers (G12/G13). Defensively parses the invoice's
 * `line_items` JSON (gig-system shape varies) into renderable rows, and groups
 * invoices by created day for the list. Mirrors iOS `InvoicesKit.swift`.
 *
 * Backend note: `InvoiceDto` now carries status / subtotal_cents / fee_cents /
 * due_date / paid_at from the BusinessInvoice row, powering the status pills,
 * KPI split, timeline, and due-date rendering. `memo` and payer display names
 * remain a Foundation DTO gap.
 */

/** A single renderable invoice line item parsed from the untyped `line_items`. */
data class InvoiceLineItem(
    val label: String,
    val quantity: Int?,
    val unitCents: Int?,
    val totalCents: Int?,
)

object InvoiceParsing {
    private val LABEL_KEYS = listOf("description", "name", "label", "title")
    private val QTY_KEYS = listOf("quantity", "qty")

    // The canonical create-invoice schema (backend businesses.js
    // createInvoiceSchema) carries a per-UNIT `amount_cents` plus `quantity`,
    // and computes subtotal as `amount_cents * quantity` — so `amount_cents` /
    // `amount` are unit prices, not line totals.
    private val UNIT_KEYS =
        listOf("unit_amount_cents", "unit_cents", "unit_price_cents", "amount_cents", "amount")
    private val TOTAL_KEYS = listOf("total_cents", "line_total_cents", "total")

    /**
     * Parse `line_items` maps into rows. Tolerant of key naming and number
     * types (Moshi decodes untyped numbers as Double). Rows that carry no money
     * at all (metadata-only) are skipped. When no explicit line-total key is
     * present the total is `unit × quantity`, matching the backend's subtotal
     * math (businesses.js:4789).
     */
    fun lineItems(items: List<Map<String, Any?>>?): List<InvoiceLineItem> {
        if (items.isNullOrEmpty()) return emptyList()
        return items.mapNotNull { dict ->
            val unit = firstInt(dict, UNIT_KEYS)
            val explicitTotal = firstInt(dict, TOTAL_KEYS)
            val hasMoneyKey = dict.keys.any { it.contains("amount") || it.contains("total") }
            if (unit == null && explicitTotal == null && !hasMoneyKey) return@mapNotNull null
            val quantity = firstInt(dict, QTY_KEYS)
            InvoiceLineItem(
                label = firstString(dict, LABEL_KEYS) ?: "Item",
                quantity = quantity,
                unitCents = unit,
                totalCents = explicitTotal ?: unit?.times(quantity ?: 1),
            )
        }
    }

    private fun firstString(
        dict: Map<String, Any?>,
        keys: List<String>,
    ): String? {
        for (key in keys) {
            val value = dict[key]
            if (value is String && value.isNotEmpty()) return value
        }
        return null
    }

    private fun firstInt(
        dict: Map<String, Any?>,
        keys: List<String>,
    ): Int? {
        for (key in keys) {
            when (val value = dict[key]) {
                is Int -> return value
                is Long -> return value.toInt()
                is Double -> return value.toInt()
                is String -> value.toDoubleOrNull()?.let { return it.toInt() }
                else -> Unit
            }
        }
        return null
    }
}

/** A day-grouped section of invoices (created_at order preserved within each day). */
data class InvoiceDaySection(
    val day: String,
    val invoices: List<InvoiceDto>,
)

object InvoiceGrouping {
    fun byDay(invoices: List<InvoiceDto>): List<InvoiceDaySection> {
        val order = mutableListOf<String>()
        val buckets = linkedMapOf<String, MutableList<InvoiceDto>>()
        invoices.forEach { invoice ->
            val day = PackagesFormat.dayString(invoice.createdAt) ?: "Earlier"
            if (buckets[day] == null) {
                buckets[day] = mutableListOf()
                order.add(day)
            }
            buckets.getValue(day).add(invoice)
        }
        return order.map { InvoiceDaySection(day = it, invoices = buckets.getValue(it)) }
    }
}
