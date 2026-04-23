package com.github.pramodbiligiri.shipsmooth.tasks.commands;

import com.github.pramodbiligiri.shipsmooth.tasks.jaxb.PlanTasks;
import com.github.pramodbiligiri.shipsmooth.tasks.service.XmlService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.util.concurrent.Callable;

@Command(name = "add-deviation", description = "Add a deviation to a task.")
public class AddDeviationCommand implements Callable<Integer> {

    @Option(names = "--plan", required = true)
    private int plan;

    @Option(names = "--task", required = true)
    private int task;

    @Option(names = "--type", required = true)
    private String type;

    @Option(names = "--message", required = true)
    private String message;

    @Override
    public Integer call() throws Exception {
        XmlService service = new XmlService();
        File file = new File(".agents/plans/plan-" + plan + "-tasks.xml");
        PlanTasks planTasks = service.readPlanTasks(file);
        service.addDeviation(planTasks, task, type, message);
        service.writePlanTasks(planTasks, file);
        System.out.println("Deviation added to task " + task);
        return 0;
    }
}
