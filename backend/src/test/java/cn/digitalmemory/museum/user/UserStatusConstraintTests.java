package cn.digitalmemory.museum.user;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserStatusConstraintTests {
    @TempDir
    Path directory;

    @ParameterizedTest(name = "user status survives migration connection retirement: file={0}")
    @ValueSource(booleans = {false, true})
    void acceptsValidStatusesAfterMigrationConnectionCloses(boolean file) throws Exception {
        var url = file ? "jdbc:h2:file:" + directory.resolve("museum").toAbsolutePath()
                : "jdbc:h2:mem:status-" + UUID.randomUUID();
        try (var migration = DriverManager.getConnection(url, "sa", "")) {
            // Keep the database open on another connection, as Hikari does when
            // retiring the connection that Flyway used to create the constraint.
            Flyway.configure().dataSource(new SingleConnectionDataSource(migration, true)).load().migrate();
            try (var writer = DriverManager.getConnection(url, "sa", "")) {
                migration.close();
                assertThat(insertUser(writer, "ACTIVE")).isEqualTo(1);
                assertThat(insertUser(writer, "DISABLED")).isEqualTo(1);
                assertThatThrownBy(() -> insertUser(writer, "UNKNOWN"))
                        .isInstanceOfSatisfying(SQLException.class,
                                exception -> assertThat(exception.getSQLState()).isEqualTo("23513"));
            }
        }
        if (file) {
            try (var reopened = DriverManager.getConnection(url, "sa", "");
                 var query = reopened.createStatement();
                 var rows = query.executeQuery("SELECT COUNT(*) FROM app_users")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isEqualTo(2);
                assertThat(insertUser(reopened, "ACTIVE")).isEqualTo(1);
            }
        }
    }

    private int insertUser(Connection connection, String status) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO app_users (id, username, password_hash, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)) {
            statement.setObject(1, UUID.randomUUID());
            statement.setString(2, "status_" + status.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8));
            statement.setString(3, "test-only-hash");
            statement.setString(4, status);
            return statement.executeUpdate();
        }
    }
}
