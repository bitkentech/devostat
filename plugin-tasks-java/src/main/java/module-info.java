module com.github.pramodbiligiri.shipsmooth.tasks {
    requires info.picocli;
    requires jakarta.xml.bind;
    requires java.xml;
    requires org.glassfish.jaxb.runtime;

    opens com.github.pramodbiligiri.shipsmooth.tasks.commands to info.picocli;
    opens com.github.pramodbiligiri.shipsmooth.tasks.jaxb to jakarta.xml.bind;
}