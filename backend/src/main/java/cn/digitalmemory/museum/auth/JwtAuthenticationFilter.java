package cn.digitalmemory.museum.auth;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import cn.digitalmemory.museum.common.ApiErrorWriter;
import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.user.User;
import cn.digitalmemory.museum.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService tokens;
    private final AuthCookies cookies;
    private final UserRepository users;
    private final ApiErrorWriter errors;

    public JwtAuthenticationFilter(JwtTokenService tokens, AuthCookies cookies, UserRepository users, ApiErrorWriter errors) {
        this.tokens = tokens;
        this.cookies = cookies;
        this.users = users;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // 登录、注册忽略旧 Cookie；退出即使凭据失效也允许清理。
        return !request.getMethod().equals("GET") || !request.getServletPath().equals("/api/auth/me");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            var value = cookies.read(request);
            if (value != null) {
                var id = tokens.verify(value);
                var user = users.findById(id).filter(found -> found.getStatus() == User.Status.ACTIVE).orElse(null);
                if (user == null) {
                    throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "AUTH_INVALID", "账号已失效，请重新登录");
                }
                var principal = new RegistrationService.UserView(user.getId(), user.getUsername(), user.getEmail());
                SecurityContextHolder.getContext().setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of()));
            }
        } catch (ApiException exception) {
            errors.write(response, exception.status().value(), exception.code(), exception.getMessage(), exception.fieldErrors());
            return;
        } catch (DataAccessException exception) {
            var requestId = errors.write(response, 500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试", Map.of());
            logger.error("Authentication database failure, requestId=" + requestId);
            return;
        }
        chain.doFilter(request, response);
    }
}
