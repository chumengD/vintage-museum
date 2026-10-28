package cn.digitalmemory.museum.auth;

import java.time.Duration;
import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.config.AuthProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookies {
    public static final String NAME = "museum_access_token";
    private final AuthProperties properties;

    public AuthCookies(AuthProperties properties) { this.properties = properties; }

    public String issue(String token) { return cookie(token, properties.jwt().timeToLive()); }
    public String clear() { return cookie("", Duration.ZERO); }

    public String read(HttpServletRequest request) {
        String value = null;
        if (request.getCookies() == null) { return null; }
        for (var cookie : request.getCookies()) {
            if (NAME.equals(cookie.getName())) {
                if (value != null) { throw new ApiException(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "登录凭据无效，请重新登录"); }
                value = cookie.getValue();
            }
        }
        return value;
    }

    private String cookie(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value).httpOnly(true).secure(properties.secureCookie())
                .sameSite("Lax").path("/api").maxAge(maxAge).build().toString();
    }
}
