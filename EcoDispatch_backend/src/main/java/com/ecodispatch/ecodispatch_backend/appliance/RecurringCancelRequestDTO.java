package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RecurringCancelRequestDTO {
    /** ONE_DAY = skip selected date only; ALL_FUTURE = deactivate recurring rule */
    private String scope;
    private Integer logId;
    private Integer applianceId;
    /** yyyy-MM-dd — required for ONE_DAY when logId is absent */
    private String date;

    public RecurringCancelRequestDTO() {}
}
