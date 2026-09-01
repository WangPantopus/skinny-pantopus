//
//  InviteeIntakeFormView.swift
//  Pantopus
//
//  D1 Intake / Booking details form (Stream I6). Full-screen public intake built
//  to the Calendarly design: a non-editable booking summary header with a slot-
//  hold countdown, a "Your info" section (or a "Booking as" chip when signed in),
//  the host's schema-driven questions, a collapsible Add-guests row, and a
//  sticky-bottom "Review booking" CTA. Renders loading / ready / unavailable /
//  error / slot-expired, wrapped in the offline banner. Tapping Review hands the
//  draft to D2.
//

// swiftlint:disable file_length
import SwiftUI

// swiftlint:disable:next type_body_length
struct InviteeIntakeFormView: View {
    @State private var viewModel: InviteeIntakeFormViewModel
    @State private var showTimezoneSheet = false
    @Environment(\.dismiss) private var dismiss

    init(viewModel: InviteeIntakeFormViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Your details")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .onAppear {
                // D2's "Pick another time" unwind (slot taken): keep popping so
                // the booker lands back on the C6 picker, which consumes the
                // relay entry and shows the taken-slot treatment.
                if viewModel.shouldUnwindForSlotTaken { dismiss() }
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.inviteeIntakeForm")
            .sheet(isPresented: $showTimezoneSheet) {
                TimezoneSelectorSheet(
                    selectedIdentifier: viewModel.selectedTz,
                    accent: viewModel.accent,
                    onSelect: { viewModel.changeTimezone($0) },
                    onDone: { showTimezoneSheet = false }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingScroll
        case .ready:
            formScroll
        case let .unavailable(title, message):
            unavailableScroll(title: title, message: message)
        case let .error(message):
            errorState(message)
        }
    }

    // MARK: - Form

    private var formScroll: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                if viewModel.holdExpired { expiredBanner }
                VStack(spacing: Spacing.s3) {
                    summaryHeader
                    if !viewModel.holdExpired { holdRow }
                    if viewModel.isPrefilled { bookingAsChip } else { yourInfoSection }
                    questionsSection
                    addGuestsSection
                }
                .opacity(viewModel.holdExpired ? 0.5 : 1)
                .disabled(viewModel.holdExpired)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)
        }
        .safeAreaInset(edge: .bottom) { footer }
    }

    private var footer: some View {
        ConfirmFooter {
            ConfirmPrimaryButton(
                label: viewModel.holdExpired ? "Pick another time" : "Review booking",
                icon: viewModel.holdExpired ? .calendarSearch : nil,
                accent: viewModel.accent,
                isDisabled: !viewModel.holdExpired && !viewModel.isValid
            ) {
                if viewModel.holdExpired { dismiss() } else { viewModel.reviewBooking() }
            }
            .accessibilityIdentifier("scheduling.inviteeIntakeForm.cta")
        }
    }

    // MARK: - Summary header

    private var summaryHeader: some View {
        ConfirmCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    HostAvatarBadge(initials: viewModel.hostInitials, colors: viewModel.avatarColors, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(viewModel.eventType?.name ?? "Booking")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(viewModel.eventType?.durationLine(host: viewModel.hostName) ?? "")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    Button { dismiss() } label: {
                        Text("Edit")
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(viewModel.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Edit time")
                }
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                HStack(spacing: Spacing.s2) {
                    Icon(.calendar, size: 15, color: Theme.Color.appTextSecondary)
                    Text(viewModel.dayAndTimeLine)
                        .font(.system(size: 12.5, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                }
                tzChangeChip
            }
        }
    }

    private var tzChangeChip: some View {
        Button { showTimezoneSheet = true } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.globe, size: 12, strokeWidth: 2.2, color: Theme.Color.primary700)
                Text(viewModel.tzChipLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                Text("Change")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(viewModel.accent)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 5)
            .background(Theme.Color.primary100)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Change timezone, currently \(viewModel.tzChipLabel)")
    }

    private var holdRow: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.clock, size: 13, color: Theme.Color.appTextSecondary)
            Text("We're holding this time for ")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                + Text(viewModel.holdLabel)
                .font(.system(size: 11, weight: .bold).monospacedDigit())
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Your info

    private var yourInfoSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ConfirmOverline("Your info")
            HStack(alignment: .top, spacing: Spacing.s2) {
                IntakeField(
                    label: "First name",
                    required: true,
                    value: bind(\.firstName, touch: "firstName"),
                    placeholder: "Maya",
                    showValid: showValid(for: "firstName", value: viewModel.firstName, error: viewModel.firstNameError),
                    error: viewModel.firstNameError,
                    textContentType: .givenName
                )
                IntakeField(
                    label: "Last name",
                    required: true,
                    value: bind(\.lastName, touch: "lastName"),
                    placeholder: "Chen",
                    showValid: showValid(for: "lastName", value: viewModel.lastName, error: viewModel.lastNameError),
                    error: viewModel.lastNameError,
                    textContentType: .familyName
                )
            }
            IntakeField(
                label: "Email",
                required: true,
                value: bind(\.email, touch: "email"),
                placeholder: "you@email.com",
                helper: "We'll only email you about this booking.",
                showValid: showValid(for: "email", value: viewModel.email, error: viewModel.emailError),
                error: viewModel.emailError,
                keyboard: .emailAddress,
                textContentType: .emailAddress
            )
            // Frame 4: when the host app detects the typed email belongs to a
            // Pantopus account, show a nudge to open in-app for prefill.
            if viewModel.existingAccountDetected {
                existingAccountBanner
            }
        }
    }

    /// Info banner shown in Frame 4 (existing account detected, unauthenticated path).
    /// Design: info-blue tinted surface, `info` icon top-aligned, text + "Open in app"
    /// tappable link — rendered as a styled inline banner without a sheet.
    private var existingAccountBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 15, strokeWidth: 2.1, color: Theme.Color.info)
                .padding(.top, 1)
            (
                Text("You have an account. ")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.primary900)
                    + Text("Open in app")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(viewModel.accent)
                    + Text(" to use your saved details.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.primary900)
            )
            .lineSpacing(2)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("scheduling.inviteeIntakeForm.existingAccountBanner")
    }

    private var bookingAsChip: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ConfirmOverline("Your info")
            HStack(spacing: Spacing.s3) {
                HostAvatarBadge(
                    initials: ConfirmFormat.initials(from: "\(viewModel.firstName) \(viewModel.lastName)"),
                    colors: [Theme.Color.business.opacity(0.85), Theme.Color.business],
                    size: 34
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text("Booking as \(viewModel.firstName) \(viewModel.lastName)".trimmingCharacters(in: .whitespaces))
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(viewModel.email)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Button { viewModel.clearPrefill() } label: {
                    Text("Not you?")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(viewModel.accent)
                }
                .buttonStyle(.plain)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    )
            )
        }
    }

    // MARK: - Host questions

    @ViewBuilder
    private var questionsSection: some View {
        if !viewModel.questions.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ConfirmOverline("A few questions")
                ForEach(viewModel.questions) { question in
                    questionField(question)
                }
            }
        }
    }

    @ViewBuilder
    private func questionField(_ question: EventTypeQuestionDTO) -> some View {
        let key = viewModel.questionKey(question)
        let error = viewModel.questionError(question)
        switch (question.fieldType ?? "text").lowercased() {
        case "textarea":
            IntakeTextArea(
                label: question.label,
                required: question.required ?? false,
                value: answerBinding(key),
                placeholder: viewModel.coverPlaceholder,
                error: error
            )
        case "select":
            IntakeSelect(
                label: question.label,
                required: question.required ?? false,
                options: question.options ?? [],
                selected: viewModel.isChoiceSelectedFirst(key),
                error: error
            ) { viewModel.selectSingleChoice(key, option: $0) }
        case "multiselect":
            // swiftlint:disable trailing_closure
            IntakeMultiSelect(
                label: question.label,
                required: question.required ?? false,
                options: question.options ?? [],
                isSelected: { viewModel.isChoiceSelected(key, option: $0) },
                error: error,
                accent: viewModel.accent,
                onToggle: { viewModel.toggleChoice(key, option: $0) }
            )
        // swiftlint:enable trailing_closure
        case "checkbox":
            IntakeCheckbox(
                label: question.label,
                isOn: flagBinding(key),
                accent: viewModel.accent,
                error: error
            )
        case "phone":
            IntakeField(
                label: question.label,
                required: question.required ?? false,
                value: answerBinding(key),
                placeholder: "(555) 000-0000",
                leading: "+1",
                helper: error == nil ? "For a text reminder before the call." : nil,
                showValid: showValid(for: key, value: viewModel.textAnswer(key), error: error),
                error: error,
                keyboard: .phonePad,
                textContentType: .telephoneNumber
            )
        default:
            IntakeField(
                label: question.label,
                required: question.required ?? false,
                value: answerBinding(key),
                placeholder: "Type your answer",
                showValid: showValid(for: key, value: viewModel.textAnswer(key), error: error),
                error: error
            )
        }
    }

    // MARK: - Add guests

    @ViewBuilder
    private var addGuestsSection: some View {
        if viewModel.showGuests {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s1) {
                    Icon(.users, size: 14, color: Theme.Color.appTextSecondary)
                    Text("Guests")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                // Value-stable row identity: an offset id re-points surviving
                // rows' live TextFields at different guests after a removal.
                ForEach(viewModel.guests) { guest in
                    HStack(spacing: Spacing.s2) {
                        IntakeField(
                            label: "",
                            value: guestBinding(guest.id),
                            placeholder: "guest@email.com",
                            keyboard: .emailAddress,
                            textContentType: .emailAddress
                        )
                        Button { viewModel.removeGuest(id: guest.id) } label: {
                            Icon(.x, size: 15, color: Theme.Color.appTextSecondary)
                                .frame(width: 32, height: 32)
                                .background(Theme.Color.appSurface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove guest")
                    }
                }
                HStack {
                    Button { viewModel.addGuest() } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(.plus, size: 13, strokeWidth: 2.4, color: viewModel.accent)
                            Text("Add another")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(viewModel.accent)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.guests.count >= 5)
                    Spacer()
                    Text("\(viewModel.guests.count) of 5")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        } else {
            Button { viewModel.addGuest() } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(.userPlus, size: 15, strokeWidth: 2.2, color: viewModel.accent)
                        .frame(width: 28, height: 28)
                        .background(viewModel.accentBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Add guests")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("Add up to 5 guests.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    Icon(.plus, size: 17, color: viewModel.accent)
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Banners / calm states

    private var expiredBanner: some View {
        ConfirmBanner(
            tone: .warning,
            icon: .clockAlert,
            title: "This held time just expired",
            message: "Someone else can book it now. Pick another time to keep going."
        )
    }

    private func unavailableScroll(title: String, message: String) -> some View {
        ScrollView {
            DiscoveryNotice(icon: .pause, title: title, message: message)
                .padding(.horizontal, 13)
                .padding(.top, Spacing.s5)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .link,
                headline: message,
                subcopy: "It may have been turned off or moved.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var loadingScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 120, cornerRadius: Radii.xl)
                Shimmer(width: 200, height: 12)
                ForEach(0..<3, id: \.self) { _ in Shimmer(height: 44, cornerRadius: Radii.md) }
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityLabel("Loading booking form")
    }

    // MARK: - Binding helpers

    private func bind(_ keyPath: ReferenceWritableKeyPath<InviteeIntakeFormViewModel, String>, touch: String) -> Binding<String> {
        Binding(
            get: { viewModel[keyPath: keyPath] },
            set: { viewModel[keyPath: keyPath] = $0
                viewModel.markTouched(touch)
            }
        )
    }

    private func answerBinding(_ key: String) -> Binding<String> {
        Binding(get: { viewModel.textAnswer(key) }, set: { viewModel.setText(key, $0) })
    }

    private func flagBinding(_ key: String) -> Binding<Bool> {
        Binding(get: { viewModel.flagAnswer(key) }, set: { viewModel.setFlag(key, $0) })
    }

    private func guestBinding(_ id: InviteeIntakeFormViewModel.GuestEntry.ID) -> Binding<String> {
        Binding(
            get: { viewModel.guestEmail(id: id) },
            set: { viewModel.setGuest(id: id, email: $0) }
        )
    }

    private func showValid(for key: String, value: String, error: String?) -> Bool {
        viewModel.touchedContains(key) && error == nil && !value.trimmingCharacters(in: .whitespaces).isEmpty
    }
}

// MARK: - Input atoms (mirror Form.html)

private struct IntakeField: View {
    let label: String
    var required = false
    @Binding var value: String
    var placeholder = ""
    var leading: String?
    var helper: String?
    var showValid = false
    var error: String?
    var keyboard: UIKeyboardType = .default
    var textContentType: UITextContentType?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            if !label.isEmpty { FieldLabelText(label: label, required: required) }
            HStack(spacing: Spacing.s1) {
                if let leading {
                    Text(leading)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                TextField(placeholder, text: $value)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .keyboardType(keyboard)
                    .textContentType(textContentType)
                    .autocorrectionDisabled(keyboard == .emailAddress)
                    .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)
                if showValid {
                    Icon(.checkCircle, size: 17, color: Theme.Color.success)
                } else if error != nil {
                    Icon(.alertCircle, size: 17, color: Theme.Color.error)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: borderWidth)
            )
            FieldFootnote(error: error, helper: helper)
        }
    }

    private var borderColor: Color {
        if error != nil { return Theme.Color.error }
        if showValid { return Theme.Color.success }
        return Theme.Color.appBorder
    }

    private var borderWidth: CGFloat {
        (error != nil || showValid) ? 1.5 : 1
    }
}

private struct IntakeTextArea: View {
    let label: String
    var required = false
    @Binding var value: String
    var placeholder = "A sentence or two helps."
    var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            FieldLabelText(label: label, required: required)
            TextField(placeholder, text: $value, axis: .vertical)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(3...6)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .frame(minHeight: 78, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(
                            error != nil ? Theme.Color.error : Theme.Color.appBorder,
                            lineWidth: error != nil ? 1.5 : 1
                        )
                )
            FieldFootnote(error: error, helper: nil)
        }
    }
}

private struct IntakeSelect: View {
    let label: String
    var required = false
    let options: [String]
    let selected: String?
    var error: String?
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            FieldLabelText(label: label, required: required)
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) { onSelect(option) }
                }
            } label: {
                HStack(spacing: Spacing.s1) {
                    Text(selected ?? "Select one")
                        .font(.system(size: 13.5))
                        .foregroundStyle(selected == nil ? Theme.Color.appTextMuted : Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronDown, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(
                            error != nil ? Theme.Color.error : Theme.Color.appBorder,
                            lineWidth: error != nil ? 1.5 : 1
                        )
                )
            }
            FieldFootnote(error: error, helper: nil)
        }
    }
}

private struct IntakeMultiSelect: View {
    let label: String
    var required = false
    let options: [String]
    let isSelected: (String) -> Bool
    var error: String?
    let accent: Color
    let onToggle: (String) -> Void

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: Spacing.s2)]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            FieldLabelText(label: label, required: required)
            LazyVGrid(columns: columns, alignment: .leading, spacing: Spacing.s2) {
                ForEach(options, id: \.self) { option in
                    let on = isSelected(option)
                    Button { onToggle(option) } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(on ? .checkCircle : .circle, size: 15, color: on ? accent : Theme.Color.appTextMuted)
                            Text(option)
                                .font(.system(size: 12.5, weight: on ? .semibold : .regular))
                                .foregroundStyle(Theme.Color.appText)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, Spacing.s2)
                        .frame(height: 38)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(on ? accent.opacity(0.08) : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .strokeBorder(on ? accent : Theme.Color.appBorder, lineWidth: on ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            FieldFootnote(error: error, helper: nil)
        }
    }
}

private struct IntakeCheckbox: View {
    let label: String
    @Binding var isOn: Bool
    let accent: Color
    var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Button { isOn.toggle() } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(isOn ? .checkCircle : .circle, size: 18, color: isOn ? accent : Theme.Color.appTextMuted)
                    Text(label)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: Spacing.s0)
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(
                            error != nil ? Theme.Color.error : Theme.Color.appBorder,
                            lineWidth: error != nil ? 1.5 : 1
                        )
                )
            }
            .buttonStyle(.plain)
            FieldFootnote(error: error, helper: nil)
        }
    }
}

private struct FieldLabelText: View {
    let label: String
    var required = false

    var body: some View {
        HStack(spacing: 2) {
            Text(label)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*").font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.Color.error)
            }
        }
    }
}

private struct FieldFootnote: View {
    var error: String?
    var helper: String?

    var body: some View {
        if let error {
            HStack(spacing: Spacing.s1) {
                Icon(.alertCircle, size: 11, strokeWidth: 2.3, color: Theme.Color.error)
                Text(error).font(.system(size: 11)).foregroundStyle(Theme.Color.error)
            }
        } else if let helper {
            Text(helper)
                .font(.system(size: 11).italic())
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

#if DEBUG
#Preview("Empty") {
    NavigationStack { InviteeIntakeFormView(viewModel: .previewReady()) }
}

#Preview("Prefilled") {
    NavigationStack { InviteeIntakeFormView(viewModel: .previewReady(prefilled: true)) }
}
#endif
