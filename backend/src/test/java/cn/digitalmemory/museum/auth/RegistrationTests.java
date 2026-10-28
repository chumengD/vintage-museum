package cn.digitalmemory.museum.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import cn.digitalmemory.museum.user.User;
import cn.digitalmemory.museum.user.UserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "museum.registration.requests-per-minute=1000")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class RegistrationTests {
    private static final String ORIGIN = "http://localhost:5173";
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${local.server.port}")
    private int port;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private ObjectMapper json;

    @BeforeEach
    void clearUsers() { users.deleteAll(); }

    @AfterAll
    void closeClient() { client.close(); }

    @Test
    void createsNormalizedUserWithoutLoggingIn() throws Exception {
        var password = " 密码Ab 😀 ";
        var response = register("  Museum_01  ", password);
        assertThat(response.statusCode()).isEqualTo(201);
        assertThat(response.body()).contains("\"username\":\"museum_01\"", "\"id\":")
                .doesNotContain("password", "token", "ACTIVE", password);
        assertThat(response.headers().allValues("Set-Cookie")).isEmpty();
        assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(ORIGIN);
        var user = users.findByUsername("museum_01").orElseThrow();
        assertThat(user.getStatus()).isEqualTo(User.Status.ACTIVE);
        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(user.getUpdatedAt()).isNotNull();
        assertThat(user.getEmail()).isNull();
        assertThat(user.getPasswordHash()).startsWith("$argon2id$").isNotEqualTo(password);
        assertThat(encoder.matches(password, user.getPasswordHash())).isTrue();
        assertThat(encoder.matches(password.strip(), user.getPasswordHash())).isFalse();
        var me = client.send(HttpRequest.newBuilder(URI.create(base() + "/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(me.statusCode()).isEqualTo(401);
    }

    @ParameterizedTest
    @CsvSource({"1,400", "2,201", "32,201", "33,400"})
    void usernameLengthBoundaries(int length, int status) throws Exception {
        assertThat(register("a".repeat(length), "1234").statusCode()).isEqualTo(status);
        assertThat(users.count()).isEqualTo(status == 201 ? 1 : 0);
    }

    @ParameterizedTest
    @CsvSource({"3,400", "4,201", "64,201", "65,400"})
    void passwordLengthCountsUnicodeCodePoints(int length, int status) throws Exception {
        var password = "😀".repeat(length);
        assertThat(register("user_01", password).statusCode()).isEqualTo(status);
        if (status == 201) {
            assertThat(encoder.matches(password, users.findByUsername("user_01").orElseThrow().getPasswordHash())).isTrue();
        } else { assertThat(users.count()).isZero(); }
    }

    @Test
    void rejectsDuplicateCaseVariantsWithoutChangingPassword() throws Exception {
        assertThat(register("Museum_01", "first-password").statusCode()).isEqualTo(201);
        var hash = users.findByUsername("museum_01").orElseThrow().getPasswordHash();
        var response = register(" MUSEUM_01 ", "other-password");
        assertError(response, 409, "USERNAME_ALREADY_EXISTS");
        assertThat(users.count()).isEqualTo(1);
        assertThat(users.findByUsername("museum_01").orElseThrow().getPasswordHash()).isEqualTo(hash);
    }

    @Test
    void samePasswordUsesIndependentSalts() throws Exception {
        assertThat(register("user_01", "same-password").statusCode()).isEqualTo(201);
        assertThat(register("user_02", "same-password").statusCode()).isEqualTo(201);
        assertThat(users.findByUsername("user_01").orElseThrow().getPasswordHash())
                .isNotEqualTo(users.findByUsername("user_02").orElseThrow().getPasswordHash());
    }

    @Test
    void storesTrimmedEmailAsProfileInformationWithoutUniquenessRequirement() throws Exception {
        var first = send(json.writeValueAsString(Map.of("username", "email_user_01", "password", "1234",
                        "email", "  Person@Example.com  ")), "application/json", ORIGIN, "museum-web");
        assertThat(first.statusCode()).isEqualTo(201);
        assertThat(first.body()).contains("\"email\":\"Person@Example.com\"");
        assertThat(users.findByUsername("email_user_01").orElseThrow().getEmail()).isEqualTo("Person@Example.com");
        var second = send(json.writeValueAsString(Map.of("username", "email_user_02", "password", "1234",
                        "email", "Person@Example.com")), "application/json", ORIGIN, "museum-web");
        assertThat(second.statusCode()).isEqualTo(201);
        assertThat(users.count()).isEqualTo(2);
        assertThat(first.headers().allValues("Set-Cookie")).isEmpty();
    }

    @Test
    void missingNullAndBlankEmailAreCompatibleWithOldClients() throws Exception {
        for (var emailJson : List.of("null", "\"\"", "\"   \"")) {
            var response = send("{\"username\":\"optional_email\",\"password\":\"1234\",\"email\":" + emailJson + "}",
                    "application/json", ORIGIN, "museum-web");
            assertThat(response.statusCode()).isEqualTo(201);
            assertThat(users.findByUsername("optional_email").orElseThrow().getEmail()).isNull();
            users.deleteAll();
        }
        assertThat(register("without_email", "1234").statusCode()).isEqualTo(201);
    }

    @Test
    void rejectsInvalidOrOversizedEmailWithoutCreatingUser() throws Exception {
        for (var email : List.of("not-an-email", "a@@example.com", "a b@example.com", "a".repeat(255) + "@example.com")) {
            var response = send(json.writeValueAsString(Map.of("username", "bad_email", "password", "1234", "email", email)),
                    "application/json", ORIGIN, "museum-web");
            assertError(response, 400, "VALIDATION_ERROR");
            assertThat(response.body()).contains("\"email\":");
        }
        assertError(send("{\"username\":\"bad_email\",\"password\":\"1234\",\"email\":1234}",
                "application/json", ORIGIN, "museum-web"), 400, "VALIDATION_ERROR");
        assertThat(users.count()).isZero();
    }

    @Test
    void invalidInputsNeverCreateUsersOrEchoPasswords() throws Exception {
        for (var body : List.of("{}", "null", "{", "{\"username\":null,\"password\":null}",
                "{\"username\":1234,\"password\":\"private-password\"}",
                "{\"username\":\"good_user\",\"password\":1234}",
                json.writeValueAsString(Map.of("username", "中文", "password", "private-password")),
                json.writeValueAsString(Map.of("username", "a b", "password", "private-password")),
                json.writeValueAsString(Map.of("username", "good_user", "password", "private-password", "status", "ACTIVE")))) {
            var response = send(body, "application/json", ORIGIN, "museum-web");
            assertError(response, 400, "VALIDATION_ERROR");
            assertThat(response.body()).doesNotContain("private-password");
        }
        assertThat(users.count()).isZero();
        assertThat(register("valid_user", "1234").statusCode()).isEqualTo(201);
    }

    @Test
    void rejectsUnsupportedMediaType() throws Exception {
        assertError(send("username=some_user&password=1234", "application/x-www-form-urlencoded", ORIGIN, "museum-web"),
                415, "UNSUPPORTED_MEDIA_TYPE");
        assertThat(users.count()).isZero();
    }

    @Test
    void sourceAndCustomHeaderAreRequired() throws Exception {
        var body = json.writeValueAsString(Map.of("username", "some_user", "password", "1234"));
        assertError(send(body, "application/json", null, "museum-web"), 403, "REQUEST_FORBIDDEN");
        assertError(send(body, "application/json", "http://evil.example", "museum-web"), 403, "REQUEST_FORBIDDEN");
        var missingHeader = send(body, "application/json", ORIGIN, null);
        assertError(missingHeader, 403, "REQUEST_FORBIDDEN");
        assertThat(missingHeader.headers().firstValue("Access-Control-Allow-Origin")).contains(ORIGIN);
        assertThat(users.count()).isZero();
    }

    @Test
    void browserPreflightAllowsOnlyConfiguredOrigin() throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/auth/register"))
                .header("Origin", ORIGIN).header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-app-request")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(ORIGIN);
        assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).contains("true");
        assertThat(users.count()).isZero();
    }

    @Test
    void concurrentRegistrationsCreateExactlyOneUser() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            var tasks = java.util.stream.IntStream.range(0, 2).mapToObj(index -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) { throw new IllegalStateException("Timed out"); }
                return register("same_account", "same-password").statusCode();
            })).toList();
            assertThat(ready.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(tasks.get(0).get(20, java.util.concurrent.TimeUnit.SECONDS),
                    tasks.get(1).get(20, java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
        }
        assertThat(users.count()).isEqualTo(1);
    }

    private HttpResponse<String> register(String username, String password) throws Exception {
        return send(json.writeValueAsString(Map.of("username", username, "password", password)),
                "application/json", ORIGIN, "museum-web");
    }

    private HttpResponse<String> send(String body, String contentType, String origin, String appHeader) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/auth/register"))
                .timeout(Duration.ofSeconds(15)).header("Content-Type", contentType);
        if (origin != null) { request.header("Origin", origin); }
        if (appHeader != null) { request.header("X-App-Request", appHeader); }
        return client.send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    private void assertError(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.body()).contains("\"code\":\"" + code + "\"", "\"requestId\":")
                .doesNotContain("stackTrace", "password_hash");
        assertThat(response.headers().firstValue("X-Request-Id")).isPresent();
        assertThat(response.headers().allValues("Set-Cookie")).isEmpty();
    }

    private String base() { return "http://127.0.0.1:" + port; }
}
