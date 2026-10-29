# Build stage — uses the Maven wrapper already in the project, so no
# separate Maven install is needed inside the image either.
FROM eclipse-temurin:17-jdk-alpine AS build
RUN apk add --no-cache bash curl unzip
WORKDIR /app
COPY . .
RUN ./mvnw -q -DskipTests package

# Run stage — small runtime-only image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
