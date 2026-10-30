CREATE TABLE version_screenshots (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES software_versions(id),
    storage_key VARCHAR(100) NOT NULL UNIQUE,
    caption VARCHAR(500),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_screenshots_version_created ON version_screenshots(version_id, created_at, id);
