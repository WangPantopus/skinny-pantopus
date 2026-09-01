//
//  CreateBusinessInvoiceSheet.swift
//  Pantopus
//
//  "New invoice" sheet for the owner Invoices surface. Recipient + 1..50
//  line items (description / unit amount / quantity) + optional due date and
//  memo, then `POST /api/businesses/:id/invoices`. The client never computes
//  a total — the server derives subtotal / fee / total from the line items
//  (`backend/routes/businesses.js:4789`).
//
//  Mirrors RN `InvoicesTab.tsx`'s create modal and Android
//  `CreateInvoiceSheet` in `BusinessInvoicesScreen.kt`.
//

import SwiftUI

@MainActor
struct CreateBusinessInvoiceSheet: View {
    @Bindable var viewModel: BusinessInvoicesViewModel
    let onDismiss: @MainActor () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    PantopusTextField(
                        "Recipient user ID",
                        text: $viewModel.recipientUserId,
                        placeholder: "Paste user ID",
                        isRequired: true,
                        identifier: "createInvoice.recipient"
                    )
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                    lineItemsSection

                    PantopusTextField(
                        "Due date (optional)",
                        text: $viewModel.dueDate,
                        placeholder: "YYYY-MM-DD",
                        identifier: "createInvoice.dueDate"
                    )
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                    PantopusTextField(
                        "Memo (optional)",
                        text: $viewModel.memo,
                        placeholder: "Note to recipient…",
                        identifier: "createInvoice.memo"
                    )

                    if let error = viewModel.createError {
                        Text(error)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("createInvoice.error")
                    }

                    PrimaryButton(title: "Send invoice", isLoading: viewModel.isCreating) {
                        if await viewModel.createInvoice() {
                            onDismiss()
                        }
                    }
                    .accessibilityIdentifier("createInvoice.submit")
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("New invoice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { onDismiss() }
                        .accessibilityIdentifier("createInvoice.cancel")
                }
            }
        }
        .accessibilityIdentifier("createInvoice.sheet")
    }

    // MARK: - Line items

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("LINE ITEMS")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)

            ForEach($viewModel.lineItems) { $item in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(spacing: Spacing.s2) {
                        PantopusTextField(
                            "Description",
                            text: $item.description,
                            placeholder: "What are you billing for?"
                        )
                        if viewModel.lineItems.count > 1 {
                            Button { viewModel.removeLineItem(id: item.id) } label: {
                                Icon(.trash2, size: 16, color: Theme.Color.error)
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 18)
                            .accessibilityLabel("Remove line item")
                            .accessibilityIdentifier("createInvoice.removeLineItem")
                        }
                    }
                    HStack(spacing: Spacing.s2) {
                        PantopusTextField(
                            "Amount",
                            text: $item.amount,
                            placeholder: "0.00",
                            keyboardType: .decimalPad
                        )
                        PantopusTextField(
                            "Qty",
                            text: $item.quantity,
                            placeholder: "1",
                            keyboardType: .numberPad
                        )
                        .frame(width: 84)
                    }
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }

            Button { viewModel.addLineItem() } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.plusCircle, size: 16, color: Theme.Color.business)
                    Text("Add line item")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.business)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createInvoice.addLineItem")
        }
    }
}
