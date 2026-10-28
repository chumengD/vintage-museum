package cn.digitalmemory.museum.config;

import java.util.List;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("museum.registration")
public record RegistrationProperties(@NotEmpty List<@NotBlank String> allowedOrigins,
                                     @Min(1) int requestsPerMinute,
                                     @Min(1) int maxTrackedClients) {
    public RegistrationProperties {
        if (allowedOrigins != null && allowedOrigins.stream().anyMatch(origin -> origin.contains("*"))) {
            throw new IllegalArgumentException("注册来源必须为明确的来源地址，不能使用通配符");
        }
    }
}
