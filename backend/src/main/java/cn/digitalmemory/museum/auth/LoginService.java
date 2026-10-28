package cn.digitalmemory.museum.auth;

import java.util.LinkedHashMap;
import java.util.UUID;
import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.user.User;
import cn.digitalmemory.museum.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class LoginService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public LoginService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    public RegistrationService.UserView login(LoginRequest request) {
        var fields = new LinkedHashMap<String, String>();
        var username = CredentialsValidator.normalizeAndValidate(request.username(), request.password(), fields);
        if (!fields.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "请检查输入字段", fields);
        }
        var user = users.findByUsername(username).orElse(null);
        // 账号不存在时也进行密码哈希校验，减少通过耗时猜测账号的机会。
        boolean matches = passwords.matches(request.password(), user == null ? dummyHash : user.getPasswordHash());
        if (!matches || user == null || user.getStatus() != User.Status.ACTIVE) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "账号或密码错误");
        }
        return new RegistrationService.UserView(user.getId(), user.getUsername(), user.getEmail());
    }
}
