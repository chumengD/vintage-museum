package cn.digitalmemory.museum.screenshot;

import cn.digitalmemory.museum.auth.RegistrationService;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ScreenshotController {
    private final ScreenshotService screenshots;
    public ScreenshotController(ScreenshotService screenshots) { this.screenshots = screenshots; }
    @PostMapping(value = "/api/versions/{versionId}/screenshots", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ScreenshotResponse> upload(@PathVariable UUID versionId, @RequestPart("image") MultipartFile image,
            @RequestParam(required = false) String caption, @AuthenticationPrincipal RegistrationService.UserView user) throws IOException {
        var created = screenshots.upload(versionId, image, caption, user.id());
        return ResponseEntity.created(URI.create(created.imageUrl())).cacheControl(CacheControl.noStore()).body(new ScreenshotResponse(created));
    }
    @GetMapping("/api/versions/{versionId}/screenshots")
    public ScreenshotService.Listing list(@PathVariable UUID versionId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return screenshots.list(versionId, page, size); }
    @GetMapping(value = "/api/screenshots/{id}/image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<Resource> image(@PathVariable UUID id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("X-Content-Type-Options", "nosniff").body(screenshots.image(id));
    }
    public record ScreenshotResponse(VersionScreenshot.View screenshot) {}
}
