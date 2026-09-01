// swiftlint:disable file_length
//
//  FindATimeSetupView.swift
//  Pantopus
//
//  Stream I11 — F4 Find a Time · Setup. A FormShell sheet with a pinned info
//  explainer, a who's-needed list (required/optional per member), a collective
//  vs round-robin mode choice, a duration and a date window. Next composes the
//  required members' personal availability via `POST /find-a-time`.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct FindATimeSetupView: View {
    @State private var viewModel: FindATimeSetupViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: FindATimeSetupViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var isReady: Bool {
        if case .ready = viewModel.phase { return true }
        return false
    }

    private static let steps: [(icon: PantopusIcon, text: String)] = [
        (.userCheck, "Each member sets their own free/busy hours in Personal."),
        (.layers, "Pantopus overlays everyone you pick and keeps only the shared free time."),
        (.lock, "No one's calendar is edited. Booking a slot adds one new event.")
    ]

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Find a time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isReady ? .hidden : .visible, for: .navigationBar)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.findATimeSetup")
            .sheet(isPresented: $viewModel.showDateSheet) { dateSheet }
            .alert("Couldn't check times", isPresented: computeErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.computeError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load your home", message: message) {
                await viewModel.load()
            }
        case .ready:
            FormShell(
                title: "Find a time",
                leading: .close,
                rightActionLabel: "Next",
                isValid: viewModel.isValid,
                isDirty: true,
                isSaving: viewModel.isComputing,
                onClose: { dismiss() },
                onCommit: { Task { await viewModel.next() } },
                content: {
                    if viewModel.isComputing {
                        computingBody
                    } else {
                        formBody
                    }
                }
            )
        }
    }

    // MARK: - Form body

    @ViewBuilder
    private var formBody: some View {
        explainer
        if let message = viewModel.noOverlapMessage {
            noOverlapBanner(message)
        }
        titleCard
        whosNeededSection
        howItWorksSection
        if viewModel.mode == .roundRobin {
            ruleSection
        }
        durationSection
        dateWindowSection
    }

    // MARK: Explainer

    private var explainer: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 15, color: Theme.Color.info)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(
                    "Times come from each member's personal availability. Pantopus finds the overlap — it never changes anyone's calendar."
                )
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                if viewModel.explainerExpanded {
                    Divider().background(Theme.Color.infoLight)
                    ForEach(Self.steps, id: \.text) { step in
                        HStack(alignment: .top, spacing: Spacing.s2) {
                            Icon(step.icon, size: 13, color: Theme.Color.info)
                            Text(step.text)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextStrong)
                        }
                    }
                }
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { viewModel.explainerExpanded.toggle() }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Text(viewModel.explainerExpanded ? "Hide" : "How this works")
                        Icon(viewModel.explainerExpanded ? .chevronUp : .chevronDown, size: 12, color: Theme.Color.info)
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.info)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.infoLight, lineWidth: 1)
        }
    }

    private func noOverlapBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 15, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text("No time works for all \(viewModel.requiredMemberIds.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warningLight, lineWidth: 1)
        }
    }

    // MARK: Title + category

    private var titleCard: some View {
        FindATimeCard {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Title")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                TextField("Plan a family call", text: $viewModel.title)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .textInputAutocapitalization(.sentences)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.appSurface)
                    .overlay {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1.5)
                    }
                    .accessibilityIdentifier("scheduling.findATimeSetup.title")
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Category")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                HStack(spacing: Spacing.s1) {
                    Circle().fill(Theme.Color.business).frame(width: 8, height: 8)
                    Text("Family")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.homeDark)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.homeBg)
                .clipShape(Capsule())
            }
        }
    }

    // MARK: Who's needed

    private var whosNeededSection: some View {
        FindATimeCard {
            FindATimeOverline(text: "Who's needed")
            ForEach(Array(viewModel.rows.enumerated()), id: \.element.id) { index, row in
                whoRow(row)
                if index < viewModel.rows.count - 1 {
                    Divider().background(Theme.Color.appBorderSubtle)
                }
            }
            if !viewModel.hasRequiredMember {
                FindATimeInlineError(message: "Mark at least one member as required")
            }
            if viewModel.noOverlapMessage != nil, let name = viewModel.requiredMembers.first?.displayName {
                Button { viewModel.makeFirstRequiredOptional() } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.userMinus, size: 14, color: Theme.Color.homeDark)
                        Text("Make \(name) optional")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.homeDark)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(Theme.Color.homeBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func whoRow(_ row: FindATimePickRow) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack(alignment: .bottomTrailing) {
                MemberAvatarBadge(member: row.member, size: 32)
                if row.requirement == .required {
                    Circle()
                        .fill(Theme.Color.home)
                        .frame(width: 15, height: 15)
                        .overlay { Icon(.check, size: 8, strokeWidth: 4, color: Theme.Color.appTextInverse) }
                        .overlay { Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2) }
                        .offset(x: 3, y: 2)
                }
            }
            Text(row.member.displayName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s2)
            requirementToggle(row)
        }
        .padding(.vertical, Spacing.s1)
    }

    private func requirementToggle(_ row: FindATimePickRow) -> some View {
        // Design tints the whole Req/Opt track error when nothing is required
        // (the invalid frame: every row's control turns errorBg + errorLight border).
        let invalid = !viewModel.hasRequiredMember
        return HStack(spacing: 3) {
            requirementSegment(
                title: "Required",
                isOn: row.requirement == .required,
                onColor: Theme.Color.home,
                onText: Theme.Color.appTextInverse
            ) { viewModel.setRequirement(.required, for: row.id) }
            requirementSegment(
                title: "Optional",
                isOn: row.requirement == .optional,
                onColor: Theme.Color.appSurface,
                onText: Theme.Color.appTextStrong
            ) { viewModel.setRequirement(.optional, for: row.id) }
        }
        .padding(3)
        .background(invalid ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            if invalid {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
            }
        }
    }

    private func requirementSegment(
        title: String,
        isOn: Bool,
        onColor: Color,
        onText: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11, weight: isOn ? .bold : .semibold))
                .foregroundStyle(isOn ? onText : Theme.Color.appTextMuted)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 5)
                .background(isOn ? onColor : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: How it works (mode tiles)

    private var howItWorksSection: some View {
        FindATimeCard {
            FindATimeOverline(text: "How it works")
            HStack(spacing: Spacing.s2) {
                modeTile(.collective, icon: .users)
                modeTile(.roundRobin, icon: .arrowsRepeat)
            }
            Text(viewModel.mode.explainer)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func modeTile(_ tileMode: FindATimeMode, icon: PantopusIcon) -> some View {
        let isOn = viewModel.mode == tileMode
        return Button { viewModel.selectMode(tileMode) } label: {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack {
                    Icon(icon, size: 18, color: isOn ? Theme.Color.home : Theme.Color.appTextSecondary)
                    Spacer()
                    if isOn { Icon(.checkCircle, size: 18, color: Theme.Color.home) }
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(tileMode.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(isOn ? Theme.Color.homeDark : Theme.Color.appText)
                    Text(tileMode.caption)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isOn ? Theme.Color.homeBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(isOn ? Theme.Color.home : Theme.Color.appBorder, lineWidth: 1.5)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.findATimeSetup.mode.\(tileMode.rawValue)")
    }

    private var ruleSection: some View {
        FindATimeCard {
            FindATimeOverline(text: "Round-robin rule")
            FindATimeSegmented(
                options: [RoundRobinRule.fairRotation.title, RoundRobinRule.byRole.title],
                selectedIndex: viewModel.roundRobinRule == .fairRotation ? 0 : 1
            ) { index in
                viewModel.roundRobinRule = index == 0 ? .fairRotation : .byRole
            }
        }
    }

    // MARK: Duration

    private var durationSection: some View {
        FindATimeCard {
            FindATimeOverline(text: "Duration")
            FindATimeSegmented(
                options: ["30 min", "1 hr", "Custom"],
                selectedIndex: durationIndex
            ) { index in
                viewModel.selectDuration([.thirty, .hour, .custom][index])
            }
            if viewModel.durationMode == .custom {
                HStack {
                    Text("Length")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    stepper
                }
            }
        }
    }

    private var durationIndex: Int {
        switch viewModel.durationMode {
        case .thirty: 0
        case .hour: 1
        case .custom: 2
        }
    }

    private var stepper: some View {
        HStack(spacing: 0) {
            Button { viewModel.customMinutes = max(5, viewModel.customMinutes - 15) } label: {
                Icon(.minus, size: 14, color: Theme.Color.appTextStrong)
                    .frame(width: 30, height: 32)
            }
            .buttonStyle(.plain)
            Text("\(viewModel.customMinutes) min")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .frame(minWidth: 56)
            Button { viewModel.customMinutes = min(480, viewModel.customMinutes + 15) } label: {
                Icon(.plus, size: 14, color: Theme.Color.home)
                    .frame(width: 30, height: 32)
            }
            .buttonStyle(.plain)
        }
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1.5)
        }
    }

    // MARK: Date window

    private var dateWindowSection: some View {
        FindATimeCard {
            FindATimeOverline(text: "Date window")
            Button { viewModel.showDateSheet = true } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.calendarRange, size: 16, color: viewModel.dateRangeValid ? Theme.Color.home : Theme.Color.error)
                    Text(viewModel.dateRangeLabel)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(viewModel.dateRangeValid ? Theme.Color.appText : Theme.Color.error)
                    Spacer()
                    Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .background(viewModel.dateRangeValid ? Theme.Color.appSurface : Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(viewModel.dateRangeValid ? Theme.Color.appBorder : Theme.Color.error, lineWidth: 1.5)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.findATimeSetup.dateWindow")
            if !viewModel.dateRangeValid {
                FindATimeInlineError(message: "End date is before the start date")
            }
            if viewModel.noOverlapMessage != nil {
                Button { viewModel.widenWindow() } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.calendarPlus, size: 14, color: Theme.Color.appTextStrong)
                        Text("Widen to two weeks")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var dateSheet: some View {
        NavigationStack {
            Form {
                DatePicker("From", selection: $viewModel.fromDate, displayedComponents: .date)
                DatePicker("To", selection: $viewModel.toDate, displayedComponents: .date)
            }
            .navigationTitle("Date window")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { viewModel.showDateSheet = false }
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: Computing

    private var computingBody: some View {
        VStack(spacing: Spacing.s5) {
            ZStack {
                Circle()
                    .stroke(Theme.Color.homeBg, lineWidth: 3)
                    .frame(width: 64, height: 64)
                Circle()
                    .trim(from: 0, to: 0.25)
                    .stroke(Theme.Color.home, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 64, height: 64)
                    .rotationEffect(.degrees(spin ? 360 : 0))
                    .animation(.linear(duration: 0.9).repeatForever(autoreverses: false), value: spin)
                Icon(.users, size: 24, color: Theme.Color.home)
            }
            VStack(spacing: Spacing.s1) {
                Text("Checking everyone's availability")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Composing \(viewModel.composingNames)'s free time")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(spacing: Spacing.s2) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: Spacing.s2) {
                        Shimmer(width: 30, height: 30, cornerRadius: Radii.pill)
                        Shimmer(width: 120, height: 11, cornerRadius: Radii.xs)
                        Spacer()
                        Shimmer(width: 42, height: 16, cornerRadius: Radii.md)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s10)
        .onAppear { spin = true }
    }

    @State private var spin = false

    // MARK: Loading skeleton

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 56, cornerRadius: Radii.lg)
                ForEach(0..<2, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        Shimmer(width: 100, height: 11, cornerRadius: Radii.xs)
                        ForEach(0..<3, id: \.self) { _ in
                            Shimmer(height: 32, cornerRadius: Radii.sm)
                        }
                    }
                    .padding(Spacing.s4)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                }
            }
            .padding(Spacing.s4)
        }
    }

    private var computeErrorPresented: Binding<Bool> {
        Binding(
            get: { viewModel.computeError != nil },
            set: { if !$0 { viewModel.computeError = nil } }
        )
    }
}
