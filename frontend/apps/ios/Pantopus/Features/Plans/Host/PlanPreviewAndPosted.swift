//
//  PlanPreviewAndPosted.swift
//  Pantopus
//
//  Board H7 "Preview": what neighbors see (area only), what people you
//  accept also see, and "Post plan". Board H8 "Posted": the new pin drops
//  onto the map (16 pt, 220 ms, a small bounce, then its area fades in, a
//  success haptic), with "Share link", "See your plan" and "Done".
//

import MapKit
import SwiftUI

struct PlanPreviewScreen: View {
    let model: PlanComposerModel
    let step: String
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Preview", leading: .back, trailing: step, onLeading: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text.planOverline("What neighbors see")
                    neighborsCard
                    Text.planOverline(model.kind == .playdate ? "Families you accept also see" : "People you accept also see")
                        .padding(.top, Spacing.s1)
                    PlanFormCard {
                        privateRow(
                            icon: model.whereKind == .home ? .home : .mapPin,
                            text: model.whereKind == .home ? "Your address" : "The exact spot: \(model.place?.name ?? "your place")"
                        )
                        if !model.guestNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Divider().overlay(Theme.Color.appBorder)
                            privateRow(
                                icon: .lock,
                                text: "Your note: \u{201C}\(model.guestNote.trimmingCharacters(in: .whitespacesAndNewlines))\u{201D}"
                            )
                        }
                        if model.kind == .playdate {
                            Divider().overlay(Theme.Color.appBorder)
                            privateRow(icon: .clock, text: "The exact time")
                        }
                        Divider().overlay(Theme.Color.appBorder)
                        privateRow(icon: .users, text: "Who's going, and the group chat")
                    }
                    Text(
                        "You can change or cancel it any time. If you move the time or the place, "
                            + "everyone who's in is asked \u{201C}Still coming?\u{201D}"
                    )
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    if let error = model.postError {
                        Text(error)
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.error)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("planPostError")
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s6)
            }
            Button { Task { _ = await model.post() } } label: {
                PlanButtonLabel(title: "Post plan", kind: .primary, isLoading: model.isPosting)
            }
            .planButton(.primary)
            .disabled(model.isPosting)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
            .accessibilityIdentifier("planPost")
        }
        .background(Theme.Color.appBg)
        .task { await model.loadPreviewArea() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPreview")
    }

    private var neighborsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            areaMap
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PlanTypeTag(kind: model.kind)
                Text(model.effectiveTitle).planFont(.h3).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
                Text(whenLine)
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: 10) {
                    PlanAvatar(name: model.hostName, size: 30)
                    Text(model.hostName).fontWeight(.semibold).planFont(.small).foregroundStyle(Theme.Color.appText)
                    // As neighbors will see it on the card (board H7).
                    if model.verifiedAddress { PlanVerifiedLabel(text: "Verified") }
                    Text("· \(model.spots) \(model.kind == .playdate ? "families" : "spots")")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appText)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 14)
            .padding(.bottom, Spacing.s4)
        }
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var areaMap: some View {
        if let point = model.placePoint {
            let center = CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude)
            Map(
                initialPosition: .region(MKCoordinateRegion(center: center, latitudinalMeters: 900, longitudinalMeters: 900)),
                interactionModes: []
            ) {
                // Neighbors see an area around the place, never the point.
                MapCircle(center: center, radius: model.kind == .playdate ? 500 : 250)
                    .foregroundStyle(model.kind.color.opacity(0.22))
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .frame(height: 120)
            .allowsHitTesting(false)
        }
    }

    /// "Sun, Oct 18 · 1:25–4:45 PM · Near Prune Hill"; a playdate shows its part of the day.
    private var whenLine: String {
        let when: String
        if model.kind == .playdate {
            let hour = Calendar.current.component(.hour, from: model.effectiveStart)
            let part: PlanDayPart = hour < 12 ? .morning : hour < 17 ? .afternoon : hour < 21 ? .evening : .night
            when = PlanFormat.dayPartPhrase(part, day: model.effectiveStart)
        } else {
            when = PlanFormat.when(start: model.effectiveStart, end: model.end)
        }
        return [when, model.previewArea].compactMap { $0 }.joined(separator: " · ")
    }

    private func privateRow(icon: PantopusIcon, text: String) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon, size: 18, color: Theme.Color.appTextSecondary)
            Text(text)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
        .frame(minHeight: 52)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - H8

struct PlanPostedScreen: View {
    let plan: PlanDetailDTO
    let onSeePlan: () -> Void
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dropped = false
    @State private var areaShown = false
    @State private var landed = 0

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                map
                sheet
                    .frame(height: max(geo.size.height * 0.53, 420))
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .sensoryFeedback(.success, trigger: landed)
        .onAppear(perform: drop)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPosted")
    }

    private var point: CLLocationCoordinate2D {
        if let place = plan.place { return CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude) }
        return CLLocationCoordinate2D(latitude: plan.card.area.latitude, longitude: plan.card.area.longitude)
    }

    private var map: some View {
        Map(
            initialPosition: .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: point.latitude - 0.006, longitude: point.longitude),
                latitudinalMeters: 2600,
                longitudinalMeters: 2600
            )),
            interactionModes: []
        ) {
            MapCircle(center: point, radius: plan.card.kind == .playdate ? 500 : 250)
                .foregroundStyle(plan.card.kind.color.opacity(areaShown ? 0.2 : 0))
            Annotation("", coordinate: point, anchor: .center) {
                PlanPinView(look: PlanPinLook(
                    kind: plan.card.kind,
                    tag: "Your plan · " + PlanFormat.pinTag(
                        state: plan.card.state,
                        isFull: false,
                        startsAt: plan.card.startsAtDate,
                        dayPart: plan.card.dayPart
                    ),
                    isSelected: true,
                    badge: .hosting
                ))
                .offset(y: dropped ? 0 : -16)
                .opacity(dropped ? 1 : 0)
            }
            .annotationTitles(.hidden)
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .accessibilityElement()
        .accessibilityLabel("Your plan's pin on the map")
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Capsule().fill(Theme.Color.appBorderStrong).frame(width: 36, height: 5).frame(maxWidth: .infinity).padding(.top, Spacing.s2)
            VStack(alignment: .leading, spacing: 6) {
                Text("Your plan is on the map")
                    .planFont(.h2)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Neighbors near you can see it now. We'll tell you when someone asks to join.")
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            PlanCardBox(padding: Spacing.s4) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: Spacing.s3) {
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .fill(Theme.Color.primary100)
                            .frame(width: 44, height: 44)
                            .overlay(Icon(.link, size: 22, color: Theme.Color.primary700))
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Invite friends").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                            Text(plan.card.placeKind == .home
                                ? "They see the plan's card, never your address."
                                : "They see the plan's card and its area.")
                                .planFont(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    if let url = plan.card.shareUrl.flatMap(URL.init(string:)) {
                        ShareLink(item: url, message: Text(plan.card.title)) {
                            PlanButtonLabel(title: "Share link", icon: .share, kind: .secondary)
                        }
                        .planButton(.secondary, size: .small)
                        .accessibilityIdentifier("planPostedShare")
                    }
                }
            }
            Button("See your plan", action: onSeePlan)
                .planButton(.primary)
                .accessibilityIdentifier("planPostedSee")
            Button("Done", action: onDone)
                .planButton(.text, size: .extraSmall)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("planPostedDone")
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s6)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: Radii.xl3, topTrailingRadius: Radii.xl3, style: .continuous)
                .fill(Theme.Color.appSurface)
                .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: -6)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    /// Board P3 "Post a plan": the pin drops 16 pt in 220 ms with a small
    /// bounce, then its area fades in; a crossfade under Reduce Motion.
    private func drop() {
        if reduceMotion {
            withAnimation(.easeInOut(duration: 0.15)) {
                dropped = true
                areaShown = true
            }
            landed += 1
            return
        }
        withAnimation(.spring(response: 0.22, dampingFraction: 0.6)) { dropped = true }
        withAnimation(.easeOut(duration: 0.2).delay(0.22)) { areaShown = true }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(220))
            landed += 1
        }
    }
}
