Batch Creation Flow

1. User creates a batch by entering product information (e.g., fruit type, weight, notes).

2. User selects an existing recipe or creates a new one.

3. When creating a recipe, the user defines multiple drying phases. Each phase contains:

   * Target temperature
   * Target humidity
   * Duration

4. The system validates the recipe against the Policy:

   * Temperature must be within the allowed min/max range.
   * Humidity must be within the allowed min/max range.
   * Number of phases must be within the allowed limit.
   * Total drying time must not exceed the maximum allowed duration.

5. If validation passes, the batch is created and linked to the selected recipe.

6. When the batch starts, the controller executes the recipe phase by phase.

7. During execution, all safety rules defined in the Policy are continuously enforced (e.g., fan control, over-temperature protection, emergency shutdown).

8. Users can customize recipes, but they can never bypass Policy constraints or safety rules.
