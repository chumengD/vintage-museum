package cn.digitalmemory.museum.screenshot;

import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.series.SeriesService;
import cn.digitalmemory.museum.version.*;
import java.io.IOException;
import java.util.*;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ScreenshotService {
    private final ScreenshotRepository screenshots;
    private final VersionRepository versions;
    private final SeriesService series;
    private final ScreenshotStorage storage;
    private final TransactionTemplate transactions;
    public ScreenshotService(ScreenshotRepository screenshots, VersionRepository versions, SeriesService series,
                             ScreenshotStorage storage, TransactionTemplate transactions) {
        this.screenshots = screenshots; this.versions = versions; this.series = series;
        this.storage = storage; this.transactions = transactions;
    }
    private SoftwareVersion version(UUID id) {
        return versions.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VERSION_NOT_FOUND", "版本不存在"));
    }
    public VersionScreenshot.View upload(UUID versionId, MultipartFile image, String caption, UUID userId) throws IOException {
        version(versionId);
        String text = caption == null ? null : caption.strip();
        if (text != null && text.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "截图说明最多 500 字符", Map.of("caption", "截图说明最多 500 字符"));
        var stored = storage.save(image);
        var record = new VersionScreenshot(versionId, stored, text == null || text.isEmpty() ? null : text, userId);
        try {
            return transactions.execute(status -> {
                var parentVersion = version(versionId);
                var parentSeries = series.find(parentVersion.getSeriesId());
                var saved = screenshots.saveAndFlush(record);
                parentVersion.markUpdated(); parentSeries.markUpdated();
                return saved.view();
            });
        } catch (RuntimeException e) {
            try { storage.delete(stored.key()); } catch (IOException cleanup) { e.addSuppressed(cleanup); }
            throw e;
        }
    }
    public Listing list(UUID versionId, int page, int size) {
        version(versionId);
        if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "page 须大于等于 0，size 须为 1～100");
        var result = screenshots.findByVersionId(versionId, PageRequest.of(page, size, Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"))));
        return new Listing(result.map(VersionScreenshot::view).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }
    public Resource image(UUID id) {
        var record = screenshots.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCREENSHOT_NOT_FOUND", "截图不存在"));
        return storage.read(record.getStorageKey());
    }
    public record Listing(List<VersionScreenshot.View> items, int page, int size, long totalElements, int totalPages) {}
}
