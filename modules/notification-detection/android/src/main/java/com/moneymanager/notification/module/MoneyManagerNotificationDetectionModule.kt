package com.moneymanager.notification.module

import android.content.Context
import com.moneymanager.notification.health.BackgroundAccess
import com.moneymanager.notification.health.CaptureHealth
import com.moneymanager.notification.widget.SpendWidgetProvider
import com.moneymanager.notification.sms.CapturePopup
import com.moneymanager.notification.sms.SmsInbox
import com.moneymanager.notification.sms.SmsUpiParser
import com.moneymanager.notification.store.PendingEventStore
import com.moneymanager.notification.store.PendingUpiEvent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Expo Module for Money Manager Notification Detection.
 * Bridges SMS-based UPI capture (live receiver + inbox scan) to React Native.
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
                PendingEventStore.getInstance(ctx)
                promise.resolve(mapOf("success" to true))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // SMS access (runtime permission is requested from JS)
        AsyncFunction("isSmsAccessEnabled") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                promise.resolve(mapOf("enabled" to SmsInbox.hasPermission(ctx)))
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Reads recent bank SMS from the inbox and stores any UPI payments found.
        AsyncFunction("scanSmsInbox") { firstScanDays: Int, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                promise.resolve(SmsInbox.scan(ctx, firstScanDays))
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

        // One event by id, whatever its status (the pop-up's review screen).
        AsyncFunction("getPendingUpiEvent") { id: String, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val event = PendingEventStore.getInstance(ctx).getEventById(id)
                promise.resolve(mapOf("event" to event?.let { eventToMap(it) }))
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
                CapturePopup.cancel(ctx, id)
                SpendWidgetProvider.refreshAll(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("dismissPendingUpiEvent") { id: String, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                PendingEventStore.getInstance(ctx).dismissEvent(id)
                CapturePopup.cancel(ctx, id)
                SpendWidgetProvider.refreshAll(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Capture reliability
        AsyncFunction("getCaptureHealth") { promise: Promise ->
            val ctx = context
            if (ctx != null) {
                val health = CaptureHealth.snapshot(ctx).toMutableMap()
                health["accessEnabled"] = SmsInbox.hasPermission(ctx)
                health["widgetCount"] = SpendWidgetProvider.installedCount(ctx)
                health["popupEnabled"] = CapturePopup.canOpenDirectly(ctx)
                health["notificationsEnabled"] = CapturePopup.canNotify(ctx)
                health["batteryUnrestricted"] = BackgroundAccess.isBatteryUnrestricted(ctx)
                health["hasAutostartSetting"] = BackgroundAccess.hasAutostartSetting(ctx)
                health["isXiaomi"] = BackgroundAccess.isXiaomi()
                health["backgroundPopupAllowed"] = BackgroundAccess.isBackgroundPopupAllowed(ctx)
                promise.resolve(health)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("openAppDetailsSettings") { promise: Promise ->
            val ctx = appContext.currentActivity ?: context
            if (ctx != null) {
                CaptureHealth.openAppDetails(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // "Display over other apps", so a new payment can open the review screen by itself.
        AsyncFunction("openPopupSettings") { promise: Promise ->
            val ctx = appContext.currentActivity ?: context
            if (ctx != null) {
                CapturePopup.openOverlaySettings(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Keeping capture alive after the app is swiped away from Recents.
        AsyncFunction("openAutostartSettings") { promise: Promise ->
            val ctx = appContext.currentActivity ?: context
            if (ctx != null) {
                BackgroundAccess.openAutostartSettings(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("requestBatteryUnrestricted") { promise: Promise ->
            val ctx = appContext.currentActivity ?: context
            if (ctx != null) {
                BackgroundAccess.requestBatteryUnrestricted(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        AsyncFunction("openBackgroundPopupSettings") { promise: Promise ->
            val ctx = appContext.currentActivity ?: context
            if (ctx != null) {
                BackgroundAccess.openBackgroundPopupSettings(ctx)
                promise.resolve(null)
            } else {
                promise.reject("ERR_CONTEXT", "Context not available", null)
            }
        }

        // Home-screen widget
        AsyncFunction("updateWidget") { data: Map<String, Any?>, promise: Promise ->
            val ctx = context
            if (ctx != null) {
                SpendWidgetProvider.save(
                    ctx,
                    today = data["today"] as? String ?: "",
                    month = data["month"] as? String ?: "",
                    dayKey = data["dayKey"] as? String ?: "",
                    monthKey = data["monthKey"] as? String ?: ""
                )
                SpendWidgetProvider.refreshAll(ctx)
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

        // Parses a sample SMS without storing it (diagnostics / tests).
        AsyncFunction("simulateSms") { sender: String, body: String, promise: Promise ->
            val parsed = SmsUpiParser.parse(sender, body)
            promise.resolve(
                parsed?.let {
                    mapOf(
                        "amountPaise" to it.amountPaise,
                        "merchant" to it.counterparty,
                        "transactionReference" to it.reference,
                        "direction" to it.direction.name
                    )
                }
            )
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
            "dedupeKey" to event.dedupeKey,
            "direction" to event.direction
        )
    }
}
