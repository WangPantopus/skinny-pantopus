//
//  CreateBusinessInvoiceSheet.swift
//  Pantopus
//
//  "New invoice" sheet for the owner Invoices surface. Recipient (picked from
//  the people the crew already knows, `GET …/invoice-recipients`) + 1..50
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
                    recipientSection

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
        .task { viewModel.searchRecipients(immediately: true) }
        .onChange(of: viewModel.recipientQuery) { _, _ in viewModel.searchRecipients() }
    }

    // MARK: - Recipient

    /// Picked from the people this crew already knows; their id is what's sent.
    @ViewBuilder private var recipientSection: some View {
        if let person = viewModel.recipient {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: 2) {
                    Text("Recipient")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("*")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityHidden(true)
                }
                HStack(spacing: Spacing.s2) {
                    recipientInitials(person.name)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(person.name)
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Text("@\(person.username)")
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: Spacing.s0)
                    Button { viewModel.clearRecipient() } label: {
                        Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change recipient")
                    .accessibilityIdentifier("createInvoice.recipient.change")
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            .accessibilityIdentifier("createInvoice.recipient.chosen")
        } else {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PantopusTextField(
                    "Recipient",
                    text: $viewModel.recipientQuery,
                    placeholder: "Search people you know",
                    isRequired: true,
                    identifier: "createInvoice.recipient"
                )
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

                recipientOptionsList
            }
        }
    }

    private var recipientOptionsList: some View {
        VStack(spacing: Spacing.s0) {
            if viewModel.recipientOptions.isEmpty {
                Text(
                    viewModel.isSearchingRecipients
                        ? "Searching…"
                        : "No one found. You can invoice people you’ve invoiced, booked or worked for, "
                        + "people who messaged your business, and your connections."
                )
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s3)
                .accessibilityIdentifier("createInvoice.recipient.empty")
            } else {
                ForEach(viewModel.recipientOptions) { person in
                    Button { viewModel.selectRecipient(person) } label: {
                        HStack(spacing: Spacing.s2) {
                            recipientInitials(person.name)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(person.name)
                                    .font(.system(size: 13.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                    .lineLimit(1)
                                Text("@\(person.username) · \(person.relationLabel)")
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: Spacing.s0)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("createInvoice.recipient.option")
                    if person.id != viewModel.recipientOptions.last?.id {
                        Divider()
                    }
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func recipientInitials(_ name: String) -> some View {
        ZStack {
            Circle().fill(Theme.Color.business)
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 32, height: 32)
        .accessibilityHidden(true)
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
