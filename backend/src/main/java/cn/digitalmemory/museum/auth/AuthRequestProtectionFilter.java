package cn.digitalmemory.museum.auth;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import cn.digitalmemory.museum.common.ApiErrorWriter;
import cn.digitalmemory.museum.config.RegistrationProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

public class AuthRequestProtectionFilter extends OncePerRequestFilter {
    private static final Set<String> ENDPOINTS = Set.of("/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/auth/me");
    private final RegistrationProperties properties;
    private final IpRateLimiter registrationLimiter;
    private final IpRateLimiter loginLimiter;
    private final ApiErrorWriter errors;

    public AuthRequestProtectionFilter(RegistrationProperties properties, IpRateLimiter registrationLimiter,
                                        IpRateLimiter loginLimiter, ApiErrorWriter errors) {
        this.properties = properties;
        this.registrationLimiter = registrationLimiter;
        this.loginLimiter = loginLimiter;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !(ENDPOINTS.contains(request.getServletPath()) || BusinessRequestPaths.isCreatePath(request.getServletPath()))
                || !(request.getMethod().equals("POST") || request.getMethod().equals("OPTIONS"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var origin = request.getHeader("Origin");
        boolean allowedOrigin = origin != null && properties.allowedOrigins().contains(origin);
        if (!allowedOrigin
                || (request.getMethod().equals("POST")
                    && !"museum-web".equals(request.getHeader("X-App-Request")))) {
            if (allowedOrigin) { allowErrorResponse(origin, response); }
            errors.write(response, 403, "REQUEST_FORBIDDEN", "请求来源或必要请求头不合法", Map.of());
            return;
        }
        if (request.getMethod().equals("POST") && Set.of("/api/auth/register", "/api/auth/login").contains(request.getServletPath())) {
            // 不采信任意客户端可伪造的 X-Forwarded-For。
            boolean login = request.getServletPath().equals("/api/auth/login");
            var decision = (login ? loginLimiter : registrationLimiter).acquire(request.getRemoteAddr());
            if (!decision.allowed()) {
                allowErrorResponse(origin, response);
                response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
                errors.write(response, 429, login ? "LOGIN_RATE_LIMITED" : "REGISTER_RATE_LIMITED",
                        "请求过于频繁，请稍后重试", Map.of());
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void allowErrorResponse(String origin, HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Retry-After");
        response.addHeader("Vary", "Origin");
    }
}
