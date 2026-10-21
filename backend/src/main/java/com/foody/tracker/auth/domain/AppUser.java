package com.foody.tracker.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Version;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id
    private UUID id;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(nullable = false, unique = true, length = 254)
    private String email;
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;
    @Column(name = "avatar_data")
    private byte[] avatarData;
    @Column(name = "avatar_version", nullable = false)
    private long avatarVersion;
    @Column(name = "credentials_version", nullable = false)
    private long credentialsVersion;
    @Version
    private Long version;

    protected AppUser() {}

    public AppUser(String name, String email, String passwordHash) {
        this.id = UUID.randomUUID();
        this.name = name.strip();
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public byte[] getAvatarData() { return avatarData == null ? null : avatarData.clone(); }
    public long getAvatarVersion() { return avatarVersion; }
    public long getCredentialsVersion() { return credentialsVersion; }
    public long getVersion() { return version == null ? 0 : version; }
    public boolean hasAvatar() { return avatarData != null; }

    public void updateProfile(String name, String email) {
        this.name = name.strip();
        if (!this.email.equals(email)) credentialsVersion++;
        this.email = email;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
        credentialsVersion++;
    }

    public void updateAvatar(byte[] data) {
        this.avatarData = data == null ? null : data.clone();
        this.avatarVersion++;
    }
}
