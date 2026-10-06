package com.ecodispatch.ecodispatch_backend.appliance;

import com.ecodispatch.ecodispatch_backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
public class Appliance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String name;

    private Double powerConsumptionKw;

    private Boolean isRecurring;

    private String recurringDays;

    private Integer preferredDuration;

    private String timeWindowStart;
    private String timeWindowEnd;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    public Appliance() {}
}
