package com.foody.tracker.auth.application;

import jakarta.servlet.http.HttpSession;

/** Reads the authoritative identity for a long-lived stream. */
public interface StreamSessionAccess {
    AuthenticatedUser current(HttpSession session);
    default boolean reconnectWhenMissing() { return false; }
}
