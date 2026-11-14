//
//  BusinessUpcomingPlansSection.swift
//  Pantopus
//
//  Plans with businesses, board B6: "Upcoming plans" on the page a business
//  already has, from `GET /api/businesses/:id/plans?biz=1`. Three rows, then
//  "See all 7" opens the rest in place; a row opens the plan. The section is
//  hidden while it loads, when it fails and when there are none, so the page
//  reads as today for anyone the business's plans don't exist for (the
//  switch off, an old build, a business with no plans). "From people who
//  came" is step 3.
//

import SwiftUI

struct BusinessUpcomingPlansSection: View {
    let businessId: String

    @State private var plans: [PlanCardDTO] = []
    @State private var showsAll = false

    var body: some View {
        // Always a (zero-height) view, so the read below runs while nothing is shown yet.
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: 0)
            if !plans.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    VStack(spacing: 0) {
                        ForEach(Array(shown.enumerated()), id: \.element.id) { index, card in
                            row(card, divider: index > 0)
                        }
                    }
                    .padding(.horizontal, 14)
                    .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
                    .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("businessPlans")
            }
        }
        .task(id: businessId) { await load() }
    }

    private var shown: [PlanCardDTO] {
        showsAll ? plans : Array(plans.prefix(3))
    }

    /// As the page's other section headers: the overline, and "See all 7" in the business color.
    private var header: some View {
        HStack {
            Text("UPCOMING PLANS")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityLabel("Upcoming plans")
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if plans.count > 3, !showsAll {
                Button("See all \(plans.count)") { showsAll = true }
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
                    .frame(minHeight: 32)
                    .accessibilityIdentifier("businessPlansSeeAll")
            }
        }
        .padding(.top, 18)
        .padding(.bottom, 8)
    }

    private func row(_ card: PlanCardDTO, divider: Bool) -> some View {
        Button { DeepLinkRouter.shared.handle(path: "/plans/\(card.id)") } label: {
            VStack(spacing: 0) {
                if divider { Divider().overlay(Theme.Color.appBorder) }
                HStack(spacing: Spacing.s3) {
                    PlanTile(kind: card.kind)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(card.title)
                            .planFont(.rowTitle)
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Text(Self.line(card))
                            .planFont(.footnote)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    PlanPriceChip()
                }
                .padding(.vertical, 11)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(card.title), \(Self.line(card)), Free")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("businessPlansRow.\(card.id)")
    }

    /// "Sat 10:00 AM · 3 spots left".
    static func line(_ card: PlanCardDTO) -> String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        let when = PlanFormat.rowWhen(state: card.state, start: card.startsAtDate, end: card.endsAtDate, calendar: calendar)
        let spots = card.isFull ? "Full" : "\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s") left"
        return [when, spots].compactMap { $0 }.joined(separator: " · ")
    }

    private func load() async {
        let reply: BusinessPlansResponse? = try? await APIClient.shared.request(BusinessesEndpoints.plans(businessId: businessId))
        plans = reply?.items ?? []
    }
}
