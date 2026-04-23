package com.github.pramodbiligiri.shipsmooth.tasks.commands;

import com.github.pramodbiligiri.shipsmooth.tasks.jaxb.PlanTasks;
import com.github.pramodbiligiri.shipsmooth.tasks.service.XmlService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.util.concurrent.Callable;

@Command(name = "show", description = "Show plan tasks.")
public class ShowCommand implements Callable<Integer> {

    @Option(names = "--plan", required = true)
    private int plan;

    @Override
    public Integer call() throws Exception {
        XmlService service = new XmlService();
        File file = new File(".agents/plans/plan-" + plan + "-tasks.xml");
        PlanTasks planTasks = service.readPlanTasks(file);
        System.out.print(service.formatPlanSummary(planTasks));
        return 0;
    }
}
