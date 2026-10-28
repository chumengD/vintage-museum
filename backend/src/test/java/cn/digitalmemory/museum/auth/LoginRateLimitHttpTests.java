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
        "museum.auth.requests-per-minute=1",
        "spring.datasource.url=jdbc:h2:mem:museum-login-rate-test;DB_CLOSE_DELAY=-1"
})
class LoginRateLimitHttpTests {
    @Value("${local.server.port}") private int port;

    @Test
    void loginIsRateLimitedButLogoutCanStillClearCookie() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var request = request("/api/auth/login", "{\"username\":\"unknown_user\",\"password\":\"1234\"}");
            assertThat(client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
            var limited = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(limited.statusCode()).isEqualTo(429);
            assertThat(limited.body()).contains("LOGIN_RATE_LIMITED");
            assertThat(limited.headers().firstValue("Retry-After")).isPresent();
            assertThat(limited.headers().firstValue("Access-Control-Allow-Origin")).contains("http://localhost:5173");
            assertThat(client.send(request("/api/auth/logout", ""), HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
        }
    }

    private HttpRequest request(String path, String body) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header("Origin", "http://localhost:5173").header("X-App-Request", "museum-web")
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
    }
}
