package cn.digitalmemory.museum.auth;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.config.AuthProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
    private final AuthProperties.JwtSettings settings;
    private final Clock clock;
    private final NimbusJwtEncoder encoder;
    private final NimbusJwtDecoder decoder;

    public JwtTokenService(AuthProperties properties, Clock clock) {
        this.settings = properties.jwt();
        this.clock = clock;
        var key = new SecretKeySpec(loadSecret(settings), "HmacSHA256");
        encoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(key));
        decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        // 固定本地签发者、接收方和完整时间约束，不从 token 获取密钥或远程 URL。
        decoder.setJwtValidator(this::validateClaims);
    }

    public IssuedToken issue(UUID userId) {
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        var expiresAt = now.plus(settings.timeToLive());
        var claims = JwtClaimsSet.builder().issuer(settings.issuer()).audience(java.util.List.of(settings.audience()))
                .subject(userId.toString()).issuedAt(now).expiresAt(expiresAt).id(UUID.randomUUID().toString()).build();
        var headers = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return new IssuedToken(encoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue(), expiresAt);
    }

    public UUID verify(String token) {
        try {
            return UUID.fromString(decoder.decode(token).getSubject());
        } catch (JwtValidationException exception) {
            if (exception.getErrors().stream().anyMatch(error -> error.getErrorCode().equals("TOKEN_EXPIRED"))) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED", "登录已过期，请重新登录");
            }
            throw invalidToken();
        } catch (JwtException | IllegalArgumentException exception) {
            throw invalidToken();
        }
    }

    private OAuth2TokenValidatorResult validateClaims(Jwt jwt) {
        var now = clock.instant();
        var issuedAt = jwt.getIssuedAt();
        var expiresAt = jwt.getExpiresAt();
        if (!"JWT".equals(jwt.getHeaders().get("typ")) || !settings.issuer().equals(jwt.getClaimAsString("iss"))
                || jwt.getAudience() == null || !jwt.getAudience().contains(settings.audience())
                || !isUuid(jwt.getSubject()) || !isUuid(jwt.getId()) || issuedAt == null || expiresAt == null
                || !expiresAt.isAfter(issuedAt) || issuedAt.isAfter(now)
                || expiresAt.isAfter(issuedAt.plus(settings.timeToLive()))
                || (jwt.getNotBefore() != null && jwt.getNotBefore().isAfter(now))) {
            return failure("TOKEN_INVALID");
        }
        return expiresAt.isAfter(now) ? OAuth2TokenValidatorResult.success() : failure("TOKEN_EXPIRED");
    }

    private static boolean isUuid(String value) {
        if (value == null) { return false; }
        try { return UUID.fromString(value).toString().equals(value); }
        catch (IllegalArgumentException exception) { return false; }
    }

    private static OAuth2TokenValidatorResult failure(String code) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error(code, "JWT validation failed", null));
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "登录凭据无效，请重新登录");
    }

    private static byte[] loadSecret(AuthProperties.JwtSettings settings) {
        String encoded = settings.secret();
        if (encoded == null || encoded.isBlank()) {
            if (settings.secretFile() == null) {
                throw new IllegalStateException("请通过 MUSEUM_JWT_SECRET 配置 Base64 编码的 JWT 密钥");
            }
            var path = settings.secretFile().toAbsolutePath().normalize();
            try {
                Files.createDirectories(path.getParent());
                if (Files.notExists(path)) {
                    var bytes = new byte[32];
                    new SecureRandom().nextBytes(bytes);
                    try {
                        Files.writeString(path, Base64.getEncoder().encodeToString(bytes), StandardCharsets.UTF_8,
                                StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
                    } catch (FileAlreadyExistsException ignored) {
                        // 另一个启动进程已创建，继续读取同一密钥。
                    }
                }
                encoded = Files.readString(path, StandardCharsets.UTF_8).strip();
            } catch (IOException exception) {
                throw new IllegalStateException("无法读取或创建本地开发 JWT 密钥文件", exception);
            }
        }
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(encoded); }
        catch (IllegalArgumentException exception) {
            throw new IllegalStateException("JWT 密钥必须使用 Base64 编码");
        }
        if (bytes.length < 32) { throw new IllegalStateException("JWT 密钥解码后至少需要 32 字节"); }
        return bytes;
    }

    public record IssuedToken(String value, Instant expiresAt) {
        @Override public String toString() { return "IssuedToken[value=<redacted>, expiresAt=" + expiresAt + "]"; }
    }
}
