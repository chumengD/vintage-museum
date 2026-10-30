package cn.digitalmemory.museum.version;

import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.series.SeriesService;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class VersionService {
    private static final Set<String> PLATFORMS = Set.of("WINDOWS", "ANDROID", "IOS", "MACOS", "LINUX", "OTHER");
    private final VersionRepository versions;
    private final SeriesService series;
    private final TransactionTemplate transactions;
    public VersionService(VersionRepository versions, SeriesService series, TransactionTemplate transactions) {
        this.versions = versions; this.series = series; this.transactions = transactions;
    }
    public SoftwareVersion.View create(UUID seriesId, CreateRequest request, UUID userId) {
        var parent = series.find(seriesId).view();
        var errors = new LinkedHashMap<String, String>();
        String number = request.versionNumber() == null ? "" : request.versionNumber().strip();
        if (number.isEmpty() || number.length() > 100) errors.put("versionNumber", "版本号须为 1～100 字符");
        if (request.platform() == null || !parent.platforms().contains(request.platform()))
            errors.put("platform", "请选择所属系列支持的平台");
        String description = request.description() == null ? null : request.description().strip();
        if (description != null && description.length() > 5000) errors.put("description", "版本说明最多 5000 字符");
        LocalDate releaseDate = null;
        if (request.releaseDate() != null) {
            try {
                if (!request.releaseDate().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new DateTimeParseException("format", "", 0);
                releaseDate = LocalDate.parse(request.releaseDate());
                if (releaseDate.getYear() < 1) throw new DateTimeParseException("year", "", 0);
            } catch (DateTimeParseException e) { errors.put("releaseDate", "发布日期须为真实日期 YYYY-MM-DD，未知时省略或传 null"); }
        }
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "请检查输入字段", errors);
        var record = new SoftwareVersion(seriesId, number, request.platform(), releaseDate,
                description == null || description.isEmpty() ? null : description, userId);
        try {
            return transactions.execute(status -> {
                var managedParent = series.find(seriesId);
                var saved = versions.saveAndFlush(record);
                managedParent.markUpdated();
                return saved.view();
            });
        } catch (DataIntegrityViolationException e) {
            if (versions.existsBySeriesIdAndPlatformAndNormalizedNumber(seriesId, request.platform(), number.toLowerCase(Locale.ROOT)))
                throw new ApiException(HttpStatus.CONFLICT, "VERSION_ALREADY_EXISTS", "该系列同平台的同名版本已存在");
            throw e;
        }
    }
    public Detail detail(UUID id) {
        var record = versions.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VERSION_NOT_FOUND", "版本不存在"));
        var parent = series.find(record.getSeriesId()).view();
        return new Detail(record.view(), new SeriesSummary(parent.id(), parent.name(), parent.iconUrl()));
    }
    public Listing list(UUID seriesId, String platform, int page, int size) {
        series.find(seriesId);
        if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "page 须大于等于 0，size 须为 1～100");
        if (platform != null && !PLATFORMS.contains(platform)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "平台代码不合法");
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        var result = platform == null ? versions.findBySeriesId(seriesId, pageable) : versions.findBySeriesIdAndPlatform(seriesId, platform, pageable);
        return new Listing(result.map(SoftwareVersion::view).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }
    public record CreateRequest(String versionNumber, String platform, String releaseDate, String description) {}
    public record SeriesSummary(UUID id, String name, String iconUrl) {}
    public record Detail(SoftwareVersion.View version, SeriesSummary series) {}
    public record Listing(List<SoftwareVersion.View> items, int page, int size, long totalElements, int totalPages) {}
}
