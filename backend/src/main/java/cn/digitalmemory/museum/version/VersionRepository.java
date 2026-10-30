package cn.digitalmemory.museum.version;

import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VersionRepository extends JpaRepository<SoftwareVersion, UUID> {
    Page<SoftwareVersion> findBySeriesId(UUID seriesId, Pageable pageable);
    Page<SoftwareVersion> findBySeriesIdAndPlatform(UUID seriesId, String platform, Pageable pageable);
    boolean existsBySeriesIdAndPlatformAndNormalizedNumber(UUID seriesId, String platform, String normalizedNumber);
}
