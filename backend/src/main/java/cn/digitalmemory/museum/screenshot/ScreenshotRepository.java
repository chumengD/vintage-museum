package cn.digitalmemory.museum.screenshot;

import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScreenshotRepository extends JpaRepository<VersionScreenshot, UUID> {
    Page<VersionScreenshot> findByVersionId(UUID versionId, Pageable pageable);
}
