module io.bitken.shipsmooth.tasks {
    requires info.picocli;
    requires jakarta.xml.bind;
    requires java.xml;
    requires org.glassfish.jaxb.runtime;

    opens io.bitken.shipsmooth.tasks.commands to info.picocli;
    opens io.bitken.shipsmooth.tasks.jaxb to jakarta.xml.bind;
}