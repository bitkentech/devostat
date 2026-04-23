package com.github.pramodbiligiri.shipsmooth.tasks.commands;

import com.github.pramodbiligiri.shipsmooth.tasks.jaxb.PlanTasks;
import com.github.pramodbiligiri.shipsmooth.tasks.service.XmlService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.util.concurrent.Callable;

@Command(name = "project-update", description = "Add a project update.")
public class ProjectUpdateCommand implements Callable<Integer> {

    @Option(names = "--plan", required = true)
    private int plan;

    @Option(names = "--status")
    private String status;

    @Option(names = "--blocked")
    private Boolean blocked;

    @Option(names = "--message")
    private String message;

    @Override
    public Integer call() throws Exception {
        XmlService service = new XmlService();
        File file = new File(".agents/plans/plan-" + plan + "-tasks.xml");
        PlanTasks planTasks = service.readPlanTasks(file);
        service.projectUpdate(planTasks, status, blocked, message);
        service.writePlanTasks(planTasks, file);
        System.out.println("Project update added.");
        return 0;
    }
}
