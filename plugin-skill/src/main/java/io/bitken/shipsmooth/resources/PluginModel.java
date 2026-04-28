package io.bitken.shipsmooth.resources;

public record PluginModel(
    String pluginName,
    String pluginVersion,
    String pluginDescription,
    String skillName,
    String cliBin,
    String skillFrontmatter,
    String cacheDir,
    String platform,
    String jlinkDir
) {}
