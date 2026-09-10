@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.checkout

import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk

/** Coherent synchronous and asynchronous identity seam for existing screen flow tests. */
fun gigIdentityFixture(identity: () -> Pair<String, String?>? = { "u1" to "test-session" }): GigPaymentIdentitySource =
    mockk {
        every { scopeMarker() } answers { identity().toString() }
        coEvery { permitsAnonymousRead() } answers { identity() == null }
        coEvery { checkoutIdentity() } answers {
            identity()?.let { GigCheckoutIdentity(it.first, it.second, "https://api.example.invalid/") }
        }
    }
