package cn.digitalmemory.museum.common;

import java.io.IOException;
import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final ApiErrorWriter errors;

    public ApiExceptionHandler(ApiErrorWriter errors) { this.errors = errors; }

    @ExceptionHandler(ApiException.class)
    void handleApiException(ApiException exception, HttpServletResponse response) throws IOException {
        errors.write(response, exception.status().value(), exception.code(), exception.getMessage(), exception.fieldErrors());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    void handleInvalidBody(HttpServletResponse response) throws IOException {
        errors.write(response, 400, "VALIDATION_ERROR", "请求体必须为合法 JSON，字段名称和类型须符合接口约定", Map.of());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    void handleUnsupportedType(HttpServletResponse response) throws IOException {
        errors.write(response, 415, "UNSUPPORTED_MEDIA_TYPE", "请求 Content-Type 不符合接口约定", Map.of());
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.multipart.MultipartException.class})
    void handleInvalidMultipart(Exception exception, HttpServletResponse response) throws IOException {
        if (exception instanceof org.springframework.web.multipart.MaxUploadSizeExceededException) {
            errors.write(response, 413, "UPLOAD_TOO_LARGE", "上传文件或请求体过大", Map.of());
        } else {
            errors.write(response, 400, "VALIDATION_ERROR", "请求参数或 multipart 请求格式不合法", Map.of());
        }
    }

    @ExceptionHandler(Exception.class)
    void handleUnexpectedException(Exception exception, HttpServletResponse response) throws IOException {
        var requestId = errors.write(response, 500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试", Map.of());
        // 不输出异常消息或请求体，避免解析异常回显密码。
        log.error("Request failed: requestId={}, exceptionType={}", requestId, exception.getClass().getName());
    }
}
