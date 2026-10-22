//
//  InvoicesRow.swift
//  Pantopus
//
//  The Wallet's way to the invoices businesses sent you (`ReceivedInvoicesView`):
//  receipt icon tile + "Invoices" + body line + chevron, in `TaxDocsRow`'s
//  geometry.
//

import SwiftUI

struct InvoicesRow: View {
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                        .fill(Theme.Color.businessBg)
                    Icon(.receiptText, size: 17, strokeWidth: 2, color: Theme.Color.business)
                }
                .frame(width: 34, height: 34)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Invoices")
                        .font(.system(size: 12.5, weight: .bold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Pay or look back at invoices from businesses you hire")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
            .pantopusShadow(.sm)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("walletInvoicesRow")
        .accessibilityLabel("Invoices: pay or look back at invoices from businesses you hire")
    }
}

#Preview("InvoicesRow") {
    InvoicesRow()
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
