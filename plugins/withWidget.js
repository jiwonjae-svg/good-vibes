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

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import ${packageId}.R

class DailyGlowWidget : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME = "DailyGlowWidget"
        const val KEY_TEXT   = "quoteText"
        const val KEY_AUTHOR = "quoteAuthor"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val prefs  = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val text   = prefs.getString(KEY_TEXT,   context.getString(R.string.widget_default_quote)) ?: ""
        val author = prefs.getString(KEY_AUTHOR, "") ?: ""

        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        views.setTextViewText(R.id.widget_quote, text)
        if (author.isNotEmpty()) {
            views.setTextViewText(R.id.widget_author, "— $author")
            views.setViewVisibility(R.id.widget_author, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_author, View.GONE)
        }
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

    <TextView
        android:id="@+id/widget_author"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:textSize="12sp"
        android:textColor="#99FF4A2A"
        android:gravity="end"
        android:visibility="gone" />

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
    android:widgetCategory="home_screen" />
`;

const WIDGET_BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFF8F0" />
    <corners android:radius="16dp" />
    <stroke android:width="1dp" android:color="#1AFF9F7E" />
</shape>
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
      fs.writeFileSync(path.join(resBase, 'layout/widget_layout.xml'),   WIDGET_LAYOUT_XML);
      fs.writeFileSync(path.join(resBase, 'xml/widget_info.xml'),        WIDGET_INFO_XML);
      fs.writeFileSync(path.join(resBase, 'drawable/widget_background.xml'), WIDGET_BACKGROUND_XML);

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

      // Inject add(WidgetPackage()) inside the .apply { } block of getPackages()
      src = src.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)([\s\S]*?)(\s*\})/,
        (match, open, inner, close) => {
          return `${open}${inner}            add(WidgetPackage())\n        ${close.trimStart()}`;
        },
      );

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

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quoteText: String
    let quoteAuthor: String
    let quoteId: String
}

struct QuoteProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        QuoteEntry(date: .now, quoteText: "A little better, every day.", quoteAuthor: "DailyGlow", quoteId: "")
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
        return QuoteEntry(date: .now, quoteText: text, quoteAuthor: author, quoteId: quoteId)
    }
}

struct DailyGlowWidgetEntryView: View {
    var entry: QuoteEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.quoteText)
                .font(.system(size: 13, weight: .regular, design: .serif))
                .italic()
                .foregroundColor(Color(red: 1.0, green: 0.29, blue: 0.17))
                .multilineTextAlignment(.leading)
                .lineLimit(5)
            if !entry.quoteAuthor.isEmpty {
                Text("\u2014 \\(entry.quoteAuthor)")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundColor(Color(red: 1.0, green: 0.29, blue: 0.17).opacity(0.65))
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(14)
        .containerBackground(Color(red: 1.0, green: 0.97, blue: 0.94), for: .widget)
        .widgetURL(URL(string: "com.jiwonjae.dailyglow://quote?id=\\(entry.quoteId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? \"\")"))
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
        .supportedFamilies([.systemSmall, .systemMedium])
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

    @objc func reloadAllTimelines(_ resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) {
        WidgetCenter.shared.reloadAllTimelines()
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

RCT_EXTERN_METHOD(reloadAllTimelines:(RCTPromiseResolveBlock)resolve
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
