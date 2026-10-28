package cn.digitalmemory.museum.config;

import java.nio.file.Path;
import java.time.Duration;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("museum.auth")
public record AuthProperties(boolean secureCookie, @Min(1) int requestsPerMinute,
                             @Min(1) int maxTrackedClients, @Valid @NotNull JwtSettings jwt) {
    public record JwtSettings(@NotBlank String issuer, @NotBlank String audience,
                              @NotNull Duration timeToLive, String secret, Path secretFile) {
        public JwtSettings {
            if (timeToLive != null && (timeToLive.isNegative() || timeToLive.isZero()
                    || timeToLive.getNano() != 0)) {
                throw new IllegalArgumentException("JWT 有效期必须为正整数秒");
            }
        }

        @Override
        public String toString() {
            return "JwtSettings[issuer=" + issuer + ", audience=" + audience + ", secret=<redacted>]";
        }
    }
}
