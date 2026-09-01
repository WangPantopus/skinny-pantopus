//
//  Radii.swift
//  Pantopus
//
//  Canonical corner-radius ramp, in points.
//

import CoreGraphics

/// Canonical corner-radius ramp. Values mirror the design_system px scale (1:1 pt).
public enum Radii {
    /// 4 pt.
    public static let xs: CGFloat = 4
    /// 6 pt.
    public static let sm: CGFloat = 6
    /// 8 pt.
    public static let md: CGFloat = 8
    /// 12 pt.
    public static let lg: CGFloat = 12
    /// 16 pt.
    public static let xl: CGFloat = 16
    /// 20 pt.
    public static let xl2: CGFloat = 20
    /// 24 pt.
    public static let xl3: CGFloat = 24
    /// Effectively-round pill corners.
    public static let pill: CGFloat = 9999
}
