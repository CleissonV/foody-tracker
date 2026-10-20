package com.foody.tracker;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.core.importer.ImportOption;

@AnalyzeClasses(packages = "com.foody.tracker", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule domain_does_not_depend_on_outer_layers = noClasses().that().resideInAPackage("..domain..")
        .should().dependOnClassesThat().resideInAnyPackage("..api..", "..application..", "..infra..");

    @ArchTest
    static final ArchRule controllers_do_not_access_repositories = noClasses().that().haveSimpleNameEndingWith("Controller")
        .should().dependOnClassesThat().resideInAPackage("..infra..");

    @ArchTest
    static final ArchRule application_does_not_depend_on_http_contracts = noClasses().that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAnyPackage("..auth.api..", "..orders.api..");
}
