package cn.digitalmemory.museum.auth;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import cn.digitalmemory.museum.config.AuthProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtConfigurationTests {
    @TempDir Path directory;

    @Test
    void devKeyIsRandomAndPersistsAcrossServiceRecreation() throws Exception {
        var path = directory.resolve("jwt-secret.key");
        var properties = settings("", path, false);
        var first = new JwtTokenService(properties, Clock.systemUTC());
        var id = UUID.randomUUID();
        var token = first.issue(id).value();
        var fileValue = Files.readString(path);
        assertThat(Base64.getDecoder().decode(fileValue)).hasSize(32);
        var second = new JwtTokenService(properties, Clock.systemUTC());
        assertThat(second.verify(token)).isEqualTo(id);
        assertThat(Files.readString(path)).isEqualTo(fileValue);
    }

    @Test
    void missingMalformedOrShortDeploymentSecretsFailImmediately() {
        for (var secret : new String[]{"", "not base64!", Base64.getEncoder().encodeToString(new byte[8])}) {
            assertThatThrownBy(() -> new JwtTokenService(settings(secret, null, true), Clock.systemUTC()))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    void secureCookieAndClearCookieHaveSameScopeAndSecurityAttributes() {
        var cookies = new AuthCookies(settings("unused", null, true));
        assertThat(cookies.issue("example")).contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/api", "Max-Age=1800")
                .doesNotContain("Domain=");
        assertThat(cookies.clear()).contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/api", "Max-Age=0");
    }

    private AuthProperties settings(String secret, Path file, boolean secure) {
        return new AuthProperties(secure, 10, 100,
                new AuthProperties.JwtSettings("museum", "museum-api", Duration.ofMinutes(30), secret, file));
    }
}
