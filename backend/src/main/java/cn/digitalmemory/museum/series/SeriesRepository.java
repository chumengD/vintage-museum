package cn.digitalmemory.museum.series;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesRepository extends JpaRepository<SoftwareSeries, UUID> {
    boolean existsByNormalizedName(String normalizedName);
}
