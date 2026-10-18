package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.privacy.*;
import com.ecodispatch.ecodispatch_backend.service.HabitLearningService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users/{userId}/privacy/habit-learning")
public class HabitLearningController {

    private final HabitLearningService habitLearningService;

    public HabitLearningController(HabitLearningService habitLearningService) {
        this.habitLearningService = habitLearningService;
    }

    @GetMapping
    public HabitLearningSettingsResponseDTO getSettings(@PathVariable Integer userId) {
        return habitLearningService.getSettings(userId);
    }

    @PutMapping
    public HabitLearningSettingsResponseDTO updateSettings(
            @PathVariable Integer userId,
            @Valid @RequestBody HabitLearningSettingsRequestDTO request) {
        return habitLearningService.updateSettings(userId, request);
    }

    @DeleteMapping("/history")
    public void deleteHistory(@PathVariable Integer userId) {
        habitLearningService.deleteHistory(userId);
    }

    @GetMapping("/aggregates")
    public List<HabitLearningAggregateDTO> getAggregates(@PathVariable Integer userId) {
        return habitLearningService.getAggregates(userId);
    }
}
