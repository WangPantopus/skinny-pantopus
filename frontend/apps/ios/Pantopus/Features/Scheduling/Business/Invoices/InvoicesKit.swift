//
//  InvoicesKit.swift
//  Pantopus
//
//  Stream I15 — invoice helpers (G12/G13). Defensively parses the invoice's
//  `line_items` jsonb (gig-system shape varies) into renderable rows, and groups
//  invoices by created day for the list.
//
//  Backend/Foundation note: the shared `InvoiceDTO` exposes id / business_user_id
//  / recipient_user_id / total_cents / currency / line_items / created_at only.
//  The BusinessInvoice table additionally has status / subtotal_cents / fee_cents
//  / due_date / memo / paid_at — but those aren't in the DTO, so the design's
//  status pills, status filters, subtotal+fee breakdown, due date, payment
//  timeline, sender note, and payer display names can't be rendered yet. This is
//  flagged as a Foundation DTO gap (see the PR) rather than patched locally.
//

import Foundation
import SwiftUI

/// A single renderable invoice line item parsed from the untyped `line_items`.
struct InvoiceLineItem: Identifiable, Hashable {
    let id = UUID()
    let label: String
    let quantity: Int?
    let unitCents: Int?
    let totalCents: Int?
}

enum InvoiceParsing {
    /// Parse `line_items` JSON into rows. Tolerant of key naming (description /
    /// name / label / title; quantity / qty; *_cents amount fields). Elements we
    /// can't make sense of are skipped.
    static func lineItems(from value: JSONValue?) -> [InvoiceLineItem] {
        guard let array = value?.arrayValue else { return [] }
        return array.compactMap { element in
            guard let dict = element.dictValue else { return nil }
            let label = firstString(dict, ["description", "name", "label", "title"]) ?? "Item"
            let quantity = firstInt(dict, ["quantity", "qty"])
            let unit = firstInt(dict, ["unit_amount_cents", "unit_cents", "unit_price_cents"])
            let total = firstInt(dict, ["total_cents", "amount_cents", "line_total_cents", "total", "amount"])
            // Skip rows that carry no money at all (e.g. metadata-only objects).
            if unit == nil, total == nil, !dict.keys.contains(where: { $0.contains("amount") || $0.contains("total") }) {
                return nil
            }
            return InvoiceLineItem(label: label, quantity: quantity, unitCents: unit, totalCents: total)
        }
    }

    private static func firstString(_ dict: [String: JSONValue], _ keys: [String]) -> String? {
        for key in keys {
            if let value = dict[key]?.stringValue, !value.isEmpty { return value }
        }
        return nil
    }

    private static func firstInt(_ dict: [String: JSONValue], _ keys: [String]) -> Int? {
        for key in keys {
            if let value = dict[key]?.numberValue { return Int(value) }
        }
        return nil
    }
}

// MARK: - Invoice status chip

/// Tone-coloured uppercase pill for invoice status used in the list row trailing
/// slot (`invoiceslist-frames.jsx` STATUS map, line 57-58) and the detail top-bar
/// (`invoicedetail-frames.jsx` PILL, line 159).
/// Tones: paid=green, sent/draft=sky-blue, overdue/partial=amber,
///        refunded=business-violet, void/unknown=neutral.
struct InvoiceStatusChip: View {
    let status: String

    var tone: PkgChip.Tone {
        switch status.lowercased() {
        case "paid": .success
        case "sent", "draft": .sky
        case "overdue", "partial": .warning
        case "refunded": .business
        default: .neutral
        }
    }

    var chipLabel: String {
        switch status.lowercased() {
        case "partial": "Deposit paid"
        default: status.prefix(1).uppercased() + status.dropFirst()
        }
    }

    var body: some View {
        PkgChip(text: chipLabel, tone: tone, uppercased: true)
    }
}

/// A day-grouped section of invoices (created_at descending within each day).
struct InvoiceDaySection: Identifiable {
    let id: String
    let day: String
    let invoices: [InvoiceDTO]
}

enum InvoiceGrouping {
    static func byDay(_ invoices: [InvoiceDTO]) -> [InvoiceDaySection] {
        var order: [String] = []
        var buckets: [String: [InvoiceDTO]] = [:]
        for invoice in invoices {
            let day = PackagesFormat.dayString(invoice.createdAt) ?? "Earlier"
            if buckets[day] == nil { order.append(day) }
            buckets[day, default: []].append(invoice)
        }
        return order.map { InvoiceDaySection(id: $0, day: $0, invoices: buckets[$0] ?? []) }
    }
}
