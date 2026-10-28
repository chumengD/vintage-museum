package cn.digitalmemory.museum.auth;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/** 单进程、按直接连接 IP 的固定窗口限速；容量满时拒绝新来源，避免无界增长。 */
public class IpRateLimiter {
    private static final long WINDOW_MILLIS = 60_000;
    private final int limit;
    private final int capacity;
    private final Clock clock;
    private final Map<String, Window> clients = new HashMap<>();

    public IpRateLimiter(int limit, int capacity, Clock clock) {
        this.limit = limit;
        this.capacity = capacity;
        this.clock = clock;
    }

    public synchronized Decision acquire(String client) {
        long now = clock.millis();
        var window = clients.get(client);
        if (window == null || window.expiresAt <= now) {
            if (window == null && clients.size() >= capacity) {
                clients.values().removeIf(entry -> entry.expiresAt <= now);
                if (clients.size() >= capacity) { return new Decision(false, 60); }
            }
            window = new Window(now + WINDOW_MILLIS);
            clients.put(client, window);
        }
        if (window.count >= limit) {
            return new Decision(false, Math.max(1, (window.expiresAt - now + 999) / 1000));
        }
        window.count++;
        return new Decision(true, 0);
    }

    public record Decision(boolean allowed, long retryAfterSeconds) {}

    private static final class Window {
        private final long expiresAt;
        private int count;
        private Window(long expiresAt) { this.expiresAt = expiresAt; }
    }
}
