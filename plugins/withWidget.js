/**
 * plugins/withWidget.js
 *
 * Self-contained Expo config plugin — all native source files are written
 * inline so the plugin works even when plugins/android/ and plugins/ios/
 * are gitignored (as android/ and ios/ rules typically exclude them).
 *
 * Android — fully automated:
 *   • Writes Kotlin source files into the app package directory
 *   • Writes res/layout, res/xml, res/drawable resource files
 *   • Adds the AppWidgetProvider <receiver> to AndroidManifest.xml
 *   • Injects WidgetPackage into MainApplication.kt
 *
 * iOS — partially automated:
 *   • Adds com.apple.security.application-groups to the main app entitlements
 *   • Writes WidgetModule.m + WidgetModule.swift into the main iOS project dir
 *     and registers them in the Xcode project (PBXSourcesBuildPhase)
 *   • Creates the DailyGlowWidget extension directory with Swift source files,
 *     Info.plist, and entitlements, then adds the extension target to the
 *     Xcode project (requires xcode npm package bundled with @expo/config-plugins)
 */

const {
  withAndroidManifest,
  withEntitlementsPlist,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

// ─── helpers ────────────────────────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

// ─── Inline Android source content ──────────────────────────────────────────

function dailyGlowWidgetKt(packageId) {
  return `package ${packageId}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import ${packageId}.R

class DailyGlowWidget : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME    = "DailyGlowWidget"
        const val KEY_TEXT      = "quoteText"
        const val KEY_AUTHOR    = "quoteAuthor"
        const val KEY_ID        = "quoteId"
        const val KEY_STREAK    = "streak"
        const val KEY_QUOTES_JSON = "quotesJson"
        const val KEY_QUOTE_INDEX = "quoteIndex"
        const val KEY_FONT_SCALE  = "fontScale"
        const val ACTION_REFRESH  = "${packageId}.WIDGET_REFRESH"
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val quotesJson = prefs.getString(KEY_QUOTES_JSON, null)
            if (!quotesJson.isNullOrEmpty()) {
                try {
                    val arr = org.json.JSONArray(quotesJson)
                    if (arr.length() > 1) {
                        val idx = (prefs.getInt(KEY_QUOTE_INDEX, 0) + 1) % arr.length()
                        val q = arr.getJSONObject(idx)
                        prefs.edit()
                            .putString(KEY_TEXT,   q.optString("text", ""))
                            .putString(KEY_AUTHOR, q.optString("author", ""))
                            .putString(KEY_ID,     q.optString("id", ""))
                            .putInt(KEY_QUOTE_INDEX, idx)
                            .apply()
                    }
                } catch (_: Exception) { /* silent */ }
            }
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, DailyGlowWidget::class.java))
            for (id in ids) updateWidget(context, manager, id)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val prefs   = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val text    = prefs.getString(KEY_TEXT,   context.getString(R.string.widget_default_quote)) ?: ""
        val author  = prefs.getString(KEY_AUTHOR, "") ?: ""
        val quoteId = prefs.getString(KEY_ID,     "") ?: ""
        val streak  = prefs.getInt(KEY_STREAK, 0)

        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        views.setTextViewText(R.id.widget_quote, text)
        if (author.isNotEmpty()) {
            views.setTextViewText(R.id.widget_author, "\u2014 $author")
            views.setViewVisibility(R.id.widget_author, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_author, View.GONE)
        }
        if (streak > 0) {
            views.setTextViewText(R.id.widget_streak, "\uD83D\uDD25 $streak")
            views.setViewVisibility(R.id.widget_streak, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_streak, View.GONE)
        }

        // Tap → deep link to the specific quote in the app
        val deepLink = Uri.parse("com.jiwonjae.dailyglow://quote?id=\${Uri.encode(quoteId)}")
        val launchIntent = Intent(Intent.ACTION_VIEW, deepLink).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, appWidgetId, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        // Refresh button — cycles to next quote in the buffer
        val refreshIntent = Intent(context, DailyGlowWidget::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPi = PendingIntent.getBroadcast(
            context, appWidgetId + 1000, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPi)

        // Font size (user-configurable multiplier)
        val fontScale = prefs.getFloat(KEY_FONT_SCALE, 1.0f)
        views.setTextViewTextSize(R.id.widget_quote, TypedValue.COMPLEX_UNIT_SP, 14.0f * fontScale)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
`;
}

function widgetModuleKt(packageId) {
  return `package ${packageId}.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WidgetModule"

    @ReactMethod
    fun saveQuoteData(text: String, author: String, id: String, promise: Promise) {
        try {
            reactContext
                .getSharedPreferences(DailyGlowWidget.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(DailyGlowWidget.KEY_TEXT,   text)
                .putString(DailyGlowWidget.KEY_AUTHOR, author)
                .putString(DailyGlowWidget.KEY_ID,     id)
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveStreakData(streak: Int, promise: Promise) {
        try {
            reactContext
                .getSharedPreferences(DailyGlowWidget.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putInt(DailyGlowWidget.KEY_STREAK, streak)
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveQuotesData(jsonArray: String, promise: Promise) {
        try {
            reactContext
                .getSharedPreferences(DailyGlowWidget.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(DailyGlowWidget.KEY_QUOTES_JSON, jsonArray)
                .putInt(DailyGlowWidget.KEY_QUOTE_INDEX, 0)
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveFontSizeData(multiplier: Double, promise: Promise) {
        try {
            reactContext
                .getSharedPreferences(DailyGlowWidget.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putFloat(DailyGlowWidget.KEY_FONT_SCALE, multiplier.toFloat())
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateWidget(promise: Promise) {
        try {
            val prefs  = reactContext.getSharedPreferences(DailyGlowWidget.PREFS_NAME, Context.MODE_PRIVATE)
            val text   = prefs.getString(DailyGlowWidget.KEY_TEXT, "") ?: ""
            val author = prefs.getString(DailyGlowWidget.KEY_AUTHOR, "") ?: ""

            val manager = AppWidgetManager.getInstance(reactContext)
            val ids = manager.getAppWidgetIds(ComponentName(reactContext, DailyGlowWidget::class.java))
            for (id in ids) DailyGlowWidget().updateWidget(reactContext, manager, id)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
}
`;
}

function widgetPackageKt(packageId) {
  return `package ${packageId}.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;
}

const WIDGET_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:padding="16dp"
    android:background="@drawable/widget_background">

    <TextView
        android:id="@+id/widget_quote"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="@string/widget_default_quote"
        android:textSize="14sp"
        android:textColor="#FF4A2A"
        android:textStyle="italic"
        android:gravity="center"
        android:maxLines="5"
        android:ellipsize="end" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/widget_author"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:textSize="12sp"
            android:textColor="#99FF4A2A"
            android:gravity="start"
            android:visibility="gone" />

        <TextView
            android:id="@+id/widget_streak"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textSize="11sp"
            android:textColor="#CCFF4A2A"
            android:gravity="end"
            android:visibility="gone" />

        <ImageView
            android:id="@+id/widget_refresh"
            android:layout_width="28dp"
            android:layout_height="28dp"
            android:layout_marginStart="8dp"
            android:src="@drawable/ic_widget_refresh"
            android:alpha="0.55"
            android:padding="2dp"
            android:contentDescription="@null" />

    </LinearLayout>

</LinearLayout>
`;

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:targetCellWidth="3"
    android:targetCellHeight="2"
    android:updatePeriodMillis="3600000"
    android:initialLayout="@layout/widget_layout"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen|keyguard" />
`;

const WIDGET_BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFF8F0" />
    <corners android:radius="16dp" />
    <stroke android:width="1dp" android:color="#1AFF9F7E" />
</shape>
`;

const IC_WIDGET_REFRESH_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path
    android:fillColor="#FF4A2A"
    android:pathData="M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0 -7.99,3.58 -7.99,8s3.57,8 7.99,8c3.73,0 6.84,-2.55 7.73,-6h-2.08c-0.82,2.33 -3.04,4 -5.65,4 -3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4l-2.35,2.35z"/>
</vector>
`;

// ─── Android ─────────────────────────────────────────────────────────────────

function withAndroidWidget(config) {
  const packageId = config.android?.package ?? 'com.jiwonjae.dailyglow';
  const packagePath = packageId.replace(/\./g, '/');

  // 1. Add <receiver> to AndroidManifest
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.receiver = app.receiver ?? [];
    const alreadyAdded = app.receiver.some(
      (r) => r.$?.['android:name']?.includes('DailyGlowWidget'),
    );
    if (!alreadyAdded) {
      app.receiver.push({
        $: {
          'android:name': '.widget.DailyGlowWidget',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
              { $: { 'android:name': `${packageId}.WIDGET_REFRESH` } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/widget_info',
            },
          },
        ],
      });
    }
    return mod;
  });

  // 2. Write Kotlin source files + resource files inline
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const androidRoot = mod.modRequest.platformProjectRoot;

      // Kotlin source files — written inline (not copied) so they're always present
      const widgetPkgDir = path.join(
        androidRoot,
        'app/src/main/java',
        packagePath,
        'widget',
      );
      ensureDir(widgetPkgDir);
      fs.writeFileSync(path.join(widgetPkgDir, 'DailyGlowWidget.kt'), dailyGlowWidgetKt(packageId));
      fs.writeFileSync(path.join(widgetPkgDir, 'WidgetModule.kt'),    widgetModuleKt(packageId));
      fs.writeFileSync(path.join(widgetPkgDir, 'WidgetPackage.kt'),   widgetPackageKt(packageId));

      // Resource files — written inline
      const resBase = path.join(androidRoot, 'app/src/main/res');
      ensureDir(path.join(resBase, 'layout'));
      ensureDir(path.join(resBase, 'xml'));
      ensureDir(path.join(resBase, 'drawable'));
      fs.writeFileSync(path.join(resBase, 'layout/widget_layout.xml'),       WIDGET_LAYOUT_XML);
      fs.writeFileSync(path.join(resBase, 'xml/widget_info.xml'),            WIDGET_INFO_XML);
      fs.writeFileSync(path.join(resBase, 'drawable/widget_background.xml'), WIDGET_BACKGROUND_XML);
      fs.writeFileSync(path.join(resBase, 'drawable/ic_widget_refresh.xml'), IC_WIDGET_REFRESH_XML);

      // String resources
      const stringsPath = path.join(resBase, 'values/strings.xml');
      if (fs.existsSync(stringsPath)) {
        let xml = fs.readFileSync(stringsPath, 'utf8');
        if (!xml.includes('widget_default_quote')) {
          xml = xml.replace(
            '</resources>',
            '    <string name="widget_default_quote">A little better, every day.</string>\n' +
            '</resources>',
          );
          fs.writeFileSync(stringsPath, xml);
        }
      }

      return mod;
    },
  ]);

  // 3. Register WidgetPackage in MainApplication.kt
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const mainAppPath = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java',
        packagePath,
        'MainApplication.kt',
      );
      if (!fs.existsSync(mainAppPath)) return mod;

      let src = fs.readFileSync(mainAppPath, 'utf8');
      if (src.includes('WidgetPackage')) return mod; // already registered

      // Add import after the package declaration
      src = src.replace(
        /^(package .+)\n/m,
        `$1\n\nimport ${packageId}.widget.WidgetPackage\n`,
      );

      // Pattern A: Expo SDK 52+ (New Architecture) format:
      //   val packages = PackageList(this).packages
      //   // optional comments
      //   return packages
      if (/val packages = PackageList\(this\)\.packages/.test(src)) {
        src = src.replace(
          /(val packages = PackageList\(this\)\.packages)([\s\S]*?)([ \t]*return packages)/,
          (match, decl, between, ret) => {
            const indent = ret.match(/^[ \t]*/)[0];
            return `${decl}${between}${indent}packages.add(WidgetPackage())\n${ret}`;
          },
        );
      // Pattern B: Old Expo format — PackageList(this).packages.apply { ... }
      } else if (src.includes('PackageList(this).packages.apply')) {
        src = src.replace(
          /(PackageList\(this\)\.packages\.apply\s*\{)([\s\S]*?)(\s*\})/,
          (match, open, inner, close) => {
            return `${open}${inner}            add(WidgetPackage())\n        ${close.trimStart()}`;
          },
        );
      // Pattern C: Explicit list literal — return mutableListOf(...) / listOf(...)
      } else if (/return\s+(?:mutableListOf|listOf)\(/.test(src)) {
        src = src.replace(
          /(override fun getPackages\(\)[\s\S]*?return\s+(?:mutableListOf|listOf)\()([\s\S]*?)(\))/,
          (match, open, inner, close) => {
            const sep = inner.trim() ? ',\n                ' : '\n                ';
            return `${open}${inner}${sep}WidgetPackage()${close}`;
          },
        );
      // Pattern D: Any getPackages override — inject a packages.add before first return
      } else if (src.includes('override fun getPackages()')) {
        src = src.replace(
          /(override fun getPackages\(\)[^{]*\{[\s\S]*?)([ \t]*return )/,
          (match, before, ret) => {
            const indent = ret.match(/^[ \t]*/)[0];
            return `${before}${indent}PackageList(this).packages.also { it.add(WidgetPackage()) }.let { return it }\n${ret}`;
          },
        );
      }

      fs.writeFileSync(mainAppPath, src);
      return mod;
    },
  ]);

  return config;
}

// ─── iOS ──────────────────────────────────────────────────────────────────────

function iosWidgetInfoPlist(widgetBundleId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>DailyGlow</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>`;
}

function iosWidgetEntitlements(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.application-groups</key>
	<array>
		<string>${appGroup}</string>
	</array>
</dict>
</plist>`;
}

function iosDailyGlowWidgetSwift(appGroup) {
  return `import WidgetKit
import SwiftUI

private let keyText    = "quoteText"
private let keyAuthor  = "quoteAuthor"
private let keyQuoteId = "quoteId"
private let keyStreak  = "streak"

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quoteText: String
    let quoteAuthor: String
    let quoteId: String
    let streak: Int
    let fontScale: Float
}

struct QuoteProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        QuoteEntry(date: .now, quoteText: "A little better, every day.", quoteAuthor: "DailyGlow", quoteId: "", streak: 0, fontScale: 1.0)
    }
    func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
        completion(entry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
        let e = entry()
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: e.date) ?? e.date
        completion(Timeline(entries: [e], policy: .after(next)))
    }
    private func entry() -> QuoteEntry {
        let defaults = UserDefaults(suiteName: "${appGroup}")
        let text    = defaults?.string(forKey: keyText)    ?? "A little better, every day."
        let author  = defaults?.string(forKey: keyAuthor)  ?? ""
        let quoteId = defaults?.string(forKey: keyQuoteId) ?? ""
        let streak  = defaults?.integer(forKey: keyStreak) ?? 0
        let fontScale = Float(defaults?.double(forKey: "fontScale") ?? 1.0)
        return QuoteEntry(date: .now, quoteText: text, quoteAuthor: author, quoteId: quoteId, streak: streak, fontScale: fontScale)
    }
}

struct DailyGlowWidgetEntryView: View {
    var entry: QuoteEntry
    @Environment(\\.widgetFamily) var widgetFamily

    var body: some View {
        switch widgetFamily {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.quoteText)
                    .font(.caption2)
                    .lineLimit(2)
                if !entry.quoteAuthor.isEmpty {
                    Text("\u2014 \\(entry.quoteAuthor)")
                        .font(.caption2)
                        .opacity(0.65)
                }
            }
            .containerBackground(.clear, for: .widget)
        case .accessoryInline:
            Text(entry.quoteText)
                .lineLimit(1)
                .containerBackground(.clear, for: .widget)
        default:
            VStack(alignment: .leading, spacing: 8) {
                Text(entry.quoteText)
                    .font(.system(size: 13 * CGFloat(entry.fontScale), weight: .regular, design: .serif))
                    .italic()
                    .foregroundColor(Color(red: 1.0, green: 0.29, blue: 0.17))
                    .multilineTextAlignment(.leading)
                    .lineLimit(5)
                HStack {
                    if !entry.quoteAuthor.isEmpty {
                        Text("\u2014 \\(entry.quoteAuthor)")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(Color(red: 1.0, green: 0.29, blue: 0.17).opacity(0.65))
                    }
                    Spacer()
                    if entry.streak > 0 {
                        Text("\\u{1F525} \\(entry.streak)")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(red: 1.0, green: 0.29, blue: 0.17).opacity(0.75))
                    }
                }
            }
            .padding(14)
            .containerBackground(Color(red: 1.0, green: 0.97, blue: 0.94), for: .widget)
            .widgetURL(URL(string: "com.jiwonjae.dailyglow://quote?id=\\(entry.quoteId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? \"\")"))
        }
    }
}

struct DailyGlowWidget: Widget {
    let kind = "DailyGlowWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuoteProvider()) { entry in
            DailyGlowWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("DailyGlow")
        .description("Today's quote on your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
`;
}

function iosWidgetBundleSwift(widgetName) {
  return `import WidgetKit

@main
struct DailyGlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        DailyGlowWidget()
    }
}
`;
}

function iosWidgetModuleSwift(appGroup) {
  return `import Foundation
import WidgetKit

@objc(WidgetModule)
class WidgetModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc func saveQuoteData(_ text: String, author: String, quoteId: String,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: "${appGroup}") else {
            reject("WIDGET_ERROR", "App Group UserDefaults unavailable", nil); return
        }
        defaults.set(text,    forKey: "quoteText")
        defaults.set(author,  forKey: "quoteAuthor")
        defaults.set(quoteId, forKey: "quoteId")
        defaults.synchronize()
        resolve(nil)
    }

    @objc func saveStreakData(_ streak: Int,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: "${appGroup}") else {
            reject("WIDGET_ERROR", "App Group UserDefaults unavailable", nil); return
        }
        defaults.set(streak, forKey: "streak")
        defaults.synchronize()
        resolve(nil)
    }

    @objc func reloadAllTimelines(_ resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) {
        WidgetCenter.shared.reloadAllTimelines()
        resolve(nil)
    }

    @objc func saveFontSizeData(_ multiplier: Double,
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: "${appGroup}") else {
            reject("WIDGET_ERROR", "App Group UserDefaults unavailable", nil); return
        }
        defaults.set(multiplier, forKey: "fontScale")
        defaults.synchronize()
        resolve(nil)
    }
}
`;
}

function iosWidgetModuleM() {
  return `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetModule, NSObject)

RCT_EXTERN_METHOD(saveQuoteData:(NSString *)text
                  author:(NSString *)author
                  quoteId:(NSString *)quoteId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveStreakData:(NSInteger)streak
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadAllTimelines:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveFontSizeData:(double)multiplier
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
`;
}

function withIOSWidget(config) {
  const bundleId    = config.ios?.bundleIdentifier ?? 'com.jiwonjae.dailyglow';
  const appGroup    = `group.${bundleId}`;
  const widgetName  = 'DailyGlowWidget';
  const widgetBundleId = `${bundleId}.widget`;

  // 1. App Group entitlement on the main app
  config = withEntitlementsPlist(config, (mod) => {
    const e      = mod.modResults;
    const groups = (e['com.apple.security.application-groups'] ?? []);
    if (!groups.includes(appGroup)) {
      e['com.apple.security.application-groups'] = [...groups, appGroup];
    }
    return mod;
  });

  // 2. Write source files into the iOS directory inline
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosRoot  = mod.modRequest.platformProjectRoot;
      const projName = mod.modRequest.projectName ?? 'DailyGlow';

      // Widget extension directory — all files written inline
      const extDir = path.join(iosRoot, widgetName);
      ensureDir(extDir);
      fs.writeFileSync(path.join(extDir, `${widgetName}.swift`),       iosDailyGlowWidgetSwift(appGroup));
      fs.writeFileSync(path.join(extDir, `${widgetName}Bundle.swift`), iosWidgetBundleSwift(widgetName));
      fs.writeFileSync(path.join(extDir, 'Info.plist'),                iosWidgetInfoPlist(widgetBundleId));
      fs.writeFileSync(path.join(extDir, `${widgetName}.entitlements`), iosWidgetEntitlements(appGroup));

      // WidgetModule into main project directory — written inline
      const mainProjDir = path.join(iosRoot, projName);
      ensureDir(mainProjDir);
      fs.writeFileSync(path.join(mainProjDir, 'WidgetModule.m'),     iosWidgetModuleM());
      fs.writeFileSync(path.join(mainProjDir, 'WidgetModule.swift'), iosWidgetModuleSwift(appGroup));

      return mod;
    },
  ]);

  // 3. Xcode project: add WidgetModule sources to main target + add widget extension target
  config = withXcodeProject(config, (mod) => {
    const proj     = mod.modResults;
    const projName = mod.modRequest.projectName ?? 'DailyGlow';

    // ── a. Register WidgetModule.m + WidgetModule.swift in main target ──────
    const mainTarget = proj.getFirstTarget()?.firstTarget;
    if (mainTarget) {
      const sources = proj.pbxSourcesBuildPhaseObj(mainTarget.uuid);
      const alreadyHasModule =
        sources?.files?.some((f) => {
          const ref = proj.pbxFileReferenceSection()[f.value];
          return ref && (ref.path ?? '').includes('WidgetModule');
        }) ?? false;
      if (!alreadyHasModule) {
        // addSourceFile(path, opt, target)
        try { proj.addSourceFile('WidgetModule.m',     {}, mainTarget.uuid); } catch (_) {}
        try { proj.addSourceFile('WidgetModule.swift', {}, mainTarget.uuid); } catch (_) {}
      }
    }

    // ── b. Widget extension target ──────────────────────────────────────────
    const existingTargets = proj.pbxNativeTargetSection();
    const alreadyAdded = Object.values(existingTargets).some(
      (t) => typeof t === 'object' && t.name === widgetName,
    );
    if (alreadyAdded) return mod;

    // Create a group for widget extension files
    const extFiles = [`${widgetName}.swift`, `${widgetName}Bundle.swift`, 'Info.plist'];
    const widgetGroup = proj.addPbxGroup(extFiles, widgetName, widgetName);

    // Attach the group to the project root group
    const projectSection = proj.getFirstProject()?.firstProject;
    if (projectSection) {
      const rootGroupKey = projectSection.mainGroup;
      const rootGroup    = proj.getPBXGroupByKey(rootGroupKey);
      if (rootGroup) {
        rootGroup.children = rootGroup.children ?? [];
        rootGroup.children.push({ value: widgetGroup.uuid, comment: widgetName });
      }
    }

    // Add the extension target
    const widgetTarget = proj.addTarget(widgetName, 'app_extension', widgetName, widgetBundleId);
    if (!widgetTarget) return mod;

    // Build phases
    proj.addBuildPhase(
      [`${widgetName}.swift`, `${widgetName}Bundle.swift`],
      'PBXSourcesBuildPhase', 'Sources', widgetTarget.uuid,
    );
    proj.addBuildPhase([], 'PBXResourcesBuildPhase',  'Resources',  widgetTarget.uuid);
    proj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', widgetTarget.uuid);

    // Frameworks
    try { proj.addFramework('WidgetKit.framework', { target: widgetTarget.uuid, weak: false }); } catch (_) {}
    try { proj.addFramework('SwiftUI.framework',   { target: widgetTarget.uuid, weak: false }); } catch (_) {}

    // Build settings for the widget extension
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const cfg of Object.values(buildConfigs)) {
      if (typeof cfg !== 'object' || !cfg.buildSettings) continue;
      const bs = cfg.buildSettings;
      // Match configs that belong to our new target (identified by PRODUCT_NAME)
      const pn = (bs.PRODUCT_NAME ?? '').replace(/^"|"$/g, '');
      if (pn === widgetName) {
        bs.SWIFT_VERSION                  = '5.0';
        bs.IPHONEOS_DEPLOYMENT_TARGET     = '16.0';
        bs.GENERATE_INFOPLIST_FILE        = 'NO';
        bs.INFOPLIST_FILE                 = `${widgetName}/Info.plist`;
        bs.APPLICATION_EXTENSION_API_ONLY = 'YES';
        bs.CODE_SIGN_ENTITLEMENTS         = `${widgetName}/${widgetName}.entitlements`;
        bs.PRODUCT_BUNDLE_IDENTIFIER      = `"${widgetBundleId}"`;
        bs.MARKETING_VERSION              = '1.0.0';
        bs.CURRENT_PROJECT_VERSION        = '1';
        bs.SKIP_INSTALL                   = 'YES';
      }
    }

    // Embed extension in the main app (CopyFiles phase → PlugIns, dst=13)
    if (mainTarget) {
      try {
        proj.addBuildPhase(
          [`${widgetName}.appex`],
          'PBXCopyFilesBuildPhase',
          'Embed Foundation Extensions',
          mainTarget.uuid,
          `${widgetName}.appex`,
          '13',
        );
      } catch (_) {}
    }

    return mod;
  });

  return config;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

module.exports = function withWidget(config) {
  config = withAndroidWidget(config);
  config = withIOSWidget(config);
  return config;
};
