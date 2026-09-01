//
//  AddHomeGeocodeConfirmationViews.swift
//  Pantopus
//

import Foundation
import SwiftUI

struct AddressConfirmationFields: View {
    let address: AddHomeAddressFields
    let isGeocodeResolved: Bool
    let mismatch: AddHomeZipMismatch?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ConfirmationField(
                label: "Street address",
                value: address.street,
                state: isGeocodeResolved ? .success : .default,
                identifier: "addHome_confirmStreet"
            )
            HStack(alignment: .top, spacing: Spacing.s2) {
                ConfirmationField(
                    label: "Apt / Unit",
                    value: address.unit,
                    optional: true,
                    identifier: "addHome_confirmUnit"
                )
                .frame(maxWidth: .infinity)
                ConfirmationField(
                    label: "City",
                    value: address.city,
                    identifier: "addHome_confirmCity"
                )
                .frame(maxWidth: .infinity)
            }
            HStack(alignment: .top, spacing: Spacing.s2) {
                ConfirmationField(
                    label: "State",
                    value: address.state,
                    identifier: "addHome_confirmState"
                )
                .frame(maxWidth: .infinity)
                ConfirmationField(
                    label: "ZIP",
                    value: address.zipCode,
                    state: zipState,
                    helperText: mismatch.map(zipFieldErrorText),
                    identifier: "addHome_confirmZip"
                )
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var zipState: ConfirmationField.State {
        if mismatch != nil { return .error }
        return isGeocodeResolved ? .success : .default
    }

    private func zipFieldErrorText(_ mismatch: AddHomeZipMismatch) -> String {
        let city = mismatch.city.isEmpty ? "this street" : mismatch.city
        return "ZIP doesn't match \(city) for this street."
    }
}

private struct ConfirmationField: View {
    enum State {
        case `default`
        case success
        case error
    }

    let label: String
    let value: String
    var optional = false
    var state: State = .default
    var helperText: String?
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s1) {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if optional {
                    Text("Optional")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            HStack(spacing: Spacing.s2) {
                Text(value)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                trailingIcon
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(containerColor)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .accessibilityIdentifier(identifier)

            if let helperText {
                Text(helperText)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
    }

    @ViewBuilder private var trailingIcon: some View {
        switch state {
        case .success:
            Icon(.check, size: 16, strokeWidth: 3, color: Theme.Color.success)
        case .error:
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
        case .default:
            EmptyView()
        }
    }

    private var containerColor: Color {
        state == .success ? Theme.Color.successBg : Theme.Color.appSurface
    }

    private var borderColor: Color {
        switch state {
        case .success: Theme.Color.success
        case .error: Theme.Color.error
        case .default: Theme.Color.appBorder
        }
    }

    private var a11yLabel: String {
        var parts = [label]
        if optional { parts.append("optional") }
        parts.append(value.isEmpty ? "blank" : value)
        if let helperText { parts.append("error: \(helperText)") }
        return parts.joined(separator: ", ")
    }
}

struct ZipMismatchBanner: View {
    let mismatch: AddHomeZipMismatch
    let onApply: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.warning)
                Icon(.alertTriangle, size: 14, strokeWidth: 2.5, color: Theme.Color.appTextInverse)
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("We couldn't pinpoint this address")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.warning)
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(action: onApply) {
                    HStack(spacing: Spacing.s2) {
                        Icon(.mapPin, size: 14, color: Theme.Color.warning)
                        Text(suggestion)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("Apply")
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.warning)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .frame(minHeight: 44)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.warning, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("addHome_zipApply")
                .accessibilityLabel("Apply ZIP correction to \(mismatch.correctedZip)")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warning.opacity(0.3), lineWidth: 1)
        )
        .accessibilityIdentifier("addHome_zipMismatchBanner")
    }

    private var message: String {
        let city = mismatch.city.isEmpty ? "this area" : mismatch.city
        return "ZIP \(mismatch.enteredZip) is in \(city), but \(mismatch.street) is in the \(mismatch.correctedZip) ZIP."
    }

    private var suggestion: String {
        "\(mismatch.street), \(mismatch.city) \(mismatch.state) \(mismatch.correctedZip)"
    }
}

struct GeocodeConfirmationBlock: View {
    let address: AddHomeGeocodedAddress

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            GeocodeMapStrip(address: address)
            AddressRecognizedRow(address: address)
        }
    }
}

private struct GeocodeMapStrip: View {
    let address: AddHomeGeocodedAddress

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
            GeometryReader { proxy in
                let width = proxy.size.width
                let height = proxy.size.height
                Path { path in
                    path.move(to: CGPoint(x: 0, y: height * 0.25))
                    path.addLine(to: CGPoint(x: width, y: height * 0.25))
                    path.move(to: CGPoint(x: 0, y: height * 0.64))
                    path.addLine(to: CGPoint(x: width, y: height * 0.64))
                    path.move(to: CGPoint(x: width * 0.25, y: 0))
                    path.addLine(to: CGPoint(x: width * 0.25, y: height))
                    path.move(to: CGPoint(x: width * 0.68, y: 0))
                    path.addLine(to: CGPoint(x: width * 0.68, y: height))
                }
                .stroke(Theme.Color.appSurface, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                Group {
                    RoundedRectangle(cornerRadius: Radii.xs)
                        .fill(Theme.Color.appBorderStrong.opacity(0.55))
                        .frame(width: width * 0.13, height: height * 0.25)
                        .position(x: width * 0.36, y: height * 0.45)
                    RoundedRectangle(cornerRadius: Radii.xs)
                        .fill(Theme.Color.appBorderStrong.opacity(0.55))
                        .frame(width: width * 0.19, height: height * 0.25)
                        .position(x: width * 0.53, y: height * 0.45)
                    RoundedRectangle(cornerRadius: Radii.xs)
                        .fill(Theme.Color.appBorderStrong.opacity(0.55))
                        .frame(width: width * 0.17, height: height * 0.22)
                        .position(x: width * 0.18, y: height * 0.82)
                    RoundedRectangle(cornerRadius: Radii.xs)
                        .fill(Theme.Color.appBorderStrong.opacity(0.55))
                        .frame(width: width * 0.16, height: height * 0.22)
                        .position(x: width * 0.78, y: height * 0.82)
                }
            }
            Circle()
                .fill(Theme.Color.primary600)
                .frame(width: 30, height: 30)
                .overlay(Icon(.mapPin, size: 16, strokeWidth: 2.5, color: Theme.Color.appTextInverse))
                .shadow(color: Theme.Color.appText.opacity(0.18), radius: 4, y: 2)
            if let coordinateLabel {
                Text(coordinateLabel)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s1)
                    .background(Theme.Color.appSurface.opacity(0.94))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(Spacing.s2)
            }
        }
        .frame(height: 88)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("addHome_geocodeMap")
        .accessibilityHidden(true)
    }

    private var coordinateLabel: String? {
        guard let latitude = address.latitude, let longitude = address.longitude else { return nil }
        return "\(Self.formatLatitude(latitude)), \(Self.formatLongitude(longitude))"
    }

    private static func formatLatitude(_ value: Double) -> String {
        String(format: "%.4f°%@", abs(value), value >= 0 ? "N" : "S")
    }

    private static func formatLongitude(_ value: Double) -> String {
        String(format: "%.4f°%@", abs(value), value >= 0 ? "E" : "W")
    }
}

private struct AddressRecognizedRow: View {
    let address: AddHomeGeocodedAddress

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
            .frame(width: 20, height: 20)
            (
                Text("Address recognized.")
                    .fontWeight(.bold)
                    + Text(" Looks like \(locationCopy).")
            )
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.success)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityIdentifier("addHome_addressRecognized")
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Address recognized. Looks like \(locationCopy).")
    }

    private var locationCopy: String {
        let base = [address.city, address.state].filter { !$0.isEmpty }.joined(separator: ", ")
        if address.isMultiUnit {
            return base.isEmpty ? "a multi-unit home" : "\(base) - multi-unit"
        }
        return base.isEmpty ? "a home" : base
    }
}
