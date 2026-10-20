FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --gid 10001 foody && useradd --uid 10001 --gid foody --no-create-home foody \
    && mkdir /app/data && chown foody:foody /app/data
COPY --from=build --chown=foody:foody /build/target/tracker-1.0.0.jar app.jar
USER foody
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
