package cn.digitalmemory.museum.auth;

/** 与安全配置允许的创建路由保持一致，用于认证和来源检查。 */
public final class BusinessRequestPaths {
    private BusinessRequestPaths() {}
    public static boolean isCreatePath(String path) {
        return path.equals("/api/series") || path.matches("/api/series/[^/]+/versions")
                || path.matches("/api/versions/[^/]+/screenshots");
    }
}
