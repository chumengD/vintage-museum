package cn.digitalmemory.museum.series;

import cn.digitalmemory.museum.auth.RegistrationService;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/series")
public class SeriesController {
    private final SeriesService series;
    private final SeriesIcons icons;
    public SeriesController(SeriesService series, SeriesIcons icons) { this.series = series; this.icons = icons; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SeriesResponse> create(@RequestPart("metadata") SeriesService.CreateRequest request,
            @RequestPart(value = "icon", required = false) MultipartFile icon,
            @AuthenticationPrincipal RegistrationService.UserView user) throws IOException {
        var created = series.create(request, icon, user.id());
        return ResponseEntity.created(URI.create("/api/series/" + created.id())).cacheControl(CacheControl.noStore())
                .body(new SeriesResponse(created));
    }
    @GetMapping
    public SeriesService.Listing list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return series.list(page, size);
    }
    @GetMapping("/{id}")
    public SeriesResponse detail(@PathVariable UUID id) { return new SeriesResponse(series.find(id).view()); }
    @GetMapping(value = "/{id}/icon", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> icon(@PathVariable UUID id) throws IOException {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
                .header("X-Content-Type-Options", "nosniff").body(icons.read(series.find(id).getIconStorageKey()));
    }
    public record SeriesResponse(SoftwareSeries.View series) {}
}
