package cn.digitalmemory.museum.config;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import cn.digitalmemory.museum.auth.AuthCookies;
import cn.digitalmemory.museum.auth.BusinessRequestPaths;
import cn.digitalmemory.museum.auth.AuthRequestProtectionFilter;
import cn.digitalmemory.museum.auth.IpRateLimiter;
import cn.digitalmemory.museum.auth.JwtAuthenticationFilter;
import cn.digitalmemory.museum.auth.JwtTokenService;
import cn.digitalmemory.museum.common.ApiErrorWriter;
import cn.digitalmemory.museum.user.UserRepository;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.savedrequest.NullRequestCache;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({RegistrationProperties.class, AuthProperties.class})
public class SecurityConfig {
    @Bean
    Clock authClock() { return Clock.systemUTC(); }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, RegistrationProperties properties,
                                            AuthProperties auth, Clock clock, JwtTokenService tokens,
                                            AuthCookies cookies, UserRepository users, ApiErrorWriter errors) throws Exception {
        var cors = new CorsConfiguration();
        cors.setAllowedOrigins(properties.allowedOrigins());
        cors.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Content-Type", "X-App-Request"));
        cors.setExposedHeaders(List.of("X-Request-Id", "Retry-After"));
        cors.setAllowCredentials(true);
        var corsSource = new UrlBasedCorsConfigurationSource();
        for (var path : List.of("/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout")) {
            corsSource.registerCorsConfiguration(path, cors);
        }
        corsSource.registerCorsConfiguration("/api/series", cors);
        corsSource.registerCorsConfiguration("/api/series/**", cors);
        corsSource.registerCorsConfiguration("/api/versions/*", cors);
        corsSource.registerCorsConfiguration("/api/versions/*/screenshots", cors);
        corsSource.registerCorsConfiguration("/api/screenshots/*/image", cors);

        var publicPosts = List.of("/api/auth/register", "/api/auth/login", "/api/auth/logout");
        RequestMatcher protectedPosts = request -> request.getMethod().equals("POST")
                && (publicPosts.contains(request.getServletPath()) || BusinessRequestPaths.isCreatePath(request.getServletPath()));
        var registrationLimiter = new IpRateLimiter(properties.requestsPerMinute(), properties.maxTrackedClients(), clock);
        var loginLimiter = new IpRateLimiter(auth.requestsPerMinute(), auth.maxTrackedClients(), clock);
        return http
                .cors(config -> config.configurationSource(corsSource))
                // 认证及业务创建 POST 由前置 Origin + 自定义头检查防护，其余保留默认 CSRF 检查。
                .csrf(config -> config.ignoringRequestMatchers(protectedPosts))
                .addFilterBefore(new AuthRequestProtectionFilter(properties, registrationLimiter, loginLimiter, errors), CorsFilter.class)
                .addFilterBefore(new JwtAuthenticationFilter(tokens, cookies, users, errors), AnonymousAuthenticationFilter.class)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(config -> config.requestCache(new NullRequestCache()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/auth/register", "/api/auth/login", "/api/auth/logout", "/api/auth/me").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/series").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/series/*/versions").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/versions/*/screenshots").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/versions/*/screenshots", "/api/screenshots/*/image").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/versions/*/screenshots", "/api/screenshots/*/image").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/series/*/versions", "/api/versions/*").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/versions/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/series", "/api/series/*", "/api/series/*/icon").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/series", "/api/series/**").permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(config -> config
                        .authenticationEntryPoint((request, response, exception) ->
                                errors.write(response, 401, "AUTH_REQUIRED", "请先登录", Map.of()))
                        .accessDeniedHandler((request, response, exception) ->
                                errors.write(response, 403, "REQUEST_FORBIDDEN", "请求被拒绝", Map.of())))
                .build();
    }
}
