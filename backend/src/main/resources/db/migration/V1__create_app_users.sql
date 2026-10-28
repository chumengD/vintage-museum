CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_app_users_username UNIQUE (username),
    CONSTRAINT ck_app_users_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);
