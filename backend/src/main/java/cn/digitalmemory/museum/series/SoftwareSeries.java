package cn.digitalmemory.museum.series;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "software_series")
public class SoftwareSeries {
    @Id private UUID id;
    @Column(nullable = false, length = 100) private String name;
    @Column(name = "normalized_name", nullable = false, length = 200) private String normalizedName;
    @Column(nullable = false, length = 1000) private String description;
    @Column(nullable = false, length = 32) private String category;
    @Column(name = "icon_storage_key", length = 100) private String iconStorageKey;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "software_series_platforms", joinColumns = @JoinColumn(name = "series_id"))
    @Column(name = "platform", nullable = false, length = 32)
    private Set<String> platforms = new HashSet<>();

    protected SoftwareSeries() {}
    public SoftwareSeries(String name, String description, String category, Set<String> platforms,
                          String iconStorageKey, UUID createdBy) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.normalizedName = name.toLowerCase(Locale.ROOT);
        this.description = description;
        this.category = category;
        this.platforms = new HashSet<>(platforms);
        this.iconStorageKey = iconStorageKey;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }
    public UUID getId() { return id; }
    public void markUpdated() { updatedAt = Instant.now(); }
    public String getIconStorageKey() { return iconStorageKey; }
    public View view() {
        return new View(id, name, description, category, platforms.stream().sorted().toList(),
                iconStorageKey == null ? null : "/api/series/" + id + "/icon", createdBy, createdAt, updatedAt);
    }
    public record View(UUID id, String name, String description, String category, List<String> platforms,
                       String iconUrl, UUID createdBy, Instant createdAt, Instant updatedAt) {}
}
