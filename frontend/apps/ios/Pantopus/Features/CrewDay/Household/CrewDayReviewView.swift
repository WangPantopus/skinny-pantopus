//
//  CrewDayReviewView.swift
//  Pantopus
//
//  3. Review and book (build kit 01-spec.md, board `Review`), step 2 of 2:
//  the day and crew, the home and what's included, the note for the crew,
//  the saved card (or the existing add-card sheet), what happens if plans
//  change, the total, the approval tick, then Book (or Ask for my price).
//

import SwiftUI

struct CrewDayReviewView: View {
    @Bindable var model: CrewDayBookingFlowModel
    let invitation: CrewDayInvitationDTO
    @State private var choosesCard = false
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    day
                    home
                    forCrew
                    payment
                    plansChange
                }
                .padding(Spacing.s4)
                // At the accessibility text sizes the total, the approval and Book end the page; pinned, they'd
                // leave a few lines to read.
                if typeSize.isAccessibilitySize { footer }
            }
            if !typeSize.isAccessibilitySize { footer }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayReview")
    }

    private var day: some View {
        CrewDayCard {
            CrewDayServiceTag(service: invitation.service)
            Text(invitation.title).planFont(.h4).foregroundStyle(Theme.Color.appText)
            Text(CrewDayInvitationCopy.when(invitation))
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let crew = invitation.crew { CrewDayCrewRow(crew: crew) }
        }
    }

    private var home: some View {
        CrewDayCard {
            CrewDaySectionTitle(text: "Your home")
            if let address = model.address {
                Text(address.full).planFont(.body).foregroundStyle(Theme.Color.appText)
                CrewDayLockLine(text: "Visible to your crew and Pantopus.")
            }
            if let option = model.option {
                Text(([option.label] + model.chosenAddOns.map(\.label)).joined(separator: " · "))
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
            }
            ForEach(invitation.included, id: \.self) { CrewDayCheckRow(text: $0, tint: Theme.Color.home) }
        }
    }

    private var forCrew: some View {
        CrewDayCard {
            CrewDaySectionTitle(text: "For the crew (optional)")
            CrewDayTextField(
                label: "Note for the crew",
                placeholder: "Gate, pets, parking…",
                text: $model.accessNote,
                limit: 500,
                axis: .vertical
            )
            .accessibilityIdentifier("crewDayReviewNote")
            Text("The crew sees this on the day. It's deleted a week after the job.")
                .planFont(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var payment: some View {
        CrewDayCard {
            CrewDaySectionTitle(text: "Payment")
            if let card = model.card {
                CrewDayHeaderRow {
                    HStack {
                        Icon(.creditCard, size: 18, color: Theme.Color.appText)
                        Text(card.label)
                            .planFont(.bodyStrong)
                            .foregroundStyle(Theme.Color.appText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("crewDayReviewCard")
                    }
                } trailing: {
                    Button("Change") { choosesCard = true }
                        .crewDayButton(.text, size: .extraSmall)
                        .accessibilityIdentifier("crewDayReviewChangeCard")
                        // On iOS 26+ the dialog is a popover: anchor it to the button.
                        .confirmationDialog("Pay with", isPresented: $choosesCard, titleVisibility: .visible) {
                            ForEach(model.wallet.cards) { card in
                                Button(card.label) { model.cardId = card.id }
                            }
                            Button("Add a card") { Task { await model.addCard() } }
                        }
                }
            } else {
                Button { Task { await model.addCard() } } label: {
                    PlanButtonLabel(title: "Add a card", icon: .creditCard, kind: .secondary, isLoading: model.wallet.isAdding)
                }
                .crewDayButton(.secondary)
                .disabled(model.wallet.isAdding)
                .accessibilityIdentifier("crewDayReviewAddCard")
            }
            Text(chargeLine)
                .planFont(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let error = model.wallet.error { CrewDayErrorText(text: error, identifier: "crewDayReviewCardError") }
        }
    }

    /// "Saved now. Charged $180 the day after the crew finishes your home, unless you tell us something's wrong."
    private var chargeLine: String {
        guard let price = model.priceCents, !model.needsLook else {
            return "Saved now. Nothing is booked or charged until you approve the crew's price."
        }
        return "Saved now. Charged \(CrewDayFormat.price(price)) the day after the crew finishes your home, "
            + "unless you tell us something's wrong."
    }

    private var plansChange: some View {
        CrewDayCard {
            CrewDaySectionTitle(text: "If plans change")
            CrewDayCheckRow(
                text: "Cancel free until \(CrewDayFormat.dayAndTime(cutoff, timezone: invitation.timezone)).",
                icon: .calendar,
                tint: Theme.Color.appTextSecondary
            )
            CrewDayCheckRow(
                text: "Rain? You pick a new date or cancel free, at the same price.",
                icon: .cloudRain,
                tint: Theme.Color.appTextSecondary
            )
            CrewDayCheckRow(
                text: "A problem? Pantopus support owns it until it's fixed.",
                icon: .lifeBuoy,
                tint: Theme.Color.appTextSecondary
            )
        }
    }

    /// 48 hours before the window starts.
    private var cutoff: Date? {
        CrewDayFormat.instant(invitation.windowStartsAt).map { $0.addingTimeInterval(-48 * 3600) }
    }

    private var footer: some View {
        CrewDayFooter {
            if let price = model.priceCents, !model.needsLook {
                CrewDayHeaderRow {
                    Text("Total").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                } trailing: {
                    Text("\(CrewDayFormat.price(price)) · including tax")
                        .planFont(.bodyStrong)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                }
                .accessibilityElement(children: .combine)
            }
            Toggle(isOn: $model.approved) {
                Text(approvalLine)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .toggleStyle(CrewDayCheckboxStyle())
            .accessibilityIdentifier("crewDayReviewApprove")
            if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayReviewError") }
            Button { Task { await model.book() } } label: {
                PlanButtonLabel(title: bookTitle, isLoading: model.isBooking)
            }
            .crewDayButton(.primary)
            .disabled(!model.canBook)
            .accessibilityIdentifier("crewDayReviewBook")
        }
    }

    private var approvalLine: String {
        guard let price = model.priceCents, !model.needsLook else { return "I approve the scope and these terms." }
        return "I approve the scope, the \(CrewDayFormat.price(price)) total and these terms."
    }

    private var bookTitle: String {
        guard let price = model.priceCents, !model.needsLook else { return "Ask for my price" }
        return "Book for \(CrewDayFormat.price(price))"
    }
}

/// A square checkbox for an approval line.
struct CrewDayCheckboxStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(configuration.isOn ? Theme.Color.primarySolid : Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(configuration.isOn ? Theme.Color.primarySolid : Theme.Color.appBorderStrong, lineWidth: 1.5)
                    )
                    .overlay { if configuration.isOn { Icon(.check, size: 14, color: Theme.Color.appTextInverse) } }
                    .frame(width: 24, height: 24)
                configuration.label
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(configuration.isOn ? [.isButton, .isSelected] : .isButton)
    }
}
