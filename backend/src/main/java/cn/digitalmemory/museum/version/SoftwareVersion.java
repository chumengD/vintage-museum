package cn.digitalmemory.museum.version;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;

@Entity
@Table(name = "software_versions")
public class SoftwareVersion {
    @Id private UUID id;
    @Column(name = "series_id", nullable = false) private UUID seriesId;
    @Column(name = "version_number", nullable = false, length = 100) private String versionNumber;
    @Column(name = "normalized_number", nullable = false, length = 200) private String normalizedNumber;
    @Column(nullable = false, length = 32) private String platform;
    @Column(name = "release_date") private LocalDate releaseDate;
    @Column(length = 5000) private String description;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected SoftwareVersion() {}
    public SoftwareVersion(UUID seriesId, String versionNumber, String platform, LocalDate releaseDate,
                           String description, UUID createdBy) {
        this.id = UUID.randomUUID(); this.seriesId = seriesId; this.versionNumber = versionNumber;
        this.normalizedNumber = versionNumber.toLowerCase(Locale.ROOT); this.platform = platform;
        this.releaseDate = releaseDate; this.description = description; this.createdBy = createdBy;
        this.createdAt = Instant.now(); this.updatedAt = createdAt;
    }
    public UUID getSeriesId() { return seriesId; }
    public void markUpdated() { updatedAt = Instant.now(); }
    public View view() {
        return new View(id, seriesId, versionNumber, platform, releaseDate, description, createdBy, createdAt, updatedAt);
    }
    public record View(UUID id, UUID seriesId, String versionNumber, String platform, LocalDate releaseDate,
                       String description, UUID createdBy, Instant createdAt, Instant updatedAt) {}
}
