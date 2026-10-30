package cn.digitalmemory.museum.screenshot;

import cn.digitalmemory.museum.auth.JwtTokenService;
import cn.digitalmemory.museum.series.*;
import cn.digitalmemory.museum.version.*;
import cn.digitalmemory.museum.user.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:screenshot-test;DB_CLOSE_DELAY=-1",
    "museum.storage.screenshots=./target/test-screenshots"})
class ScreenshotTests {
    @Value("${local.server.port}") int port;
    @Autowired ScreenshotRepository screenshots;
    @Autowired ScreenshotService service;
    @Autowired VersionRepository versions;
    @Autowired SeriesRepository series;
    @Autowired UserRepository users;
    @Autowired JwtTokenService tokens;
    @Autowired ObjectMapper json;
    HttpClient client;
    UUID versionId, seriesId, userId;
    String cookie;
    @BeforeEach void setup() {
        client = HttpClient.newHttpClient();
        screenshots.deleteAll(); versions.deleteAll(); series.deleteAll(); users.deleteAll();
        userId = users.saveAndFlush(new User("screenshot_tester", "test-hash", null)).getId();
        cookie = "museum_access_token=" + tokens.issue(userId).value();
        seriesId = series.saveAndFlush(new SoftwareSeries("QQ", "简介", "OTHER", Set.of("WINDOWS"), null, userId)).getId();
        versionId = versions.saveAndFlush(new SoftwareVersion(seriesId, "1.2", "WINDOWS", null, null, userId)).view().id();
    }
    @AfterEach void close() { client.close(); }
    byte[] image(String format, int width, int height) throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, bytes);
        return bytes.toByteArray();
    }
    String path() { return "/api/versions/" + versionId + "/screenshots"; }
    HttpRequest.Builder request(String path) { return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)); }
    HttpResponse<byte[]> upload(String path, byte[] image, String caption, String credential, boolean protect) throws Exception {
        var bytes = new ByteArrayOutputStream();
        if (image != null) {
            bytes.write("--shot\r\nContent-Disposition: form-data; name=\"image\"; filename=\"../../original.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            bytes.write(image); bytes.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        if (caption != null) bytes.write(("--shot\r\nContent-Disposition: form-data; name=\"caption\"\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + caption + "\r\n").getBytes(StandardCharsets.UTF_8));
        bytes.write("--shot--\r\n".getBytes(StandardCharsets.UTF_8));
        var req = request(path).header("Content-Type", "multipart/form-data; boundary=shot");
        if (credential != null) req.header("Cookie", credential);
        if (protect) req.header("Origin", "http://127.0.0.1:5173").header("X-App-Request", "museum-web");
        return client.send(req.POST(HttpRequest.BodyPublishers.ofByteArray(bytes.toByteArray())).build(), HttpResponse.BodyHandlers.ofByteArray());
    }
    HttpResponse<byte[]> upload(byte[] image, String caption) throws Exception { return upload(path(), image, caption, cookie, true); }
    HttpResponse<byte[]> get(String path) throws Exception {
        return client.send(request(path).header("Cookie", "museum_access_token=broken").GET().build(), HttpResponse.BodyHandlers.ofByteArray());
    }
    @Test void uploadsMultipleAndBrowsesOriginalDimensionsWithCaptionAndUpdatesParents() throws Exception {
        var beforeVersion = versions.findById(versionId).orElseThrow().view().updatedAt();
        var beforeSeries = series.findById(seriesId).orElseThrow().view().updatedAt();
        var response = upload(image("png", 30, 20), " 登录界面 ");
        assertThat(response.statusCode()).isEqualTo(201);
        var shot = json.readTree(response.body()).get("screenshot");
        assertThat(shot.get("caption").asText()).isEqualTo("登录界面");
        assertThat(shot.get("versionId").asText()).isEqualTo(versionId.toString());
        assertThat(shot.get("createdBy").asText()).isEqualTo(userId.toString());
        var read = get(shot.get("imageUrl").asText());
        assertThat(read.statusCode()).isEqualTo(200);
        assertThat(read.headers().firstValue("Content-Type")).contains("image/png");
        assertThat(ImageIO.read(new ByteArrayInputStream(read.body())).getWidth()).isEqualTo(30);
        assertThat(upload(image("jpeg", 40, 10), null).statusCode()).isEqualTo(201);
        var page = json.readTree(get(path() + "?size=1").body());
        assertThat(page.get("totalElements").asInt()).isEqualTo(2);
        assertThat(page.get("items").get(0).get("id").asText()).isEqualTo(shot.get("id").asText());
        assertThat(json.readTree(get(path() + "?size=1&page=1").body()).get("items").get(0).get("caption").isNull()).isTrue();
        assertThat(versions.findById(versionId).orElseThrow().view().updatedAt()).isAfter(beforeVersion);
        assertThat(series.findById(seriesId).orElseThrow().view().updatedAt()).isAfter(beforeSeries);
    }
    @Test void rejectsInvalidFilesCaptionAndDimensions() throws Exception {
        assertThat(upload(new byte[0], null).statusCode()).isEqualTo(400);
        assertThat(upload("fake".getBytes(), null).statusCode()).isEqualTo(400);
        assertThat(upload(image("gif", 1, 1), null).statusCode()).isEqualTo(400);
        assertThat(upload(image("png", 8193, 1), null).statusCode()).isEqualTo(400);
        assertThat(upload(image("png", 5000, 4001), null).statusCode()).isEqualTo(400);
        assertThat(upload(image("png", 1, 1), "x".repeat(501)).statusCode()).isEqualTo(400);
        assertThat(upload(new byte[5 * 1024 * 1024 + 1], null).statusCode()).isEqualTo(413);
        assertThat(upload(null, "missing image").statusCode()).isEqualTo(400);
        assertThat(screenshots.count()).isZero();
    }
    @Test void protectsUploadsAndSupportsPreflight() throws Exception {
        var image = image("png", 1, 1);
        assertThat(upload(path(), image, null, null, true).statusCode()).isEqualTo(401);
        assertThat(upload(path(), image, null, cookie, false).statusCode()).isEqualTo(403);
        assertThat(upload(path(), image, null, "museum_access_token=broken", true).statusCode()).isEqualTo(401);
        var response = client.send(request(path()).header("Origin", "http://127.0.0.1:5173")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type,x-app-request")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).contains("true");
    }
    @Test void checksMissingResourcesAndPaginationAndVersionIsolation() throws Exception {
        assertThat(json.readTree(get(path()).body()).get("totalElements").asInt()).isZero();
        assertThat(get(path() + "?size=101").statusCode()).isEqualTo(400);
        assertThat(get(path() + "?page=-1").statusCode()).isEqualTo(400);
        String missing = "/api/versions/" + UUID.randomUUID() + "/screenshots";
        assertThat(get(missing).statusCode()).isEqualTo(404);
        assertThat(upload(missing, image("png", 1, 1), null, cookie, true).statusCode()).isEqualTo(404);
        assertThat(get("/api/screenshots/" + UUID.randomUUID() + "/image").statusCode()).isEqualTo(404);
        assertThat(get("/api/screenshots/invalid/image").statusCode()).isEqualTo(400);
        var other = versions.saveAndFlush(new SoftwareVersion(seriesId, "2", "WINDOWS", null, null, userId));
        upload(image("png", 1, 1), null);
        assertThat(json.readTree(get("/api/versions/" + other.view().id() + "/screenshots").body()).get("totalElements").asInt()).isZero();
    }
    @Test void cleansFileAndRollsBackTimestampsOnDatabaseFailure() throws Exception {
        Files.createDirectories(Path.of("target/test-screenshots"));
        long before;
        try (var files = Files.list(Path.of("target/test-screenshots"))) { before = files.count(); }
        var timestamp = versions.findById(versionId).orElseThrow().view().updatedAt();
        assertThatThrownBy(() -> service.upload(versionId, new MockMultipartFile("image", image("png", 1, 1)), null, UUID.randomUUID()))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        try (var files = Files.list(Path.of("target/test-screenshots"))) { assertThat(files.count()).isEqualTo(before); }
        assertThat(screenshots.count()).isZero();
        assertThat(versions.findById(versionId).orElseThrow().view().updatedAt()).isEqualTo(timestamp);
    }
    @Test void storedImageRemainsReadableByNewStorageInstance() throws Exception {
        upload(image("png", 3, 4), "截图");
        var record = screenshots.findAll().getFirst();
        var reopened = new ScreenshotStorage("./target/test-screenshots");
        try (var input = reopened.read(record.getStorageKey()).getInputStream()) {
            assertThat(ImageIO.read(input).getHeight()).isEqualTo(4);
        }
    }
}
