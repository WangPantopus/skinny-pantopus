//
//  CrewDayRepeatView.swift
//  Pantopus
//
//  19. "Offer a Crew Day here again" (build kit 01-spec.md, board
//  `AfterDay`): reads the finished day, then opens New Crew Day prefilled
//  from it (service, included items, street and area, prices, prep note),
//  sent with `repeat_of` so past customers can be invited.
//

import SwiftUI

struct CrewDayRepeatView: View {
    let businessId: String
    let crewDayId: String
    let onClose: () -> Void
    let onDone: (String?) -> Void
    @State private var model: CrewDayNewModel?
    @State private var error: String?

    var body: some View {
        Group {
            if let model {
                CrewDayNewView(model: model, onDone: onDone)
            } else if let error {
                VStack(spacing: 0) {
                    PlanNavBar.crewDay(title: "New Crew Day", leading: .close, onLeading: onClose)
                    CrewDayErrorView(message: error) { await load() }
                }
            } else {
                VStack(spacing: 0) {
                    PlanNavBar.crewDay(title: "New Crew Day", leading: .close, onLeading: onClose)
                    CrewDayLoadingView()
                }
            }
        }
        .background(Theme.Color.appBg)
        .task { await load() }
    }

    private func load() async {
        guard model == nil else { return }
        do {
            let page: CrewDayCrewPageDTO = try await APIClient.shared.request(CrewDayEndpoints.crewDay(crewDayId: crewDayId))
            let next = CrewDayNewModel(businessId: businessId, onClose: onClose)
            next.prefill(from: page)
            model = next
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
        }
    }
}
