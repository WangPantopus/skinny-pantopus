//
//  PlaceRealRentContribution.swift
//  Pantopus
//
//  The resident's own half of the Real Rent benchmark: the form that
//  adds their monthly rent to the block pool, and the card that reports
//  it back. Split out of PlaceRealRentSection.swift for the 500-line
//  file budget.
//
//  Two rules this file exists to hold:
//    * a save failure NEVER collapses the form — the typed amount stays
//      put and the message lands inline;
//    * the copy never implies a neighbor's figure is visible. Only the
//      viewer sees their own number; the block only ever emits quartiles.
//

import SwiftUI

// swiftlint:disable line_length

// MARK: - The resident's own contribution

struct RealRentContribution: View {
    @Bindable var vm: PlaceRealRentViewModel
    let detail: PlaceDetailViewModel

    var body: some View {
        switch vm.state {
        case .loading:
            PlaceDetailCard(padding: 14) {
                Text("Loading your rent…")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .error(message):
            RealRentLoadErrorCard(message: message, vm: vm)
        case .none:
            form(title: "Add your rent", cta: "Add my rent", cancellable: false)
        case let .loaded(report):
            if vm.isEditing {
                form(title: "Update your rent", cta: "Save", cancellable: true)
            } else {
                savedCard(report)
            }
        }
    }

    private func form(title: String, cta: String, cancellable: Bool) -> some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Your figure is pooled with your neighbors' and only ever leaves as quartiles — nobody, including us, shows a single home's rent. Only verified residents can add one, which is the whole reason this benchmark is worth reading.")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                field(label: "Monthly rent", placeholder: "2,400", text: $vm.rentInput)
                field(label: "Bedrooms (optional)", placeholder: "2", text: $vm.bedroomsInput)
                if let saveError = vm.saveError {
                    Text(saveError)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("place.realRent.saveError")
                }
                HStack(spacing: Spacing.s2) {
                    Button {
                        Task {
                            if await vm.save() { await detail.refresh() }
                        }
                    } label: {
                        Text(vm.isSaving ? "Saving…" : cta)
                            .font(.system(size: 14.5, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isSaving || vm.rentInput.trimmingCharacters(in: .whitespaces).isEmpty)
                    if cancellable {
                        Button {
                            vm.cancelEditing()
                        } label: {
                            Text("Cancel")
                                .font(.system(size: 13.5, weight: .semibold))
                        }
                        .buttonStyle(.bordered)
                        .disabled(vm.isSaving)
                    }
                }
            }
        }
        .accessibilityIdentifier("place.realRent.form")
    }

    private func field(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
            TextField(placeholder, text: text)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 15))
        }
    }

    private func savedCard(_ report: RentReport) -> some View {
        PlaceDetailCard(padding: 14) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Text("Your rent")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Spacer(minLength: 0)
                    PlaceChip(model: PlaceChipModel(tone: .success, text: "Counted", icon: .badgeCheck))
                }
                Text(savedLine(report))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Counted toward your block's benchmark. Only you see this figure; your neighbors only ever see the block's quartiles.")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
                // A withdrawal that fails must SAY so. Silently leaving
                // the card in place reads as a dead button and lets the
                // resident believe their figure is out of the pool when
                // it is still counted.
                if let saveError = vm.saveError {
                    Text(saveError)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("place.realRent.removeError")
                }
                HStack(spacing: Spacing.s2) {
                    Button {
                        vm.beginEditing()
                    } label: {
                        Text("Update")
                            .font(.system(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isSaving)
                    Button(role: .destructive) {
                        Task {
                            if await vm.remove() { await detail.refresh() }
                        }
                    } label: {
                        Text(vm.isSaving ? "Removing…" : "Remove")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .buttonStyle(.bordered)
                    .disabled(vm.isSaving)
                }
            }
        }
        .accessibilityIdentifier("place.realRent.yourReport")
    }

    private func savedLine(_ report: RentReport) -> String {
        let amount = PlacePresentation.money(report.monthlyRent) ?? "—"
        guard let bedrooms = report.bedrooms else { return "\(amount) / mo" }
        return bedrooms == 0 ? "\(amount) / mo · studio" : "\(amount) / mo · \(bedrooms)BR"
    }
}

private struct RealRentLoadErrorCard: View {
    let message: String
    let vm: PlaceRealRentViewModel

    var body: some View {
        PlaceDetailCard(padding: 14) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(message)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Button {
                    Task { await vm.load() }
                } label: {
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.Color.primary600)
            }
        }
    }
}
