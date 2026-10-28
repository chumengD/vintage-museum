package cn.digitalmemory.museum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// 业务认证由账号模块处理，不生成框架默认账号。
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class MuseumApplication {
    public static void main(String[] args) {
        SpringApplication.run(MuseumApplication.class, args);
    }
}
