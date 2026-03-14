/**
 * plugins/withWidget.js
 *
 * Expo config plugin that wires the DailyGlow home-screen widget into the
 * native project during `npx expo prebuild`.
 *
 * Android — fully automated:
 *   • Copies Kotlin source files into the app package directory
 *   • Copies res/layout, res/xml, res/drawable resource files
 *   • Adds the AppWidgetProvider <receiver> to AndroidManifest.xml
 *   • Injects WidgetPackage into MainApplication.kt
 *
 * iOS — partially automated:
 *   • Adds com.apple.security.application-groups to the main app entitlements
 *   • Copies WidgetModule.m + WidgetModule.swift into the main iOS project dir
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

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

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

  // 2. Copy Kotlin source files + resource files
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const androidRoot = mod.modRequest.platformProjectRoot;
      const pluginDir   = path.join(mod.modRequest.projectRoot, 'plugins/android');

      // Kotlin source files
      const widgetPkgDir = path.join(
        androidRoot,
        'app/src/main/java',
        packagePath,
        'widget',
      );
      ensureDir(widgetPkgDir);
      for (const f of ['DailyGlowWidget.kt', 'WidgetModule.kt', 'WidgetPackage.kt']) {
        copyIfExists(path.join(pluginDir, f), path.join(widgetPkgDir, f));
      }

      // Resource files
      const resBase = path.join(androidRoot, 'app/src/main/res');
      ensureDir(path.join(resBase, 'layout'));
      ensureDir(path.join(resBase, 'xml'));
      ensureDir(path.join(resBase, 'drawable'));
      copyIfExists(
        path.join(pluginDir, 'res/layout/widget_layout.xml'),
        path.join(resBase, 'layout/widget_layout.xml'),
      );
      copyIfExists(
        path.join(pluginDir, 'res/xml/widget_info.xml'),
        path.join(resBase, 'xml/widget_info.xml'),
      );
      copyIfExists(
        path.join(pluginDir, 'res/drawable/widget_background.xml'),
        path.join(resBase, 'drawable/widget_background.xml'),
      );

      // String resources (widget_default_quote, widget_description)
      const stringsPath = path.join(resBase, 'values/strings.xml');
      if (fs.existsSync(stringsPath)) {
        let xml = fs.readFileSync(stringsPath, 'utf8');
        if (!xml.includes('widget_default_quote')) {
          xml = xml.replace(
            '</resources>',
            '    <string name="widget_default_quote">A little better, every day.</string>\n' +
            '    <string name="widget_description">Shows the latest DailyGlow quote</string>\n' +
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

  // 2. Copy source files into the iOS directory
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosRoot   = mod.modRequest.platformProjectRoot;
      const pluginDir = path.join(mod.modRequest.projectRoot, 'plugins/ios');
      const projName  = mod.modRequest.projectName ?? 'DailyGlow';

      // Widget extension directory
      const extDir = path.join(iosRoot, widgetName);
      ensureDir(extDir);
      for (const f of [`${widgetName}.swift`, `${widgetName}Bundle.swift`]) {
        copyIfExists(path.join(pluginDir, f), path.join(extDir, f));
      }
      fs.writeFileSync(path.join(extDir, 'Info.plist'), iosWidgetInfoPlist(widgetBundleId));
      fs.writeFileSync(path.join(extDir, `${widgetName}.entitlements`), iosWidgetEntitlements(appGroup));

      // WidgetModule into main project directory
      const mainProjDir = path.join(iosRoot, projName);
      for (const f of ['WidgetModule.m', 'WidgetModule.swift']) {
        copyIfExists(path.join(pluginDir, f), path.join(mainProjDir, f));
      }

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
