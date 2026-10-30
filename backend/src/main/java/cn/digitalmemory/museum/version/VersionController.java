package cn.digitalmemory.museum.version;

import cn.digitalmemory.museum.auth.RegistrationService;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class VersionController {
    private final VersionService versions;
    public VersionController(VersionService versions) { this.versions = versions; }
    @PostMapping(value = "/api/series/{seriesId}/versions", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<VersionResponse> create(@PathVariable UUID seriesId, @RequestBody VersionService.CreateRequest request,
            @AuthenticationPrincipal RegistrationService.UserView user) {
        var created = versions.create(seriesId, request, user.id());
        return ResponseEntity.created(URI.create("/api/versions/" + created.id())).cacheControl(CacheControl.noStore())
                .body(new VersionResponse(created));
    }
    @GetMapping("/api/series/{seriesId}/versions")
    public VersionService.Listing list(@PathVariable UUID seriesId, @RequestParam(required = false) String platform,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return versions.list(seriesId, platform, page, size);
    }
    @GetMapping("/api/versions/{id}")
    public VersionService.Detail detail(@PathVariable UUID id) { return versions.detail(id); }
    public record VersionResponse(SoftwareVersion.View version) {}
}
