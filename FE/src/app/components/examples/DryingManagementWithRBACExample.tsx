/**
 * EXAMPLE: Updated DryingManagement with RBAC Integration
 * 
 * This shows how to integrate role-based access control into
 * the DryingManagement component. Copy these patterns to other components.
 */

import { useState } from "react";
import {
  Wind,
  Thermometer,
  Droplets,
  Timer,
  Hand,
  Gauge,
  CheckCircle2,
  Plus,
  Trash2,
  Target,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Can, AdminOnly } from "@/components/permission/PermissionGuards";
import {
  usePermission,
  useIsAdmin,
} from "@/hooks/usePermission";
import { Permission } from "@/types/rbac";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function DryingManagementWithRBAC() {
  const navigate = useNavigate();

  // Permission checks
  const canRunBatch = usePermission(Permission.RUN_BATCH);
  const canStopBatch = usePermission(Permission.STOP_BATCH);
  const canManualControl = usePermission(Permission.MANUAL_CONTROL);
  const canAdjustParameters = usePermission(Permission.ADJUST_PARAMETERS);
  const canToggleThreshold = usePermission(Permission.TOGGLE_THRESHOLD);
  const isAdmin = useIsAdmin();

  // Mock state
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"manual" | "scheduled">(
    "scheduled"
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Drying Management
          </h2>
          <p className="text-slate-600 mt-2">
            Monitor and control drying operations
          </p>
        </div>

        {/* Create Batch Button - Permission Controlled */}
        <Can permission={Permission.CREATE_BATCH}>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Batch
          </Button>
        </Can>
      </div>

      {/* KPI Cards - All Users Can View */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-600">Active Batches</p>
              <p className="text-2xl font-bold mt-2">12</p>
              <p className="text-xs text-slate-400 mt-1">
                4 batches finishing in &lt; 2h
              </p>
            </div>
            <Wind className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
        {/* More KPI cards... */}
      </div>

      {/* Machine Selection - Only show machines user has access to */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Select Machine</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "dryer-a1", name: "Dryer A1" },
            { id: "dryer-a2", name: "Dryer A2" },
            { id: "dryer-b1", name: "Dryer B1" },
          ].map((machine) => (
            <Can key={machine.id} fallback={
              <div className="relative">
                <button className="w-full p-3 border rounded bg-gray-100 opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  {machine.name}
                </button>
              </div>
            }>
              <button
                onClick={() => setSelectedMachine(machine.id)}
                className={`p-3 border rounded transition ${
                  selectedMachine === machine.id
                    ? "bg-emerald-500 text-white border-emerald-600"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                {machine.name}
              </button>
            </Can>
          ))}
        </div>
      </Card>

      {/* Mode Selection - Conditional on Permissions */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Operating Mode</h3>

        <div className="flex gap-3">
          {/* Manual Control - Permission Required */}
          <Can permission={Permission.MANUAL_CONTROL}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="manual"
                checked={selectedMode === "manual"}
                onChange={(e) => setSelectedMode("manual")}
              />
              <span>Manual Control</span>
            </label>
          </Can>

          {/* Scheduled Control - Permission Required */}
          <Can permission={Permission.SCHEDULED_CONTROL}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="scheduled"
                checked={selectedMode === "scheduled"}
                onChange={(e) => setSelectedMode("scheduled")}
              />
              <span>Scheduled</span>
            </label>
          </Can>
        </div>

        {/* If neither permission, show message */}
        {!canManualControl && (
          <p className="text-red-600 text-sm mt-4">
            You don't have permission to control drying operations
          </p>
        )}
      </Card>

      {/* Control Panel - Only show if user has permissions */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Control Panel</h3>

        {selectedMode === "manual" && (
          <Can permission={Permission.MANUAL_CONTROL}>
            <div className="space-y-4">
              {/* Parameter Adjustment - Admin or with ADJUST_PARAMETERS */}
              <Can permission={Permission.ADJUST_PARAMETERS}>
                <div className="border rounded p-4 bg-slate-50">
                  <h4 className="font-semibold mb-3">Parameter Adjustment</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        Temperature (°C)
                      </label>
                      <input
                        type="range"
                        min="40"
                        max="75"
                        defaultValue="60"
                        className="w-full mt-2"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Humidity (%)
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        defaultValue="50"
                        className="w-full mt-2"
                      />
                    </div>
                  </div>
                </div>
              </Can>

              {/* Threshold Toggle - Can be granted independently */}
              <Can permission={Permission.TOGGLE_THRESHOLD}>
                <div className="border rounded p-4 bg-slate-50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked />
                    <span className="font-medium">
                      Enable Safety Threshold
                    </span>
                  </label>
                </div>
              </Can>

              {/* Admin-Only Advanced Settings */}
              <AdminOnly>
                <div className="border rounded p-4 bg-purple-50 border-purple-200">
                  <h4 className="font-semibold mb-3 text-purple-900">
                    Advanced Settings (Admin Only)
                  </h4>
                  <p className="text-sm text-purple-700">
                    Configure safety limits and alert thresholds
                  </p>
                </div>
              </AdminOnly>
            </div>
          </Can>
        )}

        {/* Action Buttons - Permission Controlled */}
        <div className="flex gap-3 mt-6">
          <Can permission={Permission.RUN_BATCH}>
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              <ArrowRight className="w-4 h-4" />
              Start Batch
            </Button>
          </Can>

          <Can permission={Permission.STOP_BATCH}>
            <Button variant="destructive" className="gap-2">
              <div className="w-4 h-4">Stop</div>
              Stop Batch
            </Button>
          </Can>

          {/* Fallback if no control permissions */}
          {!canRunBatch && !canStopBatch && (
            <div className="flex items-center gap-2 text-slate-500">
              <Lock className="w-4 h-4" />
              <span className="text-sm">
                You don't have permission to control batches
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Device Configuration - Admin Only */}
      <AdminOnly>
        <Card className="p-6 border border-purple-200 bg-purple-50">
          <h3 className="text-lg font-bold mb-4 text-purple-900">
            Device Configuration (Admin)
          </h3>
          <p className="text-purple-700 text-sm mb-4">
            Configure sensors, fans, and output devices
          </p>
          <Button variant="outline" className="border-purple-300">
            Configure Devices
          </Button>
        </Card>
      </AdminOnly>
    </div>
  );
}

/**
 * INTEGRATION TIPS:
 * 
 * 1. Import permission hooks at the top of your component
 * 2. Use usePermission() to check specific permissions
 * 3. Use Can component to conditionally render UI sections
 * 4. Use AdminOnly for sensitive operations
 * 5. Show meaningful messages when permissions are denied
 * 6. Disable buttons/inputs instead of hiding them when possible (for UX)
 * 7. Log permission denials for security auditing
 * 
 * EXAMPLE: Check permission before sensitive API call:
 * 
 * const handleDeleteBatch = async (batchId: string) => {
 *   if (!hasPermission(Permission.DELETE_BATCH)) {
 *     alert("You don't have permission to delete batches");
 *     return;
 *   }
 *   
 *   try {
 *     await api.deleteBatch(batchId);
 *     // Success handling
 *   } catch (error) {
 *     // Error handling
 *   }
 * };
 */
