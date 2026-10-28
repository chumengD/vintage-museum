package cn.digitalmemory.museum.auth;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class RegistrationController {
    private final RegistrationService registrations;

    public RegistrationController(RegistrationService registrations) { this.registrations = registrations; }

    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<RegisterResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(new RegisterResponse(registrations.register(request)));
    }

    public record RegisterResponse(RegistrationService.UserView user) {}
}
