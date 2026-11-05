//
//  CrewDayChangeSheet.swift
//  Pantopus
//
//  8. Change or cancel (build kit 01-spec.md, board `Cancel`): before the
//  cutoff, Change my home details, Edit the note for the crew and Cancel my
//  booking (free); after it, the note and Ask the crew to cancel. Change my
//  home details re-prices the home from the day's price list: the household
//  sees the new total before it saves, and a look-first option goes back to
//  the crew.
//

import SwiftUI

struct CrewDayChangeSheet: View {
    let booking: CrewDayBookingDTO
    let onDetails: () -> Void
    let onNote: () -> Void
    let onCancel: () -> Void
    let onAskRelease: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                CrewDaySheetHeader(title: "Change or cancel") { dismiss() }
                if booking.canChange {
                    row(
                        icon: .house,
                        title: "Change my home details",
                        line: "Stories and add-ons. You approve any new price first.",
                        identifier: "crewDayCancelDetails",
                        chevron: true,
                        action: onDetails
                    )
                    Divider().overlay(Theme.Color.appBorder)
                }
                row(
                    icon: .pencil,
                    title: "Edit the note for the crew",
                    line: "The crew sees it on the day only.",
                    identifier: "crewDayCancelNote",
                    chevron: true,
                    action: onNote
                )
                if booking.canCancel {
                    Divider().overlay(Theme.Color.appBorder)
                    row(
                        icon: .calendarX,
                        title: "Cancel my booking",
                        line: freeLine,
                        identifier: "crewDayCancelBooking",
                        danger: true,
                        action: onCancel
                    )
                } else if booking.canAskRelease || booking.releaseAskedAt != nil {
                    Divider().overlay(Theme.Color.appBorder)
                    row(
                        icon: .messageCircle,
                        title: booking.releaseAskedAt == nil ? "Ask the crew to cancel" : "You asked the crew to cancel",
                        line: "It's less than 48 hours to go. \(crew) can release your home at no charge.",
                        identifier: booking.releaseAskedAt == nil ? "crewDayCancelAskCrew" : "crewDayCancelAsked",
                        chevron: booking.releaseAskedAt == nil,
                        action: onAskRelease
                    )
                    .disabled(booking.releaseAskedAt != nil)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s5)
        }
        .crewDaySheetDetents([.medium, .large])
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayCancel")
    }

    private var crew: String {
        CrewDayBookingPageCopy.crewName(booking)
    }

    /// "Free until Sun, Nov 15 at 9 AM. Nothing has been charged."
    private var freeLine: String {
        guard let cutoff = booking.cancelCutoffAt else { return "Nothing has been charged." }
        let when = "\(CrewDayBookingPageCopy.shortDay(cutoff, booking)) at \(CrewDayBookingPageCopy.time(cutoff, booking))"
        return "Free until \(when). Nothing has been charged."
    }

    private func row(
        icon: PantopusIcon,
        title: String,
        line: String,
        identifier: String,
        danger: Bool = false,
        chevron: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(danger ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken)
                    .frame(width: 36, height: 36)
                    .overlay(Icon(icon, size: 18, color: danger ? Theme.Color.error : Theme.Color.appTextStrong))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(danger ? Theme.Color.error : Theme.Color.appText)
                    Text(line)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if chevron {
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary).padding(.top, 10)
                }
            }
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(identifier)
    }
}

/// A sheet's title with a round Close button.
struct CrewDaySheetHeader: View {
    let title: String
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(title)
                .planFont(.h3)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            Button(action: onClose) {
                Icon(.x, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("crewDaySheetClose")
        }
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s1)
    }
}

/// "Change my home details": the option and add-ons from the day's price list, re-priced before anything is saved.
struct CrewDayDetailsSheet: View {
    let viewModel: CrewDayBookingViewModel
    let booking: CrewDayBookingDTO
    let onBack: () -> Void
    @State private var optionId: String?
    @State private var addOnIds: Set<String> = []
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                CrewDaySheetHeader(title: "Change my home details") { dismiss() }
                switch viewModel.priceList {
                case let .loaded(list):
                    form(list)
                case let .failed(message):
                    CrewDayErrorText(text: message, identifier: "crewDayDetailsError")
                    Button("Try again") { Task { await viewModel.loadPriceList() } }
                        .crewDayButton(.secondary)
                case .loading, nil:
                    CrewDayLoadingView()
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s5)
        }
        .crewDaySheetDetents([.large])
        .task {
            optionId = booking.option?.id
            addOnIds = Set(booking.addOns.map(\.id))
            await viewModel.loadPriceList()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayDetails")
    }

    @ViewBuilder
    private func form(_ list: CrewDayInvitationDTO) -> some View {
        let picked = list.priceOptions.first { $0.id == optionId }
        let addOns = list.addOns.filter { addOnIds.contains($0.id) }
        let newPrice = picked.flatMap { $0.needsLook ? nil : $0.priceCents }.map { $0 + addOns.reduce(0) { $0 + $1.priceCents } }
        let changed = picked != nil && (optionId != booking.option?.id || addOnIds != Set(booking.addOns.map(\.id)))
        Text.planOverline(list.priceOptions.contains { $0.label.localizedCaseInsensitiveContains("stor") }
            ? "How many stories?" : "Which fits your home?")
        CrewDayCard(padding: 0) {
            VStack(spacing: 0) {
                ForEach(Array(list.priceOptions.enumerated()), id: \.element.id) { index, option in
                    if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                    CrewDayChoiceRow(
                        label: option.label,
                        detail: option.needsLook ? "The crew confirms the price after a look" : nil,
                        price: option.priceCents.map(CrewDayFormat.price),
                        selected: optionId == option.id,
                        radio: true,
                        identifier: "crewDayCancelOption_\(option.id)"
                    ) { optionId = option.id }
                }
            }
        }
        if !list.addOns.isEmpty {
            Text.planOverline("Add-ons")
            CrewDayCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(list.addOns.enumerated()), id: \.element.id) { index, addOn in
                        if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                        CrewDayChoiceRow(
                            label: addOn.label,
                            detail: nil,
                            price: CrewDayFormat.addOn(addOn.priceCents),
                            selected: addOnIds.contains(addOn.id),
                            radio: false,
                            identifier: "crewDayCancelAddOn_\(addOn.id)"
                        ) {
                            if addOnIds.contains(addOn.id) { addOnIds.remove(addOn.id) } else { addOnIds.insert(addOn.id) }
                        }
                    }
                }
            }
        }
        Text(summary(picked: picked, newPrice: newPrice, changed: changed))
            .planFont(.body)
            .foregroundStyle(Theme.Color.appTextStrong)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("crewDayDetailsSummary")
        VStack(spacing: 10) {
            Button { Task { await save(picked: picked, newPrice: newPrice) } } label: {
                PlanButtonLabel(
                    title: saveTitle(picked: picked, newPrice: newPrice, changed: changed),
                    isLoading: viewModel.working == .details
                )
            }
            .crewDayButton(.primary)
            .disabled(!changed || viewModel.working != nil)
            .accessibilityIdentifier("crewDayCancelSaveDetails")
            Button("Back", action: onBack)
                .crewDayButton(.secondary)
                .accessibilityIdentifier("crewDayDetailsBack")
        }
        if let error = viewModel.actionError { CrewDayErrorText(text: error, identifier: "crewDayDetailsSaveError") }
    }

    private func summary(picked: CrewDayPriceOption?, newPrice: Int?, changed: Bool) -> String {
        let crew = CrewDayBookingPageCopy.crewName(booking)
        if picked?.needsLook == true {
            return "\(crew) confirms your new price after a look. You approve it before anything changes, "
                + "and nothing is charged until the work is done."
        }
        guard let newPrice else { return "" }
        let was = changed && booking.priceCents != nil && newPrice != booking.priceCents
            ? " (was \(CrewDayFormat.price(booking.priceCents)))" : ""
        let lead = changed ? "Your new price" : "Your price"
        return "\(lead): \(CrewDayFormat.price(newPrice)), including tax\(was). Nothing is charged until the work is done."
    }

    private func saveTitle(picked: CrewDayPriceOption?, newPrice: Int?, changed: Bool) -> String {
        guard changed else { return "Nothing changed yet" }
        if picked?.needsLook == true { return "Ask for my price" }
        return newPrice.map { "Change to \(CrewDayFormat.price($0))" } ?? "Save"
    }

    private func save(picked: CrewDayPriceOption?, newPrice: Int?) async {
        guard let picked else { return }
        let crew = CrewDayBookingPageCopy.crewName(booking)
        let done = picked.needsLook
            ? "We asked \(crew) for your new price."
            : "Saved. Your price is \(newPrice.map(CrewDayFormat.price) ?? "updated")."
        if await viewModel.changeDetails(optionId: picked.id, addOnIds: Array(addOnIds), done: done) { dismiss() }
    }
}

/// A radio or checkbox row with an optional line under it and a price.
struct CrewDayChoiceRow: View {
    let label: String
    let detail: String?
    let price: String?
    let selected: Bool
    let radio: Bool
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: detail == nil ? .center : .top, spacing: Spacing.s3) {
                Icon(glyph, size: 22, color: selected ? Theme.Color.primarySolid : Theme.Color.appBorderStrong)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).planFont(.body).foregroundStyle(Theme.Color.appText)
                    if let detail {
                        Text(detail).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let price {
                    Text(price).planFont(.bodyStrong).monospacedDigit().foregroundStyle(Theme.Color.appText)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier)
    }

    private var glyph: PantopusIcon {
        if radio { return selected ? .circleDot : .circle }
        return selected ? .checkCircle2 : .square
    }
}
