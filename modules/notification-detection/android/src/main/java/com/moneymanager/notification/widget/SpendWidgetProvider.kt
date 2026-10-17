package com.moneymanager.notification.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.moneymanager.notification.R
import com.moneymanager.notification.store.PendingEventStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home-screen widget: today's and this month's spend, payments waiting for
 * review, and a quick-add button. Totals are pushed from JS (the app owns
 * the ledger); the pending count is read from the native store so it stays
 * current while the app is closed.
 */
class SpendWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it) }
    }

    companion object {
        private const val PREFS = "moneymanager_widget"
        private const val SCHEME = "moneymanager"

        fun save(context: Context, today: String, month: String, dayKey: String, monthKey: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("today", today)
                .putString("month", month)
                .putString("dayKey", dayKey)
                .putString("monthKey", monthKey)
                .apply()
        }

        fun refreshAll(context: Context) {
            try {
                val manager = AppWidgetManager.getInstance(context) ?: return
                val ids = manager.getAppWidgetIds(ComponentName(context, SpendWidgetProvider::class.java))
                ids.forEach { render(context, manager, it) }
            } catch (e: Exception) {
                android.util.Log.w("SpendWidget", "refresh failed", e)
            }
        }

        fun installedCount(context: Context): Int {
            return try {
                AppWidgetManager.getInstance(context)
                    ?.getAppWidgetIds(ComponentName(context, SpendWidgetProvider::class.java))?.size ?: 0
            } catch (e: Exception) {
                0
            }
        }

        private fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val now = Date()
            val dayKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now)
            val monthKey = SimpleDateFormat("yyyy-MM", Locale.US).format(now)

            // Only confirmed expenses count as spending and confirming needs
            // the app, so a stale day or month really is zero until it opens.
            val today = if (prefs.getString("dayKey", null) == dayKey) prefs.getString("today", null) else null
            val month = if (prefs.getString("monthKey", null) == monthKey) prefs.getString("month", null) else null
            val monthLabel = SimpleDateFormat("MMMM", Locale.getDefault()).format(now)

            val pending = try {
                PendingEventStore.getInstance(context).countPending()
            } catch (e: Exception) {
                0
            }

            val views = RemoteViews(context.packageName, R.layout.mm_widget_spend)
            views.setTextViewText(R.id.mm_widget_today, today ?: "₹0")
            views.setTextViewText(R.id.mm_widget_month, "${month ?: "₹0"} in $monthLabel")
            if (pending > 0) {
                views.setViewVisibility(R.id.mm_widget_pending, View.VISIBLE)
                views.setTextViewText(
                    R.id.mm_widget_pending,
                    if (pending == 1) "1 payment to review" else "$pending payments to review"
                )
            } else {
                views.setViewVisibility(R.id.mm_widget_pending, View.GONE)
            }

            views.setOnClickPendingIntent(R.id.mm_widget_root, deepLink(context, "", 0))
            views.setOnClickPendingIntent(R.id.mm_widget_add, deepLink(context, "transactions/new", 1))
            views.setOnClickPendingIntent(R.id.mm_widget_pending, deepLink(context, "quick-capture", 2))
            manager.updateAppWidget(id, views)
        }

        private fun deepLink(context: Context, path: String, requestCode: Int): PendingIntent {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$SCHEME://$path")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
