package cn.digitalmemory.museum.user;

import java.util.UUID;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

class EmailMigrationTests {
    @Test
    void upgradesExistingUsersWithoutChangingTheirIdentityOrPassword() {
        try (var source = new HikariDataSource()) {
        source.setJdbcUrl("jdbc:h2:mem:email-migration-" + UUID.randomUUID());
        source.setUsername("sa");
        source.setPassword("");
        Flyway.configure().dataSource(source).target("1").load().migrate();
        var jdbc = new JdbcTemplate(source);
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_users (id, username, password_hash, status, created_at, updated_at) "
                        + "VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                id, "existing_user", "existing-password-hash");

        Flyway.configure().dataSource(source).load().migrate();
        var user = jdbc.queryForMap("SELECT id, username, password_hash, email FROM app_users WHERE id = ?", id);
        assertThat(user.get("ID")).isEqualTo(id);
        assertThat(user.get("USERNAME")).isEqualTo("existing_user");
        assertThat(user.get("PASSWORD_HASH")).isEqualTo("existing-password-hash");
        assertThat(user.get("EMAIL")).isNull();
        jdbc.update("UPDATE app_users SET email = ? WHERE id = ?", "person@example.com", id);
        Flyway.configure().dataSource(source).load().migrate();
        assertThat(jdbc.queryForObject("SELECT email FROM app_users WHERE id = ?", String.class, id))
                .isEqualTo("person@example.com");
        }
    }
}
