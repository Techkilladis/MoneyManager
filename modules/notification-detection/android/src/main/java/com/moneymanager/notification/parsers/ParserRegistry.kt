package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import com.moneymanager.notification.registry.UpiAppRegistry
import android.content.Context

/**
 * Picks the parser for a notification's package (app-specific first, then
 * the generic fallback). The generic parser reports the source app from
 * [UpiAppRegistry] when the package is a known UPI app.
 */
class ParserRegistry private constructor(context: Context) {

    private val parsers: List<AppUpiParser> = AppUpiParser.defaults()
    private val appRegistry = UpiAppRegistry.getInstance(context)

    companion object {
        @Volatile
        private var INSTANCE: ParserRegistry? = null

        fun getInstance(context: Context): ParserRegistry {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ParserRegistry(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        for (parser in parsers) {
            if (!parser.accepts(notification.packageName)) continue
            try {
                val result = parser.tryParse(notification) ?: continue
                android.util.Log.d("ParserRegistry", "Parsed by ${parser.name} (${result.direction}) confidence ${result.confidence}")
                if (result.sourceApp == "OTHER_UPI") {
                    val known = appRegistry.getSourceApp(notification.packageName)
                    if (known != null) return result.copy(sourceApp = known)
                }
                return result
            } catch (e: Exception) {
                android.util.Log.e("ParserRegistry", "Parser ${parser.name} failed", e)
            }
        }
        return null
    }

    fun getParserNames(): List<String> = parsers.map { it.name }
}
