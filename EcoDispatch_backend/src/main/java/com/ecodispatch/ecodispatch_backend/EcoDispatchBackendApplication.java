package com.ecodispatch.ecodispatch_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EcoDispatchBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcoDispatchBackendApplication.class, args);
    }

}
