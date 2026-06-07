const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAdmin } = require("../middleware/auth");
const { ok } = require("../utils/routeHelpers");
const {
  startSimulation,
  stopSimulation,
  isSimulationActive,
} = require("../services/simulationService");

const router = express.Router();

// GET active simulation status
router.get("/", asyncHandler(async (_req, res) => {
  return ok(res, { is_active: isSimulationActive() });
}));

// POST active simulation status
router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  
  if (is_active) {
    startSimulation();
  } else {
    stopSimulation();
  }

  return ok(res, { is_active: isSimulationActive() });
}));

module.exports = router;
