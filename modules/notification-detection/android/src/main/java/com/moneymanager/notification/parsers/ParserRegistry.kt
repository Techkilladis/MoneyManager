package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import android.content.Context

/**
 * Registry for managing and selecting UPI notification parsers.
 * Tries parsers in order of specificity (specific app parsers first, generic last).
 */
class ParserRegistry private constructor(context: Context) {

    private val parsers: List<UpiNotificationParser> = listOf(
        GooglePayParser(),
        PhonePeParser(),
        PaytmParser(),
        BhimParser(),
        GenericUpiParser()
    )

    companion object {
        @Volatile
        private var INSTANCE: ParserRegistry? = null

        fun getInstance(context: Context): ParserRegistry {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ParserRegistry(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    /**
     * Tries all registered parsers in order until one succeeds.
     * Returns the first successful parse result, or null if none succeed.
     */
    fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        for (parser in parsers) {
            try {
                val result = parser.tryParse(notification)
                if (result != null) {
                    android.util.Log.d("ParserRegistry", "Parsed by ${parser.name} with confidence ${result.confidence}")
                    return result
                }
            } catch (e: Exception) {
                android.util.Log.e("ParserRegistry", "Parser ${parser.name} failed", e)
            }
        }
        return null
    }

    /**
     * Gets all registered parser names.
     */
    fun getParserNames(): List<String> {
        return parsers.map { it.name }
    }
}