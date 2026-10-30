package cn.digitalmemory.museum.screenshot;

import cn.digitalmemory.museum.common.ApiException;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class ScreenshotStorage {
    private final Path root;
    public ScreenshotStorage(@Value("${museum.storage.screenshots:./data/uploads/version-screenshots}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }
    public Stored save(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw invalid("请选择非空截图文件");
        if (file.getSize() > 5 * 1024 * 1024) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "UPLOAD_TOO_LARGE", "截图不能超过 5 MiB");
        byte[] encoded;
        int width, height;
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid("截图必须为真实 PNG 或 JPEG 图片");
            var reader = readers.next();
            try {
                reader.setInput(input);
                if (!Set.of("png", "jpeg", "jpg").contains(reader.getFormatName().toLowerCase(Locale.ROOT)))
                    throw invalid("截图仅支持 PNG 或 JPEG");
                width = reader.getWidth(0); height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 8192 || height > 8192 || (long) width * height > 20_000_000)
                    throw invalid("截图宽高不能超过 8192 像素，总像素不能超过 2000 万");
                var output = new ByteArrayOutputStream();
                if (!ImageIO.write(reader.read(0), "png", output)) throw invalid("无法编码截图");
                encoded = output.toByteArray();
            } finally { reader.dispose(); }
        } catch (ApiException e) { throw e; }
        catch (IOException | RuntimeException e) { throw invalid("无法解码截图图片"); }
        Files.createDirectories(root);
        String key = UUID.randomUUID() + ".png";
        try { Files.write(root.resolve(key), encoded, StandardOpenOption.CREATE_NEW); }
        catch (IOException e) {
            try { Files.deleteIfExists(root.resolve(key)); } catch (IOException cleanup) { e.addSuppressed(cleanup); }
            throw e;
        }
        return new Stored(key, width, height);
    }
    public Resource read(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.getParent().equals(root) || !Files.isRegularFile(path))
            throw new ApiException(HttpStatus.NOT_FOUND, "SCREENSHOT_NOT_FOUND", "截图文件不存在");
        return new FileSystemResource(path);
    }
    public void delete(String key) throws IOException { Files.deleteIfExists(root.resolve(key)); }
    private ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, Map.of("image", message)); }
    public record Stored(String key, int width, int height) {}
}
