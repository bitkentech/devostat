package com.github.pramodbiligiri.shipsmooth.resources;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ResourceBuilder {

    public static void main(String[] args) throws IOException {
        String buildOutputDir = System.getProperty("build.outputDir");
        String pluginName     = System.getProperty("plugin.name");
        String pluginVersion  = System.getProperty("plugin.version");
        String pluginDesc     = System.getProperty("plugin.description");
        String skillName      = System.getProperty("plugin.skillName");
        String frontmatter    = System.getProperty("skill.frontmatter", "");
        String cacheDir       = System.getProperty("shipsmooth.cache.dir.resolved", "");
        String platform       = System.getProperty("build.platform", "claude");
        String cliBin         = cacheDir + "/runtime-" + pluginVersion + "/bin/shipsmooth-tasks";

        PluginModel model = new PluginModel(
            pluginName, pluginVersion, pluginDesc,
            skillName, cliBin, frontmatter, cacheDir, platform
        );

        TemplateEngine engine = TemplateEngine.createPrecompiled(ContentType.Plain);

        Path skillDir = Path.of(buildOutputDir, "skills", skillName);
        Files.createDirectories(skillDir);
        renderTo(engine, "skills/SKILL.jte", model, skillDir.resolve("SKILL.md"));

        System.out.println("Rendered SKILL.md to " + skillDir.toAbsolutePath());
    }

    static void renderTo(TemplateEngine engine, String templateName,
                         PluginModel model, Path outputFile) throws IOException {
        StringOutput out = new StringOutput();
        engine.render(templateName, model, out);
        Files.writeString(outputFile, out.toString());
    }
}
