//
//  CollectiveEventSetupSheet.swift
//  Pantopus
//
//  G2 Collective Event Setup (Stream I13) — bottom sheet on the Business violet
//  pillar. Matches `collective-frames.jsx` (off / on / saving). CTA sky. Tokens
//  only.
//

import SwiftUI

struct CollectiveEventSetupSheet: View {
    @State private var model: CollectiveEventSetupViewModel
    let onClose: () -> Void

    init(owner: SchedulingOwner, eventTypeId: String, client: SchedulingClient = .shared, onClose: @escaping () -> Void) {
        _model = State(wrappedValue: CollectiveEventSetupViewModel(owner: owner, eventTypeId: eventTypeId, client: client))
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizSheetHeader(title: "Collective booking", subhead: "Every required member must be free at the same time.", onClose: onClose)
            content
            if case .ready = model.phase {
                BizSheetFooter {
                    BizPrimaryButton(
                        title: model.isSaving ? "Saving" : "Save",
                        isSaving: model.isSaving
                    ) { Task { if await model.save() { onClose() } } }
                }
            }
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task { await model.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading: loadingBody
        case .ready: readyBody
        case let .error(message): errorBody(message)
        }
    }

    private var readyBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                masterToggle
                if model.requireMultiple {
                    countCard(
                        label: "Required staff",
                        sub: "How many must be free",
                        value: model.requiredStaff,
                        onDec: { model.decrementRequired() },
                        onInc: { model.incrementRequired() }
                    )
                    tiles
                    // Frame 3: no-overlap warning between Tiles and Members
                    // (collective-frames.jsx:133). Rendered when checked members
                    // share no free windows. Save remains enabled per design.
                    if model.noOverlap {
                        BizNote(
                            tone: .warning,
                            icon: .alertTriangle,
                            text: "Selected members have no shared openings. Widen their hours or adjust the member selection."
                        )
                    }
                    membersSection
                    countCard(
                        label: "Seats per appointment",
                        sub: "Capacity for each slot",
                        value: model.seatsPerAppointment,
                        onDec: { model.decrementSeats() },
                        onInc: { model.incrementSeats() }
                    )
                    // Design `Note icon="git-merge"` — two availability streams
                    // converging (SF `arrow.triangle.merge`).
                    BizNote(
                        tone: .info,
                        icon: .gitMerge,
                        text: "Times come from where every required member is free. Fewer common openings means fewer slots."
                    )
                } else {
                    BizNote(tone: .info, icon: .info, text: "Turn on if a booking needs more than one person.")
                }
                if let saveError = model.saveError {
                    BizNote(tone: .error, icon: .alertTriangle, text: saveError)
                }
                Color.clear.frame(height: Spacing.s2)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    // swiftlint:disable:next inclusive_language
    private var masterToggle: some View {
        BizCard(padding: EdgeInsets(top: Spacing.s3, leading: 13, bottom: Spacing.s3, trailing: 13)) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(model.requireMultiple ? Theme.Color.businessBg : Theme.Color.appSurfaceSunken)
                    Icon(.usersRound, size: 17, color: model.requireMultiple ? Theme.Color.business : Theme.Color.appTextSecondary)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Require multiple staff").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    Text("Several members must be free at once.").font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Toggle("", isOn: Binding(get: { model.requireMultiple }, set: { model.setRequireMultiple($0) }))
                    .labelsHidden().tint(Theme.Color.business)
            }
        }
    }

    private func countCard(label: String, sub: String, value: Int, onDec: @escaping () -> Void, onInc: @escaping () -> Void) -> some View {
        BizCard(padding: EdgeInsets(top: 11, leading: 13, bottom: 11, trailing: 13)) {
            HStack(spacing: 11) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Text(sub).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                BizStepper(value: value, accent: Theme.Color.business, onDecrement: onDec, onIncrement: onInc)
            }
        }
    }

    private var tiles: some View {
        HStack(spacing: Spacing.s2) {
            tile(.specific, label: "Specific members", icon: .userCheck)
            tile(.anyN, label: "Any N of a group", icon: .users)
        }
    }

    private func tile(_ mode: CollectiveEventSetupViewModel.SelectionMode, label: String, icon: PantopusIcon) -> some View {
        let on = model.selectionMode == mode
        return Button { model.selectMode(mode) } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Icon(icon, size: 17, color: on ? Theme.Color.business : Theme.Color.appTextSecondary)
                    Spacer()
                    if on { Icon(.check, size: 14, strokeWidth: 3, color: Theme.Color.business) }
                }
                Text(label)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(on ? Theme.Color.businessBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(on ? Theme.Color.business : Theme.Color.appBorder, lineWidth: on ? 1.5 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
    }

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BizOverline(text: "Members")
            BizCard {
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(model.picks.enumerated()), id: \.element.id) { idx, pick in
                        seatRow(pick)
                        if idx < model.picks.count - 1 { BizRowDivider() }
                    }
                }
            }
        }
    }

    private func seatRow(_ pick: CollectiveEventSetupViewModel.Pick) -> some View {
        HStack(spacing: 11) {
            Button { model.toggle(pick.id) } label: { BizCheckbox(on: pick.checked) }
                .buttonStyle(.plain)
            BizAvatar(name: pick.name, tintKey: pick.id, imageURL: pick.avatarURL, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(pick.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText).lineLimit(1)
                Text(pick.role ?? "Uses personal availability")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.vertical, Spacing.s3)
        .opacity(pick.checked ? 1 : 0.55)
    }

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 64, cornerRadius: Radii.xl)
                Shimmer(height: 56, cornerRadius: Radii.xl)
                BizCard {
                    VStack(spacing: Spacing.s0) {
                        ForEach(0..<3, id: \.self) { idx in
                            BizShimmerRow(showCheckbox: true)
                            if idx < 2 { BizRowDivider() }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            Button { Task { await model.load() } } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
    }
}
