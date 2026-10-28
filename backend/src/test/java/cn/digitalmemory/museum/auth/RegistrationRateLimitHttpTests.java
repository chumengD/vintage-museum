package cn.digitalmemory.museum.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "museum.registration.requests-per-minute=1",
        "spring.datasource.url=jdbc:h2:mem:museum-rate-test;DB_CLOSE_DELAY=-1"
})
class RegistrationRateLimitHttpTests {
    @Value("${local.server.port}")
    private int port;

    @Test
    void repeatedRequestsReturnReadable429WithRetryAfter() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/auth/register"))
                    .header("Origin", "http://localhost:5173").header("X-App-Request", "museum-web")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertThat(client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(400);
            var limited = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(limited.statusCode()).isEqualTo(429);
            assertThat(limited.body()).contains("REGISTER_RATE_LIMITED", "requestId");
            assertThat(Long.parseLong(limited.headers().firstValue("Retry-After").orElseThrow())).isBetween(1L, 60L);
            assertThat(limited.headers().firstValue("Access-Control-Allow-Origin")).contains("http://localhost:5173");
            assertThat(limited.headers().allValues("Set-Cookie")).isEmpty();
        }
    }
}
