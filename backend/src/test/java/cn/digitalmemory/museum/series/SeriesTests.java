package cn.digitalmemory.museum.series;

import cn.digitalmemory.museum.auth.JwtTokenService;
import cn.digitalmemory.museum.user.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:series-test;DB_CLOSE_DELAY=-1",
    "museum.storage.series-icons=./target/test-series-icons"})
class SeriesTests {
    @Value("${local.server.port}") int port;
    @Autowired UserRepository users;
    @Autowired SeriesRepository series;
    @Autowired JwtTokenService tokens;
    @Autowired ObjectMapper json;
    HttpClient client;
    String cookie;
    @BeforeEach void setup() {
        client = HttpClient.newHttpClient();
        series.deleteAll();
        users.deleteAll();
        var user = users.saveAndFlush(new User("series_tester", "unused-test-hash", null));
        cookie = "museum_access_token=" + tokens.issue(user.getId()).value();
    }
    @AfterEach void close() { client.close(); }
    String metadata(String name) {
        return "{\"name\":\"" + name + "\",\"description\":\"聊天软件\",\"category\":\"INSTANT_MESSAGING\",\"platforms\":[\"WINDOWS\",\"ANDROID\"]}";
    }
    HttpResponse<byte[]> create(String metadata, byte[] icon, String credential, boolean headers) throws Exception {
        var body = new ByteArrayOutputStream();
        body.write(("--test-boundary\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n" + metadata + "\r\n").getBytes(StandardCharsets.UTF_8));
        if (icon != null) {
            body.write("--test-boundary\r\nContent-Disposition: form-data; name=\"icon\"; filename=\"../../fake.png\"\r\nContent-Type: image/png\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            body.write(icon); body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write("--test-boundary--\r\n".getBytes(StandardCharsets.UTF_8));
        var request = HttpRequest.newBuilder(URI.create(base() + "/api/series"))
                .header("Content-Type", "multipart/form-data; boundary=test-boundary");
        if (credential != null) request.header("Cookie", credential);
        if (headers) request.header("Origin", "http://localhost:5173").header("X-App-Request", "museum-web");
        return client.send(request.POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(), HttpResponse.BodyHandlers.ofByteArray());
    }
    String base() { return "http://127.0.0.1:" + port; }
    HttpResponse<byte[]> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(base() + path)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
    }
    @Test void createsAndBrowsesSeriesWithRealIcon() throws Exception {
        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_ARGB), "png", png);
        var response = create(metadata("  QQ  "), png.toByteArray(), cookie, true);
        assertThat(response.statusCode()).isEqualTo(201);
        var data = json.readTree(response.body()).get("series");
        assertThat(data.get("name").asText()).isEqualTo("QQ");
        assertThat(data.get("createdBy").asText()).isEqualTo(users.findByUsername("series_tester").orElseThrow().getId().toString());
        assertThat(get("/api/series/" + data.get("id").asText()).statusCode()).isEqualTo(200);
        var image = get(data.get("iconUrl").asText());
        assertThat(image.statusCode()).isEqualTo(200);
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(image.body())).getWidth()).isEqualTo(8);
        assertThat(json.readTree(get("/api/series?size=1").body()).get("totalElements").asInt()).isEqualTo(1);
        long before;
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("target/test-series-icons"))) { before = files.count(); }
        assertThat(create(metadata("qq"), png.toByteArray(), cookie, true).statusCode()).isEqualTo(409);
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("target/test-series-icons"))) { assertThat(files.count()).isEqualTo(before); }
    }
    @Test void allowsNoIconAndReturnsNotFoundForMissingResources() throws Exception {
        assertThat(create(metadata("QQ"), null, cookie, true).statusCode()).isEqualTo(201);
        var id = series.findAll().getFirst().getId();
        assertThat(get("/api/series/" + id + "/icon").statusCode()).isEqualTo(404);
        assertThat(get("/api/series/" + UUID.randomUUID()).statusCode()).isEqualTo(404);
        assertThat(get("/api/series/not-a-uuid").statusCode()).isEqualTo(400);
        assertThat(get("/api/series?size=101").statusCode()).isEqualTo(400);
    }
    @Test void protectsCreationAndValidatesInput() throws Exception {
        assertThat(create(metadata("QQ"), null, null, true).statusCode()).isEqualTo(401);
        assertThat(create(metadata("QQ"), null, cookie, false).statusCode()).isEqualTo(403);
        assertThat(create(metadata("QQ"), null, "museum_access_token=broken", true).statusCode()).isEqualTo(401);
        assertThat(create(metadata("QQ"), "not an image".getBytes(), cookie, true).statusCode()).isEqualTo(400);
        assertThat(create(metadata(" "), null, cookie, true).statusCode()).isEqualTo(400);
        assertThat(create(metadata("QQ").replace("WINDOWS", "UNKNOWN"), null, cookie, true).statusCode()).isEqualTo(400);
        assertThat(create(metadata("QQ").replace("\"ANDROID\"", "\"WINDOWS\""), null, cookie, true).statusCode()).isEqualTo(400);
        assertThat(create(metadata("QQ").replace("\"QQ\"", "123"), null, cookie, true).statusCode()).isEqualTo(400);
        assertThat(create(metadata("QQ").replace("\"name\"", "\"extra\""), null, cookie, true).statusCode()).isEqualTo(400);
        assertThat(series.count()).isZero();
    }
    @Test void supportsBrowserPreflight() throws Exception {
        var response = client.send(HttpRequest.newBuilder(URI.create(base() + "/api/series"))
                .header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-app-request")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).contains("true");
    }
    @Test void rejectsOversizedAndUnsupportedImages() throws Exception {
        assertThat(create(metadata("QQ"), new byte[2 * 1024 * 1024 + 1], cookie, true).statusCode()).isEqualTo(413);
        assertThat(create(metadata("QQ"), new byte[0], cookie, true).statusCode()).isEqualTo(400);
        var image = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2049, 1, BufferedImage.TYPE_INT_RGB), "png", image);
        assertThat(create(metadata("QQ"), image.toByteArray(), cookie, true).statusCode()).isEqualTo(400);
        image.reset();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "gif", image);
        assertThat(create(metadata("QQ"), image.toByteArray(), cookie, true).statusCode()).isEqualTo(400);
        assertThat(series.count()).isZero();
    }
    @Test void acceptsJpegAndKeepsPublicBrowsingIndependentOfCookie() throws Exception {
        var image = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "jpeg", image);
        assertThat(create(metadata("QQ"), image.toByteArray(), cookie, true).statusCode()).isEqualTo(201);
        var response = client.send(HttpRequest.newBuilder(URI.create(base() + "/api/series"))
                .header("Cookie", "museum_access_token=broken").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
    }
}
