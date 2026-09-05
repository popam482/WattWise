package com.ecodispatch.ecodispatch_backend.errors;

public class ApplianceNotFound extends RuntimeException {
    public ApplianceNotFound(String message) {
        super(message);
    }
}
