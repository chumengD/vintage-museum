package cn.digitalmemory.museum.auth;

import java.util.Locale;
import java.util.Map;

final class CredentialsValidator {
    private CredentialsValidator() {}

    static String normalizeAndValidate(String rawUsername, String password, Map<String, String> fields) {
        var username = rawUsername == null ? "" : rawUsername.strip();
        if (!username.matches("[A-Za-z0-9_]{2,32}")) {
            fields.put("username", "用户名须为 2～32 位英文字母、数字或下划线");
        }
        int length = password == null ? 0 : password.codePointCount(0, password.length());
        if (length < 4 || length > 64) {
            fields.put("password", "密码须为 4～64 个字符");
        }
        return username.toLowerCase(Locale.ROOT);
    }
}
