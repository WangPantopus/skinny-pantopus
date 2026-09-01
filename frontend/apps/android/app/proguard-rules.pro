# Pantopus Android — ProGuard / R8 rules
# https://developer.android.com/build/shrink-code

# ─── DTOs ──────────────────────────────────────────────────────────
# Moshi reflects on the constructor + properties at runtime.
-keep class app.pantopus.android.data.api.models.** { *; }
# Generated Moshi adapters live alongside the DTOs as
# `<DtoName>JsonAdapter`. Keep the JsonAdapter classes the codegen
# emits — they are the runtime entry point for serialisation.
-keep class app.pantopus.android.**.*JsonAdapter { *; }

# ─── Moshi ─────────────────────────────────────────────────────────
-keepattributes Signature,RuntimeVisibleAnnotations,AnnotationDefault,InnerClasses
-keep @com.squareup.moshi.JsonClass class *
-keep class * extends com.squareup.moshi.JsonAdapter { *; }
-keepclassmembers class * { @com.squareup.moshi.* <methods>; }
-keepclassmembers class * { @com.squareup.moshi.* <fields>; }
-dontwarn com.squareup.moshi.**

# ─── Retrofit ──────────────────────────────────────────────────────
-keepattributes Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking interface retrofit2.http.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn retrofit2.Platform$Java8

# ─── OkHttp / Okio ─────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**

# ─── Hilt / Dagger ────────────────────────────────────────────────
# Generated factories + Hilt entry points must not be obfuscated; the
# runtime looks them up by name.
-keep class dagger.hilt.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager.FragmentContextWrapper { *; }
-keep class javax.inject.** { *; }
-keep class hilt_aggregated_deps.** { *; }
-keep,allowobfuscation @interface dagger.hilt.android.lifecycle.HiltViewModel
-keep class * extends androidx.lifecycle.ViewModel { *; }

# ─── Kotlin reflection ────────────────────────────────────────────
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata { public <methods>; }
-dontwarn kotlin.reflect.**

# ─── Coroutines ───────────────────────────────────────────────────
-keepclassmembernames class kotlinx.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.debug.**
-dontwarn kotlinx.coroutines.flow.**

# ─── Socket.IO client (Netty + JSON) ──────────────────────────────
-keep class io.socket.** { *; }
-dontwarn io.socket.**
-keep class com.github.nkzawa.** { *; }
-dontwarn org.json.**

# ─── Stripe ───────────────────────────────────────────────────────
-keep class com.stripe.android.** { *; }
-keep class com.stripe.android.model.** { *; }
-dontwarn com.stripe.android.**
# Stripe ships its own consumer-rules.pro inside the AAR — these are
# the catch-alls for any reflection paths Stripe falls back to.
-keepnames class com.stripe.** { *; }

# ─── Sentry ───────────────────────────────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ─── Compose ──────────────────────────────────────────────────────
# Compose has its own consumer rules, but we keep our @Composable
# previews so debug-time tooling continues to find them.
-keep,allowobfuscation @interface androidx.compose.runtime.Stable
-keep,allowobfuscation @interface androidx.compose.runtime.Immutable
