package cn.digitalmemory.museum.auth;

import java.time.Instant;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final LoginService logins;
    private final JwtTokenService tokens;
    private final AuthCookies cookies;

    public AuthController(LoginService logins, JwtTokenService tokens, AuthCookies cookies) {
        this.logins = logins;
        this.tokens = tokens;
        this.cookies = cookies;
    }

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        var user = logins.login(request);
        var issued = tokens.issue(user.id());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, cookies.issue(issued.value()))
                .body(new LoginResponse(user, issued.expiresAt()));
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me(@AuthenticationPrincipal RegistrationService.UserView user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new CurrentUserResponse(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, cookies.clear()).build();
    }

    public record LoginResponse(RegistrationService.UserView user, Instant expiresAt) {}
    public record CurrentUserResponse(RegistrationService.UserView user) {}
}
