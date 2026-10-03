package com.moneymanager.notification.module

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.OnLifecycleEvent
import com.moneymanager.notification.access.NotificationAccessManager
import com.moneymanager.notification.normalizer.NormalizedNotification
import com.moneymanager.notification.parsers.ParsedUpiTransaction
import com.moneymanager.notification.parsers.ParserRegistry
import com.moneymanager.notification.store.PendingEventStore
import com.moneymanager.notification.store.PendingUpiEvent
import expo.modules.core.arguments.Arguments
import expo.modules.core.arguments.ArgumentsContainer
import expo.modules.core.arguments.ReadableArray
import expo.modules.core.arguments.ReadableMap
import expo.modules.core.modules.Module
import expo.modules.core.modules.ModuleDefinition
import expo.modules.core.modules.ModuleRegistry
import expo.modules.core.promises.Promise
import expo.modules.core.ModuleClass
import expo.modules.core.ModuleLifecycleDelegate
import expo.modules.core.ModuleRegistryConsumer

/**
 * Expo Module for Money Manager Notification Detection.
 * Bridges the native notification listener to React Native.
 */
@ModuleClass
class MoneyManagerNotificationDetectionModule : Module(), ModuleRegistryConsumer {

    private var moduleRegistry: ModuleRegistry? = null
    private var context: Context? = null

    override fun definition() = ModuleDefinition {
        name("MoneyManagerNotificationDetection")

        // Initialize with context
        asyncFunction("initialize") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                // Initialize native components
                _ = NotificationAccessManager.getInstance(ctx)
                _ = PendingEventStore.getInstance(ctx)
                _ = ParserRegistry.getInstance(ctx)
                promise.resolve(true)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        // Notification Access
        asyncFunction("isNotificationAccessEnabled") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val enabled = NotificationAccessManager.isNotificationAccessEnabled(ctx)
                promise.resolve(Arguments.of("enabled", enabled))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        asyncFunction("openNotificationAccessSettings") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                NotificationAccessManager.openNotificationAccessSettings(ctx)
                promise.resolve(true)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        // Pending Events
        asyncFunction("getPendingUpiEvents") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                val events = store.getPendingEvents("PENDING")
                val array = Arguments.createArray()
                for (event in events) {
                    array.pushMap(eventToMap(event))
                }
                promise.resolve(Arguments.of("events", array))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        asyncFunction("getAllPendingUpiEvents") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                val events = store.getPendingEvents()
                val array = Arguments.createArray()
                for (event in events) {
                    array.pushMap(eventToMap(event))
                }
                promise.resolve(Arguments.of("events", array))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        asyncFunction("consumePendingUpiEvent") { (id: String, promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                store.consumeEvent(id)
                promise.resolve(true)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        asyncFunction("dismissPendingUpiEvent") { (id: String, promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                store.dismissEvent(id)
                promise.resolve(true)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        // Developer/Diagnostic
        asyncFunction("getParsingStats") { (promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val store = PendingEventStore.getInstance(ctx)
                val stats = store.getStats()
                val map = Arguments.createMap()
                map.putInt("total", stats["total"] as? Long ?: 0L)
                
                val bySource = Arguments.createMap()
                (stats["bySource"] as? Map<String, Long>)?.forEach { (k, v) ->
                    bySource.putInt(k, v)
                }
                map.putMap("bySource", bySource)
                
                val byParser = Arguments.createMap()
                (stats["byParser"] as? Map<String, Long>)?.forEach { (k, v) ->
                    byParser.putInt(k, v)
                }
                map.putMap("byParser", byParser)
                
                val byStatus = Arguments.createMap()
                (stats["byStatus"] as? Map<String, Long>)?.forEach { (k, v) ->
                    byStatus.putInt(k, v)
                }
                map.putMap("byStatus", byStatus)
                
                promise.resolve(map)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }

        // Development only - simulate notification for testing
        asyncFunction("simulateUpiNotification") { (notificationMap: ReadableMap, promise: Promise) =>
            val ctx = moduleRegistry?.context ?: context
            if (ctx != null) {
                val normalized = mapToNormalizedNotification(notificationMap)
                val registry = ParserRegistry.getInstance(ctx)
                val parsed = registry.tryParse(normalized)
                if (parsed != null) {
                    promise.resolve(parsedTransactionToMap(parsed))
                } else {
                    promise.resolve(null)
                }
            } else {
                promise.reject("ERR_CONTEXT", "Context not available")
            }
        }
    }

    override fun setModuleRegistry(moduleRegistry: ModuleRegistry?) {
        this.moduleRegistry = moduleRegistry
        if (moduleRegistry != null) {
            this.context = moduleRegistry.context
        }
    }

    private fun eventToMap(event: PendingUpiEvent): ArgumentsContainer {
        val map = Arguments.createMap()
        map.putString("id", event.id)
        map.putInt("amountPaise", event.amountPaise)
        map.putString("merchant", event.merchant)
        map.putString("sourceApp", event.sourceApp)
        map.putInt("transactionTimestamp", event.transactionTimestamp)
        map.putString("transactionReference", event.transactionReference ?: "")
        map.putString("parserName", event.parserName)
        map.putString("parserVersion", event.parserVersion)
        map.putDouble("confidence", event.confidence)
        map.putString("notificationId", event.notificationId)
        map.putString("status", event.status.name)
        map.putInt("createdAt", event.createdAt)
        map.putString("dedupeKey", event.dedupeKey)
        return map
    }

    private fun parsedTransactionToMap(parsed: ParsedUpiTransaction): ArgumentsContainer {
        val map = Arguments.createMap()
        map.putInt("amountPaise", parsed.amountPaise)
        map.putString("merchant", parsed.merchant ?: "")
        map.putString("sourceApp", parsed.sourceApp)
        map.putInt("transactionTimestamp", parsed.transactionTimestamp)
        map.putString("transactionReference", parsed.transactionReference ?: "")
        map.putString("parserName", parsed.parserName)
        map.putString("parserVersion", parsed.parserVersion)
        map.putDouble("confidence", parsed.confidence)
        return map
    }

    private fun mapToNormalizedNotification(map: ReadableMap): NormalizedNotification {
        return NormalizedNotification(
            notificationId = map.getString("notificationId") ?: UUID.randomUUID().toString(),
            packageName = map.getString("packageName") ?: "",
            title = map.getString("title"),
            text = map.getString("text"),
            bigText = map.getString("bigText"),
            subText = map.getString("subText"),
            postTime = map.getLong("postTime") ?: System.currentTimeMillis(),
            when = map.getLong("when"),
            extras = Bundle()
        )
    }
}