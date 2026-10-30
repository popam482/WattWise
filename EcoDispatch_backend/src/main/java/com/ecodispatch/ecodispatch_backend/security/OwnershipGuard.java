package com.ecodispatch.ecodispatch_backend.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OwnershipGuard {

    public Integer requireAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Integer authenticatedUserId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User is not authenticated");
        }
        return authenticatedUserId;
    }

    public void requireOwnership(Integer pathUserId) {
        Integer authenticatedUserId = requireAuthenticatedUserId();
        if (!authenticatedUserId.equals(pathUserId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Access denied: you are not authorized to access or modify resources for another user"
            );
        }
    }
}
