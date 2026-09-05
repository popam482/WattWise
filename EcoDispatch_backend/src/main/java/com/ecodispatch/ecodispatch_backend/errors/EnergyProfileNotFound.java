package com.ecodispatch.ecodispatch_backend.errors;

public class EnergyProfileNotFound extends RuntimeException {
    public EnergyProfileNotFound(String message) {
        super(message);
    }
}
