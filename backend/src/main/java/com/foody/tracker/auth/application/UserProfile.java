package com.foody.tracker.auth.application;

import com.foody.tracker.auth.domain.AppUser;
import java.util.UUID;

public record UserProfile(UUID id, String name, String email, String avatarUrl, long version) {
    public static UserProfile from(AppUser user) {
        return new UserProfile(user.getId(), user.getName(), user.getEmail(),
            user.hasAvatar() ? "/api/profile/avatar?v=" + user.getAvatarVersion() : null, user.getVersion());
    }
}
