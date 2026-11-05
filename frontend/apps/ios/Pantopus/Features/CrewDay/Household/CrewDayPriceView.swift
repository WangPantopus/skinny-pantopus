//
//  CrewDayPriceView.swift
//  Pantopus
//
//  2. Your price (build kit 01-spec.md, board `Price`), step 1 of 2: the
//  home (from Pantopus, or typed), the options with their prices, the
//  add-ons, and the home's own total. As soon as the address is known the
//  model asks whether the day reaches it; an address outside it gets "Ask
//  for one on your street" under Your home instead of the options, the
//  add-ons and Continue (as the web does).
//

import SwiftUI

struct CrewDayPriceView: View {
    @Bindable var model: CrewDayBookingFlowModel
    let invitation: CrewDayInvitationDTO
    let onAsk: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text("\(invitation.title) · \(CrewDayFormat.shortDay(invitation.serviceDate, timezone: invitation.timezone))")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    home
                    if model.outOfArea, let address = model.address {
                        outOfArea(address)
                    } else {
                        options
                        if !invitation.addOns.isEmpty { addOns }
                    }
                }
                .padding(Spacing.s4)
                // At the accessibility text sizes the total and Continue end the page; pinned, they'd cover half of it.
                if typeSize.isAccessibilitySize, !model.outOfArea { footer }
            }
            if !typeSize.isAccessibilitySize, !model.outOfArea { footer }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayPrice")
    }

    // MARK: - Your home

    private var home: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: "Your home")
            if let address = model.address, !model.isTypingAddress {
                CrewDayCard {
                    CrewDayHeaderRow {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(address.short).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                            Text([address.city, address.state].filter { !$0.isEmpty }.joined(separator: ", "))
                                .planFont(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            if address.homeId != nil {
                                Text("From your home in Pantopus")
                                    .planFont(.caption)
                                    .foregroundStyle(Theme.Color.home)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        // One stop for the address, so VoiceOver reads Change after it, not between its lines.
                        .accessibilityElement(children: .combine)
                    } trailing: {
                        Button("Change") { model.changeAddress() }
                            .crewDayButton(.text, size: .extraSmall)
                            .accessibilityIdentifier("crewDayPriceChangeAddress")
                    }
                    CrewDayLockLine(text: "Visible to your crew and Pantopus.")
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("crewDayPriceAddress")
            } else {
                CrewDayAddressField(
                    query: $model.addressQuery,
                    picked: nil,
                    identifier: "crewDayPriceAddressField",
                    onPick: { model.useTyped($0) },
                    onEdit: { model.clearTyped() }
                )
                ForEach(model.homes, id: \.self) { home in
                    Button { model.useHome(home) } label: {
                        Text("Use \(home.short)").planFont(.label)
                    }
                    .crewDayButton(.text, size: .extraSmall)
                }
                CrewDayLockLine(text: "Visible to your crew and Pantopus.")
            }
        }
    }

    // MARK: - Options

    private var options: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: invitation.service == CrewDayService.gutterCleaning.rawValue ? "How many stories?" : "Pick one")
            ForEach(invitation.priceOptions) { option in
                CrewDayRadioRow(
                    title: option.label,
                    detail: option.needsLook ? "The crew confirms the price after a look" : nil,
                    trailing: option.priceCents.map { CrewDayFormat.price($0) },
                    isSelected: model.optionId == option.id
                ) { model.select(option: option.id) }
                    .accessibilityIdentifier("crewDayPriceOption_\(option.id)")
            }
        }
    }

    private var addOns: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: "Add-ons")
            ForEach(invitation.addOns) { addOn in
                let isOn = model.addOnIds.contains(addOn.id)
                Button { model.toggle(addOn: addOn.id) } label: {
                    HStack(spacing: Spacing.s3) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(isOn ? Theme.Color.home : Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(isOn ? Theme.Color.home : Theme.Color.appBorderStrong, lineWidth: 1.5)
                            )
                            .overlay { if isOn { Icon(.check, size: 14, color: Theme.Color.appTextInverse) } }
                            .frame(width: 22, height: 22)
                        Text(addOn.label)
                            .planFont(.body)
                            .foregroundStyle(Theme.Color.appText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(CrewDayFormat.addOn(addOn.priceCents))
                            .planFont(.bodyStrong)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .padding(Spacing.s3)
                    .frame(minHeight: 52)
                    .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("crewDayPriceAddOn_\(addOn.id)")
            }
        }
    }

    // MARK: - Out of area

    /// The amber notice the web shows in the same place.
    private func outOfArea(_ address: CrewDayHomeAddress) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(Theme.Color.warningLight)
                    .frame(width: 34, height: 34)
                    .overlay(Icon(.mapPin, size: 18, color: Theme.Color.warningDeep))
                    .accessibilityHidden(true)
                Text("This Crew Day doesn't reach \(address.short). It covers homes near \(invitation.streetLabel).")
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button("Ask for one on your street", action: onAsk)
                .crewDayButton(.secondary)
                .accessibilityIdentifier("crewDayPriceAsk")
        }
        .padding(Spacing.s4)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.warningBg))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayPriceOutOfArea")
    }

    // MARK: - Footer

    private var footer: some View {
        CrewDayFooter {
            if model.needsLook {
                Text("The crew confirms your price before you're booked")
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
            } else {
                CrewDayHeaderRow {
                    Text("Your price").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                } trailing: {
                    Text(model.priceCents.map { "\(CrewDayFormat.price($0)) · including tax" } ?? "")
                        .planFont(.bodyStrong)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityIdentifier("crewDayPriceTotal")
                }
                Text("Nothing is charged until the work is done.")
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayPriceError") }
            Button { Task { await model.continueToReview() } } label: {
                PlanButtonLabel(title: "Continue", isLoading: model.isQuoting)
            }
            .crewDayButton(.primary)
            .disabled(!model.canContinue)
            .accessibilityIdentifier("crewDayPriceContinue")
        }
    }
}
