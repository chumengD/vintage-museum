package cn.digitalmemory.museum.auth;

import java.util.LinkedHashMap;
import java.util.UUID;
import cn.digitalmemory.museum.common.ApiException;
import cn.digitalmemory.museum.user.User;
import cn.digitalmemory.museum.user.UserRepository;
import jakarta.validation.Validator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RegistrationService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate transactions;
    private final Validator validator;

    public RegistrationService(UserRepository users, PasswordEncoder passwordEncoder,
                               PlatformTransactionManager transactionManager, Validator validator) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.transactions = new TransactionTemplate(transactionManager);
        this.validator = validator;
    }

    public UserView register(RegisterRequest request) {
        var fields = new LinkedHashMap<String, String>();
        var normalizedUsername = CredentialsValidator.normalizeAndValidate(request.username(), request.password(), fields);
        var password = request.password();
        validator.validate(request).forEach(violation ->
                fields.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage()));
        if (!fields.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "请检查输入字段", fields);
        }
        if (users.existsByUsername(normalizedUsername)) { throw usernameExists(); }

        // 昂贵的密码哈希在事务外完成，缩短数据库事务持有时间。
        var hash = passwordEncoder.encode(password);
        try {
            return transactions.execute(status -> {
                var user = users.saveAndFlush(new User(normalizedUsername, hash, request.email()));
                return new UserView(user.getId(), user.getUsername(), user.getEmail());
            });
        } catch (DataIntegrityViolationException exception) {
            // 在插入事务回滚之后查询，处理两个并发请求同时通过预检查的情况。
            if (users.existsByUsername(normalizedUsername)) { throw usernameExists(); }
            throw exception;
        }
    }

    private ApiException usernameExists() {
        return new ApiException(HttpStatus.CONFLICT, "USERNAME_ALREADY_EXISTS", "用户名已存在");
    }

    public record UserView(UUID id, String username, String email) {}
}
