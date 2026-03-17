const { withGradleProperties } = require("expo/config-plugins");

/**
 * Config plugin to set org.gradle.jvmargs in android/gradle.properties.
 * expo-build-properties extraGradleProperties may not override the default value,
 * so this plugin explicitly replaces it.
 */
module.exports = function withGradleMemory(config, { jvmArgs } = {}) {
  const args =
    jvmArgs || "-Xmx6144m -XX:MaxMetaspaceSize=1024m";

  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    // Remove any existing org.gradle.jvmargs entry
    const filtered = props.filter(
      (p) => !(p.type === "property" && p.key === "org.gradle.jvmargs")
    );
    // Add our value
    filtered.push({
      type: "property",
      key: "org.gradle.jvmargs",
      value: args,
    });
    config.modResults = filtered;
    return config;
  });
};
