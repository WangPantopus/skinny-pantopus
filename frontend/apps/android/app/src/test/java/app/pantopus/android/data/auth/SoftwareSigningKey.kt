package app.pantopus.android.data.auth

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * Plain-JVM P-256 [DeviceSigningKey] for unit tests (no Android Keystore).
 * Also exposes [verify] so tests can check the raw `r||s` signatures the
 * production key stores emit through [EcKeyCodec.derToRaw].
 */
class SoftwareSigningKey(
    val keyPair: KeyPair = newKeyPair(),
    override val keyBacking: String = "software",
) : DeviceSigningKey {
    override val jwk: Map<String, String> = EcKeyCodec.jwkFor(keyPair.public as ECPublicKey)
    override val thumbprint: String = EcKeyCodec.thumbprint(jwk)

    /** Every call is recorded so tests can assert what was signed. */
    val signedInputs = mutableListOf<ByteArray>()

    override fun sign(data: ByteArray): ByteArray {
        signedInputs += data
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private)
        signature.update(data)
        return EcKeyCodec.derToRaw(signature.sign())
    }

    fun verify(
        data: ByteArray,
        rawSignature: ByteArray,
    ): Boolean {
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initVerify(keyPair.public)
        signature.update(data)
        return signature.verify(EcKeyCodec.rawToDer(rawSignature))
    }

    companion object {
        fun newKeyPair(): KeyPair =
            KeyPairGenerator
                .getInstance("EC")
                .apply { initialize(ECGenParameterSpec("secp256r1")) }
                .generateKeyPair()
    }
}
