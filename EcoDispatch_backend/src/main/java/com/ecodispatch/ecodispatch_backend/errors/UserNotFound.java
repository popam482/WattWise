package com.ecodispatch.ecodispatch_backend.errors;

public class UserNotFound extends RuntimeException {
    public UserNotFound(Integer id) {
        super("User with id " + id + " not found: ");
    }

    public UserNotFound(String name) {
        super("User with name " + name + " not found: ");
    }
}
