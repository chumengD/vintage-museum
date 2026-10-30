CREATE TABLE software_versions (
    id UUID PRIMARY KEY,
    series_id UUID NOT NULL REFERENCES software_series(id),
    version_number VARCHAR(100) NOT NULL,
    normalized_number VARCHAR(200) NOT NULL,
    platform VARCHAR(32) NOT NULL,
    release_date DATE,
    description VARCHAR(5000),
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_versions_series_platform_number UNIQUE (series_id, platform, normalized_number)
);
CREATE INDEX idx_versions_series_created ON software_versions(series_id, created_at, id);
