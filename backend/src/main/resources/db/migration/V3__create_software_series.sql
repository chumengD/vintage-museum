CREATE TABLE software_series (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(200) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    category VARCHAR(32) NOT NULL,
    icon_storage_key VARCHAR(100),
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_series_normalized_name UNIQUE (normalized_name)
);
CREATE TABLE software_series_platforms (
    series_id UUID NOT NULL REFERENCES software_series(id),
    platform VARCHAR(32) NOT NULL,
    PRIMARY KEY (series_id, platform)
);
