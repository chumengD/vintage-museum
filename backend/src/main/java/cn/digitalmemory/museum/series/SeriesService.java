package cn.digitalmemory.museum.series;

import cn.digitalmemory.museum.common.ApiException;
import java.io.IOException;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class SeriesService {
    private final SeriesRepository series;
    private final SeriesIcons icons;
    private final TransactionTemplate transactions;
    public SeriesService(SeriesRepository series, SeriesIcons icons, TransactionTemplate transactions) {
        this.series = series; this.icons = icons; this.transactions = transactions;
    }
    public SoftwareSeries.View create(CreateRequest request, MultipartFile icon, UUID user) throws IOException {
        var errors = new LinkedHashMap<String, String>();
        String name = request.name() == null ? "" : request.name().strip();
        String description = request.description() == null ? "" : request.description().strip();
        if (name.isEmpty() || name.length() > 100) errors.put("name", "系列名称须为 1～100 字");
        if (description.isEmpty() || description.length() > 1000) errors.put("description", "简介须为 1～1000 字");
        if (!Set.of("INSTANT_MESSAGING", "BROWSER", "MEDIA", "OTHER").contains(Objects.toString(request.category(), "")))
            errors.put("category", "请选择有效的软件分类");
        var platforms = request.platforms();
        if (platforms == null || platforms.isEmpty() || platforms.size() > 6
                || platforms.stream().anyMatch(p -> p == null || !Set.of("WINDOWS", "ANDROID", "IOS", "MACOS", "LINUX", "OTHER").contains(p))
                || new HashSet<>(platforms).size() != platforms.size()) errors.put("platforms", "请选择不重复的有效平台");
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "请检查输入字段", errors);
        String key = icons.save(icon);
        try {
            return transactions.execute(status -> series.saveAndFlush(new SoftwareSeries(name, description,
                    request.category(), new HashSet<>(platforms), key, user)).view());
        } catch (RuntimeException failure) {
            try { icons.delete(key); } catch (IOException cleanup) { failure.addSuppressed(cleanup); }
            if (failure instanceof DataIntegrityViolationException && series.existsByNormalizedName(name.toLowerCase(Locale.ROOT))) {
                throw new ApiException(HttpStatus.CONFLICT, "SERIES_ALREADY_EXISTS", "同名系列已存在");
            }
            throw failure;
        }
    }
    public SoftwareSeries find(UUID id) {
        return series.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERIES_NOT_FOUND", "系列不存在"));
    }
    public Listing list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "page 须大于等于 0，size 须为 1～100");
        var result = series.findAll(PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new Listing(result.map(SoftwareSeries::view).getContent(), page, size, result.getTotalElements(), result.getTotalPages());
    }
    public record CreateRequest(String name, String description, String category, List<String> platforms) {}
    public record Listing(List<SoftwareSeries.View> items, int page, int size, long totalElements, int totalPages) {}
}
