package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import kotlin.math.min

/**
 * Parses notifications from one UPI app (or any app, for the generic
 * fallback) using the shared [UpiMessageParser] engine.
 *
 * @param packages package names this parser accepts; empty = any package.
 */
class AppUpiParser(
    override val name: String,
    private val sourceApp: String,
    private val packages: Set<String>,
    private val brandWords: List<String> = emptyList(),
    private val baseConfidence: Double = 0.5,
    private val maxConfidence: Double = 1.0
) : UpiNotificationParser {
    override val version = UpiMessageParser.VERSION

    fun accepts(packageName: String): Boolean = packages.isEmpty() || packageName in packages

    override fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        if (!accepts(notification.packageName)) return null
        val result = UpiMessageParser.parse(
            notification.title,
            notification.text,
            notification.bigText,
            notification.subText
        ) ?: return null

        val lower = listOfNotNull(notification.title, notification.text, notification.bigText)
            .joinToString(" ")
            .lowercase()
        var confidence = baseConfidence + 0.2
        if (result.counterparty != null) confidence += 0.2
        if (lower.contains("upi")) confidence += 0.1
        if (brandWords.any { lower.contains(it) }) confidence += 0.1

        return ParsedUpiTransaction(
            amountPaise = result.amountPaise,
            merchant = result.counterparty,
            sourceApp = sourceApp,
            transactionTimestamp = notification.postTime,
            transactionReference = result.reference,
            parserName = name,
            parserVersion = version,
            confidence = min(confidence, maxConfidence),
            direction = result.direction.name
        )
    }

    companion object {
        fun defaults(): List<AppUpiParser> = listOf(
            AppUpiParser("GooglePayParser", "GOOGLE_PAY", setOf("com.google.android.apps.nbu.paisa.user"), listOf("google pay", "gpay")),
            AppUpiParser("PhonePeParser", "PHONEPE", setOf("com.phonepe.app"), listOf("phonepe")),
            AppUpiParser("PaytmParser", "PAYTM", setOf("net.one97.paytm"), listOf("paytm")),
            AppUpiParser("BhimParser", "BHIM", setOf("in.org.npci.upiapp"), listOf("bhim")),
            AppUpiParser("GenericUpiParser", "OTHER_UPI", emptySet(), baseConfidence = 0.3, maxConfidence = 0.8)
        )
    }
}
