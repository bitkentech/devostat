package com.github.pramodbiligiri.shipsmooth.resources;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ResourceBuilderIntegrationTest {

    @TempDir
    Path tempDir;

    @Test
    void skillMdIsRenderedForDevProfile() throws Exception {
        System.setProperty("build.outputDir", tempDir.toString());
        System.setProperty("plugin.name", "shipsmooth-dev");
        System.setProperty("plugin.version", "0.2.0");
        System.setProperty("plugin.description", "Agent coding workflow (dev build)");
        System.setProperty("plugin.skillName", "start-dev");
        System.setProperty("shipsmooth.cli.bin", "~/.cache/shipsmooth-dev/runtime-0.2.0/bin/shipsmooth-tasks");
        System.setProperty("skill.frontmatter", "");
        System.setProperty("shipsmooth.cache.dir", "~/.cache/shipsmooth-dev");
        System.setProperty("build.platform", "claude");

        ResourceBuilder.main(new String[]{});

        Path output = tempDir.resolve("skills/start-dev/SKILL.md");
        assertTrue(Files.exists(output), "SKILL.md should be written");

        String content = Files.readString(output);
        assertTrue(content.startsWith("# start-dev — Agent Coding Workflow"),
            "Claude profile should start with heading, no frontmatter");
        assertTrue(content.contains("~/.cache/shipsmooth-dev/runtime-0.2.0/bin/shipsmooth-tasks"),
            "CLI bin path should be interpolated");
    }

    @Test
    void skillMdIsRenderedForGeminiProfile() throws Exception {
        String frontmatter = "---\nname: start\ndescription: Use when starting any task — applies the shipsmooth agent coding workflow.\n---\n\n";

        System.setProperty("build.outputDir", tempDir.toString());
        System.setProperty("plugin.name", "shipsmooth");
        System.setProperty("plugin.version", "0.2.0");
        System.setProperty("plugin.description", "Agent coding workflow");
        System.setProperty("plugin.skillName", "start");
        System.setProperty("shipsmooth.cli.bin", "~/.cache/shipsmooth/runtime-0.2.0/bin/shipsmooth-tasks");
        System.setProperty("skill.frontmatter", frontmatter);
        System.setProperty("shipsmooth.cache.dir", "~/.cache/shipsmooth");
        System.setProperty("build.platform", "gemini");

        ResourceBuilder.main(new String[]{});

        Path output = tempDir.resolve("skills/start/SKILL.md");
        assertTrue(Files.exists(output), "SKILL.md should be written");

        String content = Files.readString(output);
        assertTrue(content.startsWith("---\nname: start"),
            "Gemini profile should start with YAML frontmatter");
        assertTrue(content.contains("# start — Agent Coding Workflow"),
            "Heading should follow frontmatter");
    }
}