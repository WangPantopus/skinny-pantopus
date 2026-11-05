//
//  CrewDayNewView.swift
//  Pantopus
//
//  14. New Crew Day on the phone (build kit 01-spec.md, board `NewCrewDay`):
//  the Wizard archetype with the business pillar, steps 3 (prices, the prep
//  note, the fee) and 4 (review and send), and "Waiting for Pantopus" once
//  it is sent.
//

import SwiftUI

struct CrewDayNewView: View {
    @State var model: CrewDayNewModel
    let onDone: (String?) -> Void

    var body: some View {
        Group {
            if let status = model.sentStatus {
                sent(status)
            } else {
                WizardShell(model: model, identity: .business, scrollResetID: model.step) {
                    switch model.step {
                    case .service: CrewDayNewServiceStep(model: model)
                    case .whereWhen: CrewDayNewWhereStep(model: model)
                    case .prices: CrewDayNewPricesStep(model: model)
                    case .review: CrewDayNewReviewStep(model: model)
                    }
                    if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayNewError") }
                }
            }
        }
        .task { await model.loadFee() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayNew")
    }

    private func sent(_ status: String) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            CrewDayTile(size: 64)
            Text(status == "draft" ? "Saved as a draft" : "Waiting for Pantopus")
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text(status == "draft"
                ? "Send it to Pantopus from Crew Days when it's ready."
                : "We'll tell you within a business day. Neighbors can book once it's approved.")
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Button("Done") { onDone(model.sentDayId) }
                .planButton(.primary)
                .accessibilityIdentifier("crewDayNewDone")
        }
        .padding(Spacing.s5)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("crewDayNewSent")
    }
}

struct CrewDayNewPricesStep: View {
    @Bindable var model: CrewDayNewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                CrewDaySectionTitle(text: "Prices")
                Text("Prices include any sales tax you owe. Households see one total.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach($model.options) { $option in
                    CrewDayCard(padding: Spacing.s3) {
                        HStack(spacing: Spacing.s2) {
                            CrewDayTextField(placeholder: "Two stories", text: $option.label, limit: 60)
                            if !option.needsLook {
                                CrewDayTextField(placeholder: "$", text: $option.price, limit: 6)
                                    .keyboardType(.decimalPad)
                                    .frame(width: 96)
                            }
                        }
                        Toggle("I confirm this one after a look", isOn: $option.needsLook)
                            .planFont(.small)
                            .tint(Theme.Color.home)
                        if model.options.count > 1 {
                            Button("Remove") { model.options.removeAll { $0.id == option.id } }
                                .planButton(.textDanger, size: .extraSmall)
                        }
                    }
                    .accessibilityIdentifier("crewDayNewOption_\(option.id)")
                }
                if model.options.count < 6 {
                    Button("Add a price") {
                        model.options.append(CrewDayNewOption(id: Self.newId("opt"), label: "", price: "", needsLook: false))
                    }
                    .planButton(.text, size: .extraSmall)
                    .accessibilityIdentifier("crewDayNewOptionAdd")
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s3) {
                CrewDaySectionTitle(text: "Add-ons")
                ForEach($model.addOns) { $addOn in
                    HStack(spacing: Spacing.s2) {
                        CrewDayTextField(placeholder: "Clean the gutter guards", text: $addOn.label, limit: 60)
                        CrewDayTextField(placeholder: "$", text: $addOn.price, limit: 6)
                            .keyboardType(.decimalPad)
                            .frame(width: 96)
                        Button { model.addOns.removeAll { $0.id == addOn.id } } label: {
                            Icon(.x, size: 16, color: Theme.Color.appTextSecondary).frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove this add-on")
                    }
                    .accessibilityIdentifier("crewDayNewAddOn_\(addOn.id)")
                }
                if model.addOns.count < 4 {
                    Button("Add an add-on") {
                        model.addOns.append(CrewDayNewAddOn(id: Self.newId("add"), label: "", price: ""))
                    }
                    .planButton(.text, size: .extraSmall)
                    .accessibilityIdentifier("crewDayNewAddOnAdd")
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDaySectionTitle(text: "One thing for households to do")
                CrewDayTextField(
                    placeholder: "Please keep the side gate unlocked and pets inside.",
                    text: $model.prepNote,
                    limit: 500,
                    axis: .vertical
                )
                .accessibilityIdentifier("crewDayNewPrepNote")
                Text("Households see this after they book.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(model.feeLine)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("crewDayNewFee")
        }
    }

    /// A short id for a new price or add-on row ("opt_3fa9c1").
    private static func newId(_ prefix: String) -> String {
        "\(prefix)_\(UUID().uuidString.prefix(6).lowercased())"
    }
}

struct CrewDayNewReviewStep: View {
    let model: CrewDayNewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            CrewDayCard {
                CrewDayServiceTag(service: model.service.rawValue)
                Text(model.title).planFont(.h3).foregroundStyle(Theme.Color.appText)
                Text("\(CrewDayFormat.longDay(CrewDayNewDefaults.dayString(model.serviceDate), timezone: nil)) · Arriving \(window)")
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(details)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            CrewDayCard {
                CrewDaySectionTitle(text: "Prices")
                ForEach(model.options) { option in
                    HStack {
                        Text(option.label).planFont(.body).foregroundStyle(Theme.Color.appText)
                        Spacer()
                        Text(option.needsLook ? "After a look" : CrewDayFormat.price(option.cents))
                            .planFont(.bodyStrong)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Color.appText)
                    }
                }
                ForEach(model.addOns.filter { $0.cents != nil }) { addOn in
                    HStack {
                        Text(addOn.label).planFont(.body).foregroundStyle(Theme.Color.appText)
                        Spacer()
                        Text(CrewDayFormat.addOn(addOn.cents ?? 0)).planFont(.bodyStrong).monospacedDigit()
                    }
                }
            }
            CrewDayCard {
                CrewDaySectionTitle(text: "What the crew does")
                ForEach(model.included.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }, id: \.self) { item in
                    CrewDayCheckRow(text: item)
                }
                if model.outsideOnly {
                    Text("Outside only. Households don't need to be home.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if !model.prepNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("For households: \(model.prepNote)")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Text("Pantopus checks every Crew Day before its invitation works. \(model.feeLine)")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// "10 homes · just this street · booking closes Sun, Nov 15, 9 AM".
    private var details: String {
        let closes = CrewDayFormat.dayAndTime(model.closesAt, timezone: nil)
        return "\(CrewDayFormat.homes(model.capacity)) · \(model.reach.label.lowercased()) · booking closes \(closes)"
    }

    private var window: String {
        CrewDayFormat.window(CrewDayNewDefaults.timeString(model.windowStart), CrewDayNewDefaults.timeString(model.windowEnd))
    }
}
