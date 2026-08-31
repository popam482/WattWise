package com.ecodispatch.ecodispatch_backend.errors;

public class InvalidCredentials extends RuntimeException {
    public InvalidCredentials() {
        super("Invalid username or password");
    }
}
