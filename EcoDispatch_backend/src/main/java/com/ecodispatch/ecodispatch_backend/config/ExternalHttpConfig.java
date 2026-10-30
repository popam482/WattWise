package com.ecodispatch.ecodispatch_backend.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Dedicated HTTP client for third-party APIs (Shelly, Open-Meteo).
 * Hard 3s timeouts so a live pitch never hangs on a slow vendor.
 */
@Configuration
public class ExternalHttpConfig {

    public static final String EXTERNAL_REST_TEMPLATE = "externalRestTemplate";

    @Bean
    @Qualifier(EXTERNAL_REST_TEMPLATE)
    public RestTemplate externalRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(3000));
        factory.setReadTimeout(Duration.ofMillis(3000));
        return new RestTemplate(factory);
    }
}
