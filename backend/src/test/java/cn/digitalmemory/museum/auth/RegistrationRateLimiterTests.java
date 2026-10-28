package cn.digitalmemory.museum.auth;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class RegistrationRateLimiterTests {
    @Test
    void limitsPerClientAndResetsAfterWindow() {
        var clock = new MutableClock();
        var limiter = new IpRateLimiter(2, 10, clock);
        assertThat(limiter.acquire("client-a").allowed()).isTrue();
        assertThat(limiter.acquire("client-a").allowed()).isTrue();
        var denied = limiter.acquire("client-a");
        assertThat(denied.allowed()).isFalse();
        assertThat(denied.retryAfterSeconds()).isEqualTo(60);
        assertThat(limiter.acquire("client-b").allowed()).isTrue();
        clock.now = 60_000;
        assertThat(limiter.acquire("client-a").allowed()).isTrue();
    }

    @Test
    void fullCapacityDoesNotEvictLimitsAndExpiredSlotsCanBeReused() {
        var clock = new MutableClock();
        var limiter = new IpRateLimiter(1, 1, clock);
        assertThat(limiter.acquire("client-a").allowed()).isTrue();
        assertThat(limiter.acquire("client-b").allowed()).isFalse();
        assertThat(limiter.acquire("client-a").allowed()).isFalse();
        clock.now = 60_000;
        assertThat(limiter.acquire("client-b").allowed()).isTrue();
    }

    private static class MutableClock extends Clock {
        private long now;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now); }
    }
}
