package com.moneymanager.notification.module

import android.content.Context
import com.moneymanager.notification.access.NotificationAccessManager
import com.moneymanager.notification.normalizer.NormalizedNotification
import com.moneymanager.notification.parsers.ParsedUpiTransaction
import com.moneymanager.notification.parsers.ParserRegistry
import com.moneymanager.notification.store.PendingEventStore
import com.moneymanager.notification.store.PendingUpiEvent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * Expo Module for Money Manager Notification Detection.
 * Bridges the native notification listener to React Native.
 */
class MoneyManagerNotificationDetectionModule : Module() {

    private val context: Context?
        get() = appContext.reactContext

    override fun definition() = ModuleDefinition {
        Name("MoneyManagerNotificationDetection")

        // Initialize with context
        AsyncFunction("initialize") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                // Initialize native components
                NotificationAccessManager.getInstance(ctx)
                PendingEventStore.getInstance(ctx)
                ParserRegistry.getInstance(ctx)
                promise.resolve(mapOf("success" to true))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Notification Access
        AsyncFunction("isNotificationAccessEnabled") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val enabled = NotificationAccessManager.isNotificationAccessEnabled(ctx)
                promise.resolve(mapOf("enabled" to enabled))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("openNotificationAccessSettings") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                NotificationAccessManager.openNotificationAccessSettings(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Pending Events
        AsyncFunction("getPendingUpiEvents") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                val events = store.getPendingEvents("PENDING")
                promise.resolve(mapOf("events" to events.map { eventToMap(it) }))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("getAllPendingUpiEvents") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                val events = store.getPendingEvents()
                promise.resolve(mapOf("events" to events.map { eventToMap(it) }))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("consumePendingUpiEvent") { id: String, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                PendingEventStore.getInstance(ctx).consumeEvent(id)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("dismissPendingUpiEvent") { id: String, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                PendingEventStore.getInstance(ctx).dismissEvent(id)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Developer/Diagnostic
        AsyncFunction("getParsingStats") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                promise.resolve(PendingEventStore.getInstance(ctx).getStats())
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Development only - simulate notification for testing
        AsyncFunction("simulateUpiNotification") { notificationMap: Map<String, Any?>, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val normalized = mapToNormalizedNotification(notificationMap)
                val registry = ParserRegistry.getInstance(ctx)
                val parsed = registry.tryParse(normalized)
                promise.resolve(parsed?.let { parsedTransactionToMap(it) })
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }
    }

    private fun eventToMap(event: PendingUpiEvent): Map<String, Any?> {
        return mapOf(
            "id" to event.id,
            "amountPaise" to event.amountPaise,
            "merchant" to event.merchant,
            "sourceApp" to event.sourceApp,
            "transactionTimestamp" to event.transactionTimestamp,
            "transactionReference" to event.transactionReference,
            "parserName" to event.parserName,
            "parserVersion" to event.parserVersion,
            "confidence" to event.confidence,
            "notificationId" to event.notificationId,
            "status" to event.status.name,
            "createdAt" to event.createdAt,
            "dedupeKey" to event.dedupeKey
        )
    }

    private fun parsedTransactionToMap(parsed: ParsedUpiTransaction): Map<String, Any?> {
        return mapOf(
            "amountPaise" to parsed.amountPaise,
            "merchant" to parsed.merchant,
            "sourceApp" to parsed.sourceApp,
            "transactionTimestamp" to parsed.transactionTimestamp,
            "transactionReference" to parsed.transactionReference,
            "parserName" to parsed.parserName,
            "parserVersion" to parsed.parserVersion,
            "confidence" to parsed.confidence
        )
    }

    private fun mapToNormalizedNotification(map: Map<String, Any?>): NormalizedNotification {
        return NormalizedNotification(
            notificationId = map["notificationId"] as? String ?: UUID.randomUUID().toString(),
            packageName = map["packageName"] as? String ?: "",
            title = map["title"] as? String,
            text = map["text"] as? String,
            bigText = map["bigText"] as? String,
            subText = map["subText"] as? String,
            postTime = (map["postTime"] as? Number)?.toLong() ?: System.currentTimeMillis(),
            whenTime = (map["when"] as? Number)?.toLong(),
            extras = null
        )
    }
}
