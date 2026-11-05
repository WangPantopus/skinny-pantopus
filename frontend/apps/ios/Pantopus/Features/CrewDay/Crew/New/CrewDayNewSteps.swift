//
//  CrewDayNewSteps.swift
//  Pantopus
//
//  New Crew Day steps 1 and 2 (build kit 01-spec.md screen 14): the service
//  and what's included, then where and when (street, center, reach on a
//  small map, date, arrival window, homes, when booking closes).
//

import MapKit
import SwiftUI

struct CrewDayNewServiceStep: View {
    @Bindable var model: CrewDayNewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDaySectionTitle(text: "Service")
                PlanFlowLayout(spacing: Spacing.s2) {
                    ForEach(CrewDayService.allCases, id: \.self) { service in
                        CrewDayChoiceChip(title: service.label, isSelected: model.service == service) {
                            model.service = service
                        }
                        .accessibilityIdentifier("crewDayNewService_\(service.rawValue)")
                    }
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDaySectionTitle(text: "What's included")
                Text("Households see these with a check. Up to 6.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                ForEach(model.included.indices, id: \.self) { index in
                    HStack(spacing: Spacing.s2) {
                        CrewDayTextField(
                            label: "What the crew does, line \(index + 1)",
                            placeholder: "What the crew does",
                            text: includedLine(index),
                            limit: 120
                        )
                        .accessibilityIdentifier("crewDayNewIncluded_\(index)")
                        if model.included.count > 1 {
                            Button { model.included.remove(at: index) } label: {
                                Icon(.x, size: 16, color: Theme.Color.appTextSecondary).frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Remove this line")
                        }
                    }
                }
                if model.included.count < 6 {
                    Button("Add a line") { model.included.append("") }
                        .crewDayButton(.text, size: .extraSmall)
                        .accessibilityIdentifier("crewDayNewIncludedAdd")
                }
            }
            Toggle(isOn: $model.outsideOnly) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Outside only").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text("Households don't need to be home.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .tint(Theme.Color.home)
            .accessibilityIdentifier("crewDayNewOutsideOnly")
        }
    }
}

extension CrewDayNewServiceStep {
    /// One included line, safe while lines are removed.
    private func includedLine(_ index: Int) -> Binding<String> {
        Binding(
            get: { index < model.included.count ? model.included[index] : "" },
            set: { if index < model.included.count { model.included[index] = $0 } }
        )
    }
}

struct CrewDayNewWhereStep: View {
    @Bindable var model: CrewDayNewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDaySectionTitle(text: "Street or area")
                CrewDayTextField(label: "Street or area", placeholder: "Maple Lane", text: $model.streetLabel, limit: 80)
                    .accessibilityIdentifier("crewDayNewStreet")
                Text("Neighbors see this name, never the center.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDaySectionTitle(text: "Center of the area")
                CrewDayAddressField(
                    query: $model.centerQuery,
                    picked: model.center,
                    identifier: "crewDayNewCenter",
                    onPick: { model.useCenter($0) },
                    onEdit: { model.clearCenter() }
                )
                CrewDayLockLine(text: "Only you and Pantopus see the center.")
            }
            reach
            VStack(alignment: .leading, spacing: Spacing.s3) {
                CrewDaySectionTitle(text: "When")
                CrewDayDatePickerRow(
                    label: "Date",
                    selection: $model.serviceDate,
                    range: Date()...Date.distantFuture,
                    components: .date,
                    identifier: "crewDayNewDate"
                )
                CrewDayDatePickerRow(
                    label: "Arriving from",
                    selection: $model.windowStart,
                    components: .hourAndMinute,
                    identifier: "crewDayNewWindowStart"
                )
                CrewDayDatePickerRow(
                    label: "Until",
                    selection: $model.windowEnd,
                    components: .hourAndMinute,
                    identifier: "crewDayNewWindowEnd"
                )
                if model.windowEnd <= model.windowStart {
                    CrewDayErrorText(text: "The window has to end after it starts.")
                }
            }
            .planFont(.body)
            Stepper(value: $model.capacity, in: 1...60) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Homes you can take").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(CrewDayFormat.homes(model.capacity))
                        .planFont(.small)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .accessibilityIdentifier("crewDayNewCapacity")
            closes
        }
    }

    private var reach: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: "Reach")
            ForEach(CrewDayReach.allCases) { reach in
                CrewDayRadioRow(
                    title: reach.label,
                    detail: reach.detail,
                    isSelected: model.reach == reach
                ) { model.reach = reach }
                    .accessibilityIdentifier("crewDayNewReach_\(reach.rawValue)")
            }
            if let latitude = model.center?.latitude, let longitude = model.center?.longitude {
                let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
                Map(initialPosition: .region(MKCoordinateRegion(
                    center: center,
                    latitudinalMeters: Double(model.reach.rawValue) * 3,
                    longitudinalMeters: Double(model.reach.rawValue) * 3
                ))) {
                    MapCircle(center: center, radius: CLLocationDistance(model.reach.rawValue))
                        .foregroundStyle(Theme.Color.home.opacity(0.18))
                        .stroke(Theme.Color.home, lineWidth: 2)
                }
                .id(model.reach)
                .frame(height: 160)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .allowsHitTesting(false)
                .accessibilityLabel("Map of the area the Crew Day reaches")
            }
        }
    }

    private var closesLine: String {
        guard !model.closesEarly else { return "At the time you pick" }
        return "\(CrewDayFormat.dayAndTime(model.defaultClose, timezone: nil)) (48 hours before)"
    }

    private var closes: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Toggle(isOn: $model.closesEarly) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Booking closes").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(closesLine)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .tint(Theme.Color.home)
            .accessibilityIdentifier("crewDayNewClosesEarly")
            if model.closesEarly {
                CrewDayDatePickerRow(
                    label: "Closes",
                    selection: $model.bookingClosesAt,
                    range: Date()...max(Date(), model.windowStartsAt),
                    identifier: "crewDayNewCloses"
                )
            }
            if !model.closesInTime {
                CrewDayErrorText(text: "Booking has to stay open at least an hour and close before the crew arrives. Pick a later date.")
            }
        }
    }
}

/// A text field in the Plans form style, with a character limit.
struct CrewDayTextField: View {
    /// What VoiceOver calls the field (the placeholder is only an example).
    let label: String
    let placeholder: String
    @Binding var text: String
    var limit = 500
    var axis: Axis = .horizontal
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // At the accessibility text sizes a one-line field wraps what's typed instead of scrolling it out of sight.
        TextField(placeholder, text: $text, axis: typeSize.isAccessibilitySize ? .vertical : axis)
            .planFont(.body)
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .accessibilityLabel(label)
            .onChange(of: text) { _, value in
                // A one-line field stays one line when it wraps (Return would type a new line there).
                var kept = axis == .horizontal ? value.replacingOccurrences(of: "\n", with: " ") : value
                if kept.count > limit { kept = String(kept.prefix(limit)) }
                if kept != value { text = kept }
            }
    }
}

/// A date or time with its label beside the picker, or above it at the accessibility text sizes (where the
/// compact picker would leave the label one syllable per line).
struct CrewDayDatePickerRow: View {
    let label: String
    @Binding var selection: Date
    var range: ClosedRange<Date> = Date.distantPast...Date.distantFuture
    var components: DatePickerComponents = [.date, .hourAndMinute]
    let identifier: String
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(label).foregroundStyle(Theme.Color.appText).accessibilityHidden(true)
                picker.labelsHidden()
            }
        } else {
            picker
        }
    }

    private var picker: some View {
        DatePicker(label, selection: $selection, in: range, displayedComponents: components)
            .accessibilityIdentifier(identifier)
    }
}

/// A selectable chip (service, month).
struct CrewDayChoiceChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .planFont(.label)
                .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 40)
                .background(Capsule().fill(isSelected ? Theme.Color.home : Theme.Color.appSurfaceSunken))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A radio row with a title and an optional detail or trailing price.
struct CrewDayRadioRow: View {
    let title: String
    var detail: String?
    var trailing: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Circle()
                    .strokeBorder(isSelected ? Theme.Color.home : Theme.Color.appBorderStrong, lineWidth: isSelected ? 6 : 1.5)
                    .frame(width: 22, height: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    if let detail {
                        Text(detail)
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let trailing {
                    Text(trailing).planFont(.bodyStrong).monospacedDigit().foregroundStyle(Theme.Color.appText)
                }
            }
            .padding(Spacing.s3)
            .frame(minHeight: 52)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isSelected ? Theme.Color.home : Theme.Color.appBorder, lineWidth: isSelected ? 2 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
