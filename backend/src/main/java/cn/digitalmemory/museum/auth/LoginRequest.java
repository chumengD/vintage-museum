package cn.digitalmemory.museum.auth;

public record LoginRequest(String username, String password) {
    @Override public String toString() { return "LoginRequest[username=" + username + ", password=<redacted>]"; }
}
