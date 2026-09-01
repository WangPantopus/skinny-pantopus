//
//  Spacing.swift
//  Pantopus
//
//  Canonical spacing ramp, in points. Feature code MUST use these names —
//  never raw point values like `.padding(12)`.
//

import CoreGraphics

/// Canonical spacing ramp. Values mirror the design_system px scale (1:1 pt).
public enum Spacing {
    /// 0 pt.
    public static let s0: CGFloat = 0
    /// 4 pt.
    public static let s1: CGFloat = 4
    /// 8 pt.
    public static let s2: CGFloat = 8
    /// 12 pt.
    public static let s3: CGFloat = 12
    /// 16 pt.
    public static let s4: CGFloat = 16
    /// 20 pt.
    public static let s5: CGFloat = 20
    /// 24 pt.
    public static let s6: CGFloat = 24
    /// 32 pt.
    public static let s8: CGFloat = 32
    /// 40 pt.
    public static let s10: CGFloat = 40
    /// 48 pt.
    public static let s12: CGFloat = 48
    /// 64 pt.
    public static let s16: CGFloat = 64
}
