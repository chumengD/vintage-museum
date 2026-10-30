package cn.digitalmemory.museum.series;

import cn.digitalmemory.museum.common.ApiException;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class SeriesIcons {
    private final Path root;
    public SeriesIcons(@Value("${museum.storage.series-icons:./data/uploads/series-icons}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }
    public String save(MultipartFile file) throws IOException {
        if (file == null) return null;
        if (file.getSize() > 2 * 1024 * 1024) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "UPLOAD_TOO_LARGE", "图标不能超过 2 MiB");
        }
        if (file.isEmpty()) {
            throw invalid("图标须为非空 PNG 或 JPEG，大小不超过 2 MiB");
        }
        byte[] encoded;
        // 检查真实格式、尺寸并重新编码，丢弃原文件名及附带数据。
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid("图标必须为有效 PNG 或 JPEG 图片");
            var reader = readers.next();
            try {
                reader.setInput(input);
                var format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("png", "jpeg", "jpg").contains(format)) throw invalid("仅支持 PNG 和 JPEG");
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 2048 || height > 2048) throw invalid("图标宽高须为 1～2048 像素");
                var output = new ByteArrayOutputStream();
                ImageIO.write(reader.read(0), "png", output);
                encoded = output.toByteArray();
            } finally { reader.dispose(); }
        } catch (ApiException e) { throw e; }
        catch (IOException | RuntimeException e) { throw invalid("无法解码图标图片"); }
        Files.createDirectories(root);
        String key = UUID.randomUUID() + ".png";
        try { Files.write(root.resolve(key), encoded, StandardOpenOption.CREATE_NEW); }
        catch (IOException e) { Files.deleteIfExists(root.resolve(key)); throw e; }
        return key;
    }
    public byte[] read(String key) throws IOException {
        if (key == null || !Files.isRegularFile(root.resolve(key))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ICON_NOT_FOUND", "系列暂无图标");
        }
        return Files.readAllBytes(root.resolve(key));
    }
    public void delete(String key) throws IOException { if (key != null) Files.deleteIfExists(root.resolve(key)); }
    private ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, Map.of("icon", message));
    }
}
