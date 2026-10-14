//
//  PlansAreaPicker.swift
//  Pantopus
//
//  The sheet behind the map's area pill ("Camas · This week"): when, and
//  around where. No board draws it; it is built from the boards' parts
//  (choice chips, rows, the scope line).
//

import SwiftUI

struct PlansAreaPicker: View {
    let viewModel: PlansMapViewModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s6) {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text.planOverline("When")
                        PlanChoiceChips(
                            options: [
                                PlanChoiceOption(id: PlansWindow.now, label: "Happening now"),
                                PlanChoiceOption(id: PlansWindow.today, label: "Today"),
                                PlanChoiceOption(id: PlansWindow.week, label: "This week"),
                                PlanChoiceOption(id: PlansWindow.weekend, label: "This weekend")
                            ],
                            isSelected: { $0 == viewModel.window },
                            onTap: { window in
                                Task { await viewModel.setWindow(window) }
                                onClose()
                            },
                            groupLabel: "When",
                            identifier: "plansWindow"
                        )
                    }
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text.planOverline("Around")
                        PlanChoiceChips(
                            options: places,
                            isSelected: { $0 == viewModel.centerSource },
                            onTap: { source in
                                Task {
                                    if source == .home { await viewModel.useHome() } else { await viewModel.locate() }
                                }
                                onClose()
                            },
                            groupLabel: "Around",
                            identifier: "plansAround"
                        )
                        PlanScopeLine(text: "Your location only finds plans near you. Nobody sees it.")
                    }
                }
                .padding(Spacing.s4)
            }
            .navigationTitle("Area and time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onClose)
                }
            }
        }
    }

    private var places: [PlanChoiceOption<PlansCenterSource>] {
        var options = [PlanChoiceOption(id: PlansCenterSource.gps, label: "Use my location")]
        if viewModel.homeCenter != nil { options.append(PlanChoiceOption(id: .home, label: "Use my home")) }
        return options
    }
}
