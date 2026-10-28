package cn.digitalmemory.museum.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record RegisterRequest(String username, String password,
                              @Email(message = "邮箱格式不正确")
                              @Size(max = 254, message = "邮箱不能超过 254 个字符") String email) {
    public RegisterRequest {
        email = email == null || email.isBlank() ? null : email.strip();
    }

    @Override
    public String toString() {
        return "RegisterRequest[username=" + username + ", password=<redacted>, email=<redacted>]";
    }
}
