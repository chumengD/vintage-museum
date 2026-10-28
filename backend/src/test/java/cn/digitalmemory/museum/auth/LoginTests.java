package cn.digitalmemory.museum.auth;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import javax.crypto.spec.SecretKeySpec;
import cn.digitalmemory.museum.config.AuthProperties;
import cn.digitalmemory.museum.user.User;
import cn.digitalmemory.museum.user.UserRepository;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "museum.auth.requests-per-minute=1000",
        "spring.datasource.url=jdbc:h2:mem:museum-login-test;DB_CLOSE_DELAY=-1"
})
@Import(LoginTests.TimeConfiguration.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LoginTests {
    private static final String ORIGIN = "http://localhost:5173";
    private static final String PASSWORD = " 密码 Ab😀 ";
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    @Value("${local.server.port}") private int port;
    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder passwords;
    @Autowired private ObjectMapper json;
    @Autowired private JwtTokenService tokens;
    @Autowired private AuthProperties properties;
    @Autowired private MutableClock clock;
    @Autowired private JdbcTemplate jdbc;
    private User user;

    @BeforeEach
    void prepareAccount() {
        clock.now = Instant.parse("2026-10-28T00:00:00Z");
        users.deleteAll();
        user = users.saveAndFlush(new User("login_user", passwords.encode(PASSWORD), "user@example.com"));
    }

    @AfterAll void closeClient() { client.close(); }

    @Test
    void loginWritesCookieAndMeReturnsCurrentDatabaseProfile() throws Exception {
        var response = login("  LOGIN_User  ", PASSWORD, null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"username\":\"login_user\"", "\"email\":\"user@example.com\"", "\"expiresAt\":")
                .doesNotContain("password", "token", "$argon2", PASSWORD);
        var cookie = response.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(cookie).contains("HttpOnly", "SameSite=Lax", "Path=/api", "Max-Age=1800")
                .doesNotContain("Secure", "Domain=", "JSESSIONID");
        assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
        var value = token(response);
        var claims = SignedJWT.parse(value).getJWTClaimsSet();
        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        assertThat(claims.getIssuer()).isEqualTo(properties.jwt().issuer());
        assertThat(claims.getAudience()).contains(properties.jwt().audience());
        assertThat(claims.getExpirationTime().toInstant()).isEqualTo(clock.instant().plusSeconds(1800));
        assertThat(claims.getClaims()).doesNotContainKeys("password", "password_hash", "username", "email");
        var me = me(value);
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.body()).contains(user.getId().toString(), "user@example.com");
        assertThat(me.headers().allValues("Set-Cookie")).isEmpty();
        assertThat(me.headers().firstValue("Cache-Control")).contains("no-store");
        jdbc.update("UPDATE app_users SET email = ? WHERE id = ?", "changed@example.com", user.getId());
        assertThat(me(value).body()).contains("changed@example.com");
    }

    @Test
    void wrongPasswordAndUnknownAccountUseSameErrorAndDoNotReplaceCookie() throws Exception {
        var old = token(login("login_user", PASSWORD, null));
        var wrong = login("login_user", "wrong-password", old);
        var absent = login("unknown_user", PASSWORD, null);
        assertError(wrong, 401, "INVALID_CREDENTIALS");
        assertError(absent, 401, "INVALID_CREDENTIALS");
        assertThat(wrong.headers().allValues("Set-Cookie")).isEmpty();
        assertThat(me(old).statusCode()).isEqualTo(200);
    }

    @Test
    void passwordIsNotTrimmedAndEmailIsNotAcceptedAsLoginIdentifier() throws Exception {
        assertError(login("login_user", PASSWORD.strip(), null), 401, "INVALID_CREDENTIALS");
        assertError(login("user@example.com", PASSWORD, null), 400, "VALIDATION_ERROR");
    }

    @Test
    void malformedOrExpiredOldCookieDoesNotPreventNewLoginOrRegistration() throws Exception {
        assertThat(login("login_user", PASSWORD, "bad.jwt").statusCode()).isEqualTo(200);
        var old = tokens.issue(user.getId()).value();
        clock.now = clock.now.plusSeconds(1800);
        assertThat(login("login_user", PASSWORD, old).statusCode()).isEqualTo(200);
        var registration = post("/api/auth/register", json.writeValueAsString(Map.of("username", "other_user", "password", "1234")), "bad.jwt");
        assertThat(registration.statusCode()).isEqualTo(201);
        assertThat(registration.headers().allValues("Set-Cookie")).isEmpty();
    }

    @Test
    void missingCookieAndBearerOnlyCannotAuthenticate() throws Exception {
        assertError(me(null), 401, "AUTH_REQUIRED");
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/auth/me"))
                .header("Authorization", "Bearer " + tokens.issue(user.getId()).value()).GET().build();
        assertError(client.send(request, HttpResponse.BodyHandlers.ofString()), 401, "AUTH_REQUIRED");
    }

    @Test
    void expirationIsFixedAndMeDoesNotRenewIt() throws Exception {
        var value = token(login("login_user", PASSWORD, null));
        clock.now = clock.now.plusSeconds(1799);
        assertThat(me(value).statusCode()).isEqualTo(200);
        clock.now = clock.now.plusSeconds(1);
        assertError(me(value), 401, "TOKEN_EXPIRED");
    }

    @Test
    void rejectsMalformedTamperedAndUnsignedTokens() throws Exception {
        var value = tokens.issue(user.getId()).value();
        var parts = value.split("\\.");
        parts[2] = (parts[2].startsWith("A") ? "B" : "A") + parts[2].substring(1);
        assertError(me(String.join(".", parts)), 401, "TOKEN_INVALID");
        assertError(me("not-a-jwt"), 401, "TOKEN_INVALID");
        var none = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertError(me(none + "." + parts[1] + "."), 401, "TOKEN_INVALID");
    }

    @Test
    void rejectsWrongIssuerAudienceAndAlgorithmEvenWithValidSignature() throws Exception {
        assertError(me(signed(builder -> builder.issuer("another-issuer"), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
        assertError(me(signed(builder -> builder.audience(List.of("another-api")), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
        assertError(me(signed(builder -> {}, MacAlgorithm.HS384)), 401, "TOKEN_INVALID");
    }

    @Test
    void rejectsMissingClaimsInvalidSubjectAndFutureTimestamps() throws Exception {
        for (var name : List.of("sub", "iss", "aud", "iat", "exp", "jti")) {
            assertError(me(signed(builder -> builder.claims(claims -> claims.remove(name)), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
        }
        assertError(me(signed(builder -> builder.subject("not-a-uuid"), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
        assertError(me(signed(builder -> builder.issuedAt(clock.instant().plusSeconds(10)), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
        assertError(me(signed(builder -> builder.notBefore(clock.instant().plusSeconds(10)), MacAlgorithm.HS256)), 401, "TOKEN_INVALID");
    }

    @Test
    void disabledOrDeletedUserCannotUseOldToken() throws Exception {
        var value = tokens.issue(user.getId()).value();
        jdbc.update("UPDATE app_users SET status = 'DISABLED' WHERE id = ?", user.getId());
        assertError(me(value), 401, "AUTH_INVALID");
        assertError(login("login_user", PASSWORD, null), 401, "INVALID_CREDENTIALS");
        users.deleteAll();
        assertError(me(value), 401, "AUTH_INVALID");
    }

    @Test
    void repeatedLoginIssuesIndependentTokensAndDoesNotRevokePreviousOne() throws Exception {
        var first = token(login("login_user", PASSWORD, null));
        var second = token(login("login_user", PASSWORD, first));
        assertThat(first).isNotEqualTo(second);
        assertThat(me(first).statusCode()).isEqualTo(200);
        assertThat(me(second).statusCode()).isEqualTo(200);
    }

    @Test
    void logoutClearsBrowserCookieButCopiedTokenStillWorks() throws Exception {
        var manager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        try (var browser = HttpClient.newBuilder().cookieHandler(manager).build()) {
            var request = postRequest("/api/auth/login", json.writeValueAsString(Map.of("username", "login_user", "password", PASSWORD)), null);
            var loggedIn = browser.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(loggedIn.statusCode()).isEqualTo(200);
            var copied = token(loggedIn);
            var meRequest = HttpRequest.newBuilder(URI.create(base() + "/api/auth/me")).GET().build();
            assertThat(browser.send(meRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
            var loggedOut = browser.send(postRequest("/api/auth/logout", "", null), HttpResponse.BodyHandlers.ofString());
            assertThat(loggedOut.statusCode()).isEqualTo(204);
            assertThat(loggedOut.body()).isEmpty();
            assertThat(loggedOut.headers().firstValue("Set-Cookie").orElseThrow())
                    .contains(AuthCookies.NAME + "=", "Max-Age=0", "Path=/api", "HttpOnly", "SameSite=Lax");
            assertThat(browser.send(meRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
            assertThat(me(copied).statusCode()).isEqualTo(200);
        }
    }

    @Test
    void logoutIsIdempotentEvenWithBadOrExpiredCookies() throws Exception {
        var expired = tokens.issue(user.getId()).value();
        clock.now = clock.now.plusSeconds(1800);
        for (var value : List.of("", "bad.jwt", expired)) {
            assertThat(post("/api/auth/logout", "", value.isEmpty() ? null : value).statusCode()).isEqualTo(204);
        }
    }

    @Test
    void passwordChangeDoesNotImplicitlyRevokeExistingJwt() throws Exception {
        var value = tokens.issue(user.getId()).value();
        jdbc.update("UPDATE app_users SET password_hash = ? WHERE id = ?", passwords.encode("new-password"), user.getId());
        assertThat(me(value).statusCode()).isEqualTo(200);
        assertError(login("login_user", PASSWORD, null), 401, "INVALID_CREDENTIALS");
        assertThat(login("login_user", "new-password", null).statusCode()).isEqualTo(200);
    }

    @Test
    void loginAndLogoutRequireSourceAndCustomHeader() throws Exception {
        for (var path : List.of("/api/auth/login", "/api/auth/logout")) {
            var noOrigin = HttpRequest.newBuilder(URI.create(base() + path)).header("X-App-Request", "museum-web")
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertError(client.send(noOrigin, HttpResponse.BodyHandlers.ofString()), 403, "REQUEST_FORBIDDEN");
            var noHeader = HttpRequest.newBuilder(URI.create(base() + path)).header("Origin", ORIGIN)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertError(client.send(noHeader, HttpResponse.BodyHandlers.ofString()), 403, "REQUEST_FORBIDDEN");
        }
    }

    @Test
    void loginBodyAndContentTypeAreStrict() throws Exception {
        for (var body : List.of("{}", "{", "null", "{\"username\":1234,\"password\":\"1234\"}",
                "{\"username\":\"login_user\",\"password\":\"1234\",\"email\":\"user@example.com\"}")) {
            assertError(post("/api/auth/login", body, null), 400, "VALIDATION_ERROR");
        }
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/auth/login"))
                .header("Origin", ORIGIN).header("X-App-Request", "museum-web").header("Content-Type", "text/plain")
                .POST(HttpRequest.BodyPublishers.ofString("username=login_user&password=1234")).build();
        assertError(client.send(request, HttpResponse.BodyHandlers.ofString()), 415, "UNSUPPORTED_MEDIA_TYPE");
    }

    @Test
    void crossOriginMeAndPreflightAreSupported() throws Exception {
        var value = tokens.issue(user.getId()).value();
        var meRequest = HttpRequest.newBuilder(URI.create(base() + "/api/auth/me"))
                .header("Origin", ORIGIN).header("Cookie", AuthCookies.NAME + "=" + value).GET().build();
        var response = client.send(meRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(ORIGIN);
        var preflight = HttpRequest.newBuilder(URI.create(base() + "/api/auth/login"))
                .header("Origin", ORIGIN).header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-app-request")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        assertThat(client.send(preflight, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
    }

    private String signed(Consumer<JwtClaimsSet.Builder> customize, MacAlgorithm algorithm) {
        var settings = properties.jwt();
        var key = new SecretKeySpec(Base64.getDecoder().decode(settings.secret()), "HmacSHA256");
        var encoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key));
        var builder = JwtClaimsSet.builder().issuer(settings.issuer()).audience(List.of(settings.audience()))
                .subject(user.getId().toString()).id(UUID.randomUUID().toString()).issuedAt(clock.instant())
                .expiresAt(clock.instant().plusSeconds(1800));
        customize.accept(builder);
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(algorithm).type("JWT").build(), builder.build())).getTokenValue();
    }

    private HttpResponse<String> login(String username, String password, String cookie) throws Exception {
        return post("/api/auth/login", json.writeValueAsString(Map.of("username", username, "password", password)), cookie);
    }
    private HttpResponse<String> post(String path, String body, String cookie) throws Exception {
        return client.send(postRequest(path, body, cookie), HttpResponse.BodyHandlers.ofString());
    }
    private HttpRequest postRequest(String path, String body, String cookie) {
        var request = HttpRequest.newBuilder(URI.create(base() + path)).timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json").header("Origin", ORIGIN).header("X-App-Request", "museum-web");
        if (cookie != null) { request.header("Cookie", AuthCookies.NAME + "=" + cookie); }
        return request.POST(HttpRequest.BodyPublishers.ofString(body)).build();
    }
    private HttpResponse<String> me(String cookie) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/auth/me")).timeout(Duration.ofSeconds(10));
        if (cookie != null) { request.header("Cookie", AuthCookies.NAME + "=" + cookie); }
        return client.send(request.GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    private static String token(HttpResponse<String> response) {
        var value = response.headers().firstValue("Set-Cookie").orElseThrow();
        return value.substring(value.indexOf('=') + 1, value.indexOf(';'));
    }
    private static void assertError(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.body()).contains("\"code\":\"" + code + "\"", "\"requestId\":");
        assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
    }
    private String base() { return "http://127.0.0.1:" + port; }

    @TestConfiguration
    static class TimeConfiguration {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }

    static class MutableClock extends Clock {
        volatile Instant now = Instant.parse("2026-10-28T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
