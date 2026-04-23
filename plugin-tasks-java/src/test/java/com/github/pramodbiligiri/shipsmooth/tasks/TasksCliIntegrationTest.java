package com.github.pramodbiligiri.shipsmooth.tasks;

import org.junit.jupiter.api.Test;
import picocli.CommandLine;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class TasksCliIntegrationTest {

    @Test
    public void testCliHelpCommand() {
        TasksCli app = new TasksCli();
        CommandLine cmd = new CommandLine(app);
        
        int exitCode = cmd.execute("--help");
        assertEquals(0, exitCode);
    }
}
