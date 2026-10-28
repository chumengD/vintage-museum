package cn.digitalmemory.museum.common;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ApiErrorWriter {
    private final ObjectMapper objectMapper;

    public ApiErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(HttpServletResponse response, int status, String code, String message,
                        Map<String, String> fieldErrors) throws IOException {
        var requestId = UUID.randomUUID().toString();
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Request-Id", requestId);
        objectMapper.writeValue(response.getOutputStream(), new ApiError(code, message, requestId, fieldErrors));
        return requestId;
    }

    private record ApiError(String code, String message, String requestId, Map<String, String> fieldErrors) {}
}
