package cn.digitalmemory.museum.version;

import cn.digitalmemory.museum.auth.JwtTokenService;
import cn.digitalmemory.museum.series.*;
import cn.digitalmemory.museum.user.*;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:version-test;DB_CLOSE_DELAY=-1")
class VersionTests {
    @Value("${local.server.port}") int port;
    @Autowired VersionRepository versions;
    @Autowired SeriesRepository series;
    @Autowired UserRepository users;
    @Autowired JwtTokenService tokens;
    @Autowired ObjectMapper json;
    HttpClient client;
    String cookie;
    UUID seriesId;
    UUID userId;
    @BeforeEach void setup() {
        client = HttpClient.newHttpClient();
        versions.deleteAll(); series.deleteAll(); users.deleteAll();
        var user = users.saveAndFlush(new User("version_tester", "unused-test-hash", null));
        userId = user.getId(); cookie = "museum_access_token=" + tokens.issue(userId).value();
        seriesId = series.saveAndFlush(new SoftwareSeries("QQ", "历史资料", "INSTANT_MESSAGING",
                Set.of("WINDOWS", "ANDROID"), "test-icon.png", userId)).getId();
    }
    @AfterEach void close() { client.close(); }
    String path() { return "/api/series/" + seriesId + "/versions"; }
    HttpRequest.Builder request(String path) { return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)); }
    HttpResponse<String> post(String path, String body, String credential, boolean protection) throws Exception {
        var builder = request(path).header("Content-Type", "application/json");
        if (credential != null) builder.header("Cookie", credential);
        if (protection) builder.header("Origin", "http://127.0.0.1:5173").header("X-App-Request", "museum-web");
        return client.send(builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> create(String body) throws Exception { return post(path(), body, cookie, true); }
    HttpResponse<String> get(String path) throws Exception {
        return client.send(request(path).header("Cookie", "museum_access_token=broken").GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    String body(String number, String platform) {
        return "{\"versionNumber\":\"" + number + "\",\"platform\":\"" + platform + "\"}";
    }
    @Test void createsAndBrowsesWithOptionalDateAndInheritedIcon() throws Exception {
        var before = series.findById(seriesId).orElseThrow().view().updatedAt();
        var response = create("{\"versionNumber\":\" 1.2 Beta \",\"platform\":\"WINDOWS\",\"releaseDate\":\"2001-02-03\",\"description\":\" 旧版界面 \"}");
        assertThat(response.statusCode()).isEqualTo(201);
        var data = json.readTree(response.body()).get("version");
        assertThat(data.get("versionNumber").asText()).isEqualTo("1.2 Beta");
        assertThat(data.get("releaseDate").asText()).isEqualTo("2001-02-03");
        assertThat(data.get("description").asText()).isEqualTo("旧版界面");
        assertThat(data.get("createdBy").asText()).isEqualTo(userId.toString());
        var detail = get("/api/versions/" + data.get("id").asText());
        assertThat(detail.statusCode()).isEqualTo(200);
        assertThat(json.readTree(detail.body()).get("series").get("iconUrl").asText()).isEqualTo("/api/series/" + seriesId + "/icon");
        assertThat(series.findById(seriesId).orElseThrow().view().updatedAt()).isAfter(before);
        assertThat(json.readTree(get(path()).body()).get("totalElements").asInt()).isEqualTo(1);
    }
    @Test void supportsNullDatePaginationAndPlatformFiltering() throws Exception {
        assertThat(create(body("1.10", "WINDOWS")).statusCode()).isEqualTo(201);
        assertThat(create(body("1.10", "ANDROID")).statusCode()).isEqualTo(201);
        var page = json.readTree(get(path() + "?platform=WINDOWS&size=1").body());
        assertThat(page.get("totalElements").asInt()).isEqualTo(1);
        assertThat(page.get("items").get(0).get("releaseDate").isNull()).isTrue();
        assertThat(json.readTree(get(path() + "?page=1&size=1").body()).get("items").size()).isEqualTo(1);
        assertThat(get(path() + "?platform=UNKNOWN").statusCode()).isEqualTo(400);
        assertThat(get(path() + "?size=101").statusCode()).isEqualTo(400);
        assertThat(get(path() + "?page=-1").statusCode()).isEqualTo(400);
    }
    @Test void rejectsDuplicatesButAllowsSameNumberInDifferentSeries() throws Exception {
        assertThat(create(body("1.2 Beta", "WINDOWS")).statusCode()).isEqualTo(201);
        assertThat(create(body(" 1.2 beta ", "WINDOWS")).statusCode()).isEqualTo(409);
        var another = series.saveAndFlush(new SoftwareSeries("Other", "说明", "OTHER", Set.of("WINDOWS"), null, userId));
        assertThat(post("/api/series/" + another.getId() + "/versions", body("1.2 Beta", "WINDOWS"), cookie, true).statusCode()).isEqualTo(201);
    }
    @Test void validatesFieldsAndStrictJson() throws Exception {
        for (String invalid : List.of(body(" ", "WINDOWS"), body("x".repeat(101), "WINDOWS"), body("1", "IOS"),
                "{}", "{\"versionNumber\":123,\"platform\":\"WINDOWS\"}",
                body("1", "WINDOWS").replace("}", ",\"source\":\"x\"}"),
                body("1", "WINDOWS").replace("}", ",\"description\":\"" + "x".repeat(5001) + "\"}"))) {
            assertThat(create(invalid).statusCode()).as(invalid.substring(0, Math.min(100, invalid.length()))).isEqualTo(400);
        }
        for (String date : List.of("2001-02-29", "2000-13-01", "约2001年", "", "0000-01-01", "2001-1-1"))
            assertThat(create(body("1", "WINDOWS").replace("}", ",\"releaseDate\":\"" + date + "\"}")).statusCode()).isEqualTo(400);
        assertThat(versions.count()).isZero();
    }
    @Test void requiresAuthenticationAndOriginAndSupportsPreflight() throws Exception {
        assertThat(post(path(), body("1", "WINDOWS"), null, true).statusCode()).isEqualTo(401);
        assertThat(post(path(), body("1", "WINDOWS"), cookie, false).statusCode()).isEqualTo(403);
        assertThat(post(path(), body("1", "WINDOWS"), "museum_access_token=broken", true).statusCode()).isEqualTo(401);
        var preflight = client.send(request(path()).header("Origin", "http://127.0.0.1:5173")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type,x-app-request")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(preflight.statusCode()).isEqualTo(200);
        assertThat(preflight.headers().firstValue("Access-Control-Allow-Credentials")).contains("true");
    }
    @Test void returns404ForMissingSeriesAndVersionAnd400ForInvalidIds() throws Exception {
        assertThat(post("/api/series/" + UUID.randomUUID() + "/versions", body("1", "WINDOWS"), cookie, true).statusCode()).isEqualTo(404);
        assertThat(get("/api/series/" + UUID.randomUUID() + "/versions").statusCode()).isEqualTo(404);
        assertThat(get("/api/versions/" + UUID.randomUUID()).statusCode()).isEqualTo(404);
        assertThat(get("/api/versions/invalid").statusCode()).isEqualTo(400);
    }
}
