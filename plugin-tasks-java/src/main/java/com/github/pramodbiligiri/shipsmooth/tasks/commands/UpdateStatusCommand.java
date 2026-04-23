package com.github.pramodbiligiri.shipsmooth.tasks.commands;

import com.github.pramodbiligiri.shipsmooth.tasks.jaxb.PlanTasks;
import com.github.pramodbiligiri.shipsmooth.tasks.service.XmlService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.util.concurrent.Callable;

@Command(name = "update-status", description = "Update the status of a task.")
public class UpdateStatusCommand implements Callable<Integer> {

    @Option(names = "--plan", required = true)
    private int plan;

    @Option(names = "--task", required = true)
    private int task;

    @Option(names = "--status", required = true)
    private String status;

    @Override
    public Integer call() throws Exception {
        XmlService service = new XmlService();
        File file = new File(".agents/plans/plan-" + plan + "-tasks.xml");
        PlanTasks planTasks = service.readPlanTasks(file);
        service.updateTaskStatus(planTasks, task, status);
        service.writePlanTasks(planTasks, file);
        System.out.println("Task " + task + " status set to \"" + status + "\"");
        return 0;
    }
}
