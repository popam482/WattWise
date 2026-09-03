package com.ecodispatch.ecodispatch_backend.templates;

import org.springframework.context.annotation.Bean;

public class RestTemplate {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
