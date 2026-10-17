package com.moneymanager.notification.dedupe

import com.moneymanager.notification.parsers.ParsedUpiTransaction
import android.content.Context
import android.content.SharedPreferences
import java.util.concurrent.ConcurrentHashMap

/**
 * Deduplication engine for UPI transactions.
 * Uses multiple signals to deterministically identify duplicate notifications.
 */
class DedupeEngine private constructor(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("moneymanager_dedupe", Context.MODE_PRIVATE)
    private val recentKeys: ConcurrentHashMap<String, Long> = ConcurrentHashMap()
    private val maxCacheSize = 1000
    private val keyTtlMs = 24 * 60 * 60 * 1000 // 24 hours

    companion object {
        @Volatile
        private var INSTANCE: DedupeEngine? = null

        fun getInstance(context: Context): DedupeEngine {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: DedupeEngine(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    init {
        loadPersistedKeys()
        cleanupExpiredKeys()
    }

    /**
     * Generates a deterministic deduplication key from a parsed transaction.
     * Uses multiple signals in order of reliability.
     *
     * A UPI transaction reference is unique per payment. When one is present
     * it is the primary identity signal and the time window must NOT
     * participate: the same payment re-notified minutes or hours later is
     * still the same payment and must not create a second event.
     *
     * Without a reference the key falls back to a composite of source app,
     * amount, merchant and a one-minute time window.
     */
    fun generateKey(parsed: ParsedUpiTransaction): String {
        parsed.transactionReference?.let { ref ->
            return listOf(
                "ref:$ref",
                "app:${parsed.sourceApp}",
                "amt:${parsed.amountPaise}",
                "dir:${parsed.direction}"
            ).joinToString("|")
        }

        val parts = mutableListOf<String>()

        // 1. Source app
        parts.add("app:${parsed.sourceApp}")

        // 2. Amount in paise and direction
        parts.add("amt:${parsed.amountPaise}")
        parts.add("dir:${parsed.direction}")

        // 3. Merchant (normalized)
        parsed.merchant?.let { parts.add("merch:${normalizeMerchant(it)}") }

        // 4. Timestamp window (rounded to nearest minute)
        val timeWindow = parsed.transactionTimestamp / (60 * 1000)
        parts.add("time:$timeWindow")

        return parts.joinToString("|")
    }

    /**
     * Checks if a transaction with this key has been seen recently.
     */
    fun isDuplicate(key: String): Boolean {
        val existing = recentKeys[key]
        if (existing != null) {
            val age = System.currentTimeMillis() - existing
            if (age < keyTtlMs) {
                return true
            } else {
                // Expired, remove it
                recentKeys.remove(key)
                prefs.edit().remove(key).apply()
            }
        }
        return false
    }

    /**
     * Marks a key as seen.
     */
    fun markSeen(key: String) {
        val now = System.currentTimeMillis()
        recentKeys[key] = now
        prefs.edit().putLong(key, now).apply()
        enforceMaxSize()
    }

    /**
     * Updates an existing deduplication entry (for notification updates).
     */
    fun updateExisting(key: String, parsed: ParsedUpiTransaction) {
        // Update the timestamp for the existing key
        val now = System.currentTimeMillis()
        recentKeys[key] = now
        prefs.edit().putLong(key, now).apply()
    }

    /**
     * Gets deduplication info for a key (for debugging).
     */
    fun getDedupeInfo(key: String): DedupeInfo? {
        val timestamp = recentKeys[key] ?: prefs.getLong(key, -1)
        return if (timestamp > 0) {
            DedupeInfo(key, timestamp, System.currentTimeMillis() - timestamp)
        } else {
            null
        }
    }

    private fun normalizeMerchant(merchant: String): String {
        return merchant.lowercase()
            .replace(Regex("[^a-z0-9]"), "")
            .trim()
    }

    private fun loadPersistedKeys() {
        val all = prefs.all
        val now = System.currentTimeMillis()
        for ((key, value) in all) {
            if (value is Long) {
                val age = now - value
                if (age < keyTtlMs) {
                    recentKeys[key] = value
                } else {
                    prefs.edit().remove(key).apply()
                }
            }
        }
    }

    private fun cleanupExpiredKeys() {
        val now = System.currentTimeMillis()
        val toRemove = recentKeys.entries.filter { now - it.value >= keyTtlMs }.map { it.key }
        for (key in toRemove) {
            recentKeys.remove(key)
            prefs.edit().remove(key).apply()
        }
    }

    private fun enforceMaxSize() {
        if (recentKeys.size > maxCacheSize) {
            val oldest = recentKeys.entries.minByOrNull { it.value }
            oldest?.let { recentKeys.remove(it.key) }
        }
    }

    /**
     * Clears all deduplication data (for testing).
     */
    fun clear() {
        recentKeys.clear()
        prefs.edit().clear().apply()
    }
}

data class DedupeInfo(
    val key: String,
    val firstSeen: Long,
    val ageMs: Long
)