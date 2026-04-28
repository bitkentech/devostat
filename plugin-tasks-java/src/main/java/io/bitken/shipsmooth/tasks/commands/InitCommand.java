package io.bitken.shipsmooth.tasks.commands;

import io.bitken.shipsmooth.tasks.jaxb.PlanTasks;
import io.bitken.shipsmooth.tasks.service.XmlService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.Callable;

@Command(name = "init", description = "Initialize task tracking XML for a plan.")
public class InitCommand implements Callable<Integer> {

    @Option(names = "--plan", required = true, description = "Plan number.")
    private int plan;

    @Option(names = "--tasks-from", required = true, description = "Path to the plan markdown file.")
    private String tasksFrom;

    @Override
    public Integer call() throws Exception {
        XmlService service = new XmlService();
        Path markdownPath = Paths.get(tasksFrom);
        if (!Files.exists(markdownPath)) {
            System.err.println("Plan file not found: " + tasksFrom);
            return 1;
        }
        String markdown = Files.readString(markdownPath);
        List<XmlService.Task> tasks = service.parseTasksFromPlan(markdown);
        String planVersion = service.getPlanVersion(plan);

        PlanTasks planTasks = service.generatePlanTasks(plan, planVersion, tasks);
        File outFile = new File(".agents/plans/plan-" + plan + "-tasks.xml");
        service.writePlanTasks(planTasks, outFile);

        System.out.println("Written " + tasks.size() + " tasks to " + outFile.getPath());
        return 0;
    }
}
