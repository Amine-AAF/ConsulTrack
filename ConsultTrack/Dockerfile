FROM maven:3.9.5-openjdk-17-slim AS build

WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
RUN mvn -B -ntp clean package

FROM gcr.io/distroless/java17-debian11:nonroot

WORKDIR /app

COPY --from=build /workspace/target/consulttrack-1.0.0.jar /app/app.jar

EXPOSE 8081

USER nonroot:nonroot
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
