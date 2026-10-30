package cn.digitalmemory.museum.screenshot;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "version_screenshots")
public class VersionScreenshot {
    @Id private UUID id;
    @Column(name = "version_id", nullable = false) private UUID versionId;
    @Column(name = "storage_key", nullable = false, length = 100) private String storageKey;
    @Column(length = 500) private String caption;
    @Column(nullable = false) private int width;
    @Column(nullable = false) private int height;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected VersionScreenshot() {}
    public VersionScreenshot(UUID versionId, ScreenshotStorage.Stored stored, String caption, UUID userId) {
        this.id = UUID.randomUUID(); this.versionId = versionId; this.storageKey = stored.key();
        this.width = stored.width(); this.height = stored.height(); this.caption = caption;
        this.createdBy = userId; this.createdAt = Instant.now();
    }
    public String getStorageKey() { return storageKey; }
    public View view() { return new View(id, versionId, "/api/screenshots/" + id + "/image", caption, width, height, createdBy, createdAt); }
    public record View(UUID id, UUID versionId, String imageUrl, String caption, int width, int height, UUID createdBy, Instant createdAt) {}
}
