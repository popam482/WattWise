package com.ecodispatch.ecodispatch_backend.connector;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProviderConnectionRepository extends JpaRepository<ProviderConnection, Integer> {

    @Query("SELECT c FROM ProviderConnection c WHERE c.user.user_id = :userId AND c.active = true")
    List<ProviderConnection> findActiveByUserId(@Param("userId") Integer userId);

    @Query("SELECT c FROM ProviderConnection c WHERE c.user.user_id = :userId AND c.provider = :provider AND c.active = true")
    Optional<ProviderConnection> findActiveByUserIdAndProvider(@Param("userId") Integer userId,
                                                              @Param("provider") EnergyProvider provider);

    @Query("SELECT c FROM ProviderConnection c WHERE c.user.user_id = :userId AND c.provider = :provider")
    Optional<ProviderConnection> findByUserIdAndProvider(@Param("userId") Integer userId,
                                                         @Param("provider") EnergyProvider provider);
}
