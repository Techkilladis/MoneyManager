package com.moneymanager.notification.health

import android.annotation.SuppressLint
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.util.Log

/**
 * Settings that decide whether a bank SMS still reaches the app after it is
 * swiped away from Recents. Stock Android keeps delivering SMS to a killed
 * app, but many OEM builds (Xiaomi, Oppo/Realme/OnePlus, Vivo, Huawei/Honor…)
 * force-stop it instead unless the user allows Autostart, and Xiaomi also
 * blocks background pop-ups behind its own switch.
 */
object BackgroundAccess {
    private const val TAG = "MoneyManagerSms"

    // Xiaomi's AppOps code for "Display pop-up windows while running in the background".
    private const val OP_MIUI_BACKGROUND_START_ACTIVITY = 10021

    /** OEM Autostart screens, most common first. Package names are also listed in <queries>. */
    private val AUTOSTART_SCREENS = listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
        "com.oplus.safecenter" to "com.oplus.safecenter.permission.startup.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
        "com.asus.mobilemanager" to "com.asus.mobilemanager.autostart.AutoStartActivity"
    )

    private val MIUI_PERMISSION_EDITORS = listOf(
        "com.miui.permcenter.permissions.PermissionsEditorActivity",
        "com.miui.permcenter.permissions.AppPermissionsEditorActivity"
    )

    fun isXiaomi(): Boolean =
        Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true) ||
            Build.BRAND.lowercase().let { it == "redmi" || it == "poco" || it == "xiaomi" }

    /** True on phones that have an OEM Autostart switch. */
    fun hasAutostartSetting(context: Context): Boolean = autostartIntents().any { resolves(context, it) }

    fun openAutostartSettings(context: Context) {
        val intent = autostartIntents().firstOrNull { resolves(context, it) }
        if (intent == null || !start(context, intent)) CaptureHealth.openAppDetails(context)
    }

    fun isBatteryUnrestricted(context: Context): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    @SuppressLint("BatteryLife") // Sideloaded capture app: this is its core job.
    fun requestBatteryUnrestricted(context: Context) {
        val ask = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        if (!start(context, ask) && !start(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) {
            CaptureHealth.openAppDetails(context)
        }
    }

    /** Xiaomi only: null when the phone isn't Xiaomi or the state can't be read. */
    fun isBackgroundPopupAllowed(context: Context): Boolean? {
        if (!isXiaomi()) return null
        return try {
            val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val check = AppOpsManager::class.java.getMethod(
                "checkOpNoThrow", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java
            )
            check.invoke(ops, OP_MIUI_BACKGROUND_START_ACTIVITY, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Log.w(TAG, "Could not read the MIUI background pop-up state", e)
            null
        }
    }

    /** Xiaomi's "Other permissions" page, where background pop-ups are switched on. */
    fun openBackgroundPopupSettings(context: Context) {
        val opened = MIUI_PERMISSION_EDITORS.any { cls ->
            val intent = Intent("miui.intent.action.APP_PERM_EDITOR")
                .setClassName("com.miui.securitycenter", cls)
                .putExtra("extra_pkgname", context.packageName)
            resolves(context, intent) && start(context, intent)
        }
        if (!opened) CaptureHealth.openAppDetails(context)
    }

    private fun autostartIntents(): List<Intent> =
        AUTOSTART_SCREENS.map { (pkg, cls) -> Intent().setComponent(ComponentName(pkg, cls)) }

    private fun resolves(context: Context, intent: Intent): Boolean =
        context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) != null

    private fun start(context: Context, intent: Intent): Boolean =
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            Log.w(TAG, "Could not open ${intent.component ?: intent.action}", e)
            false
        }
}
