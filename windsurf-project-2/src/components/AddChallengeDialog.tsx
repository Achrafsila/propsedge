"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/context/AccountsContext";
import { useAdmin } from "@/context/AdminContext";
import { motion } from "framer-motion";

interface AddChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddChallengeDialog({ open, onOpenChange }: AddChallengeDialogProps) {
  const { addChallenge } = useAccounts();
  const { challengeTypes } = useAdmin();
  const [selectedFirm, setSelectedFirm] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [formData, setFormData] = useState({
    propFirmName: "",
    accountName: "",
    accountSize: "",
    challengeType: "",
    challengeKind: "1-step" as "1-step" | "2-step" | "instant",
    purchaseCost: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    profitTarget: "",
    step1ProfitTarget: "",
    step2ProfitTarget: "",
    maxDrawdown: "",
    notes: "",
  });

  // Helper functions using AdminContext challengeTypes
  const getPropFirms = () => {
    const firms = [...new Set(challengeTypes.map(p => p.propFirmName))];
    return firms.sort();
  };

  const getPlansByFirm = (firmName: string) => {
    return challengeTypes.filter(p => p.propFirmName === firmName);
  };

  const getPresetById = (id: string) => {
    return challengeTypes.find(p => p.id === id);
  };

  const firms = getPropFirms();
  const plans = selectedFirm ? getPlansByFirm(selectedFirm) : [];

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = getPresetById(presetId);
    if (preset) {
      const kind = preset.challengeType || "1-step";
      const step1 = preset.step1ProfitTarget ?? preset.profitTarget;
      const step2 = preset.step2ProfitTarget ?? preset.profitTarget;
      setFormData({
        ...formData,
        propFirmName: preset.propFirmName,
        accountName: `${preset.planName}`,
        accountSize: preset.accountSize.toString(),
        challengeType: preset.planName,
        challengeKind: kind,
        purchaseCost: preset.purchaseCost.toString(),
        // For 2-step, the active target starts at Step 1
        profitTarget: (kind === "2-step" ? step1 : preset.profitTarget).toString(),
        step1ProfitTarget: kind === "2-step" ? step1.toString() : "",
        step2ProfitTarget: kind === "2-step" ? step2.toString() : "",
        maxDrawdown: preset.maxDrawdown.toString(),
        notes: preset.notes,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const is2Step = formData.challengeKind === "2-step";
    addChallenge({
      propFirmName: formData.propFirmName,
      accountName: formData.accountName,
      accountSize: parseFloat(formData.accountSize),
      challengeType: formData.challengeType,
      challengeKind: formData.challengeKind,
      challengeStep: is2Step ? "1" : "instant",
      step1ProfitTarget: is2Step && formData.step1ProfitTarget ? parseFloat(formData.step1ProfitTarget) : undefined,
      step2ProfitTarget: is2Step && formData.step2ProfitTarget ? parseFloat(formData.step2ProfitTarget) : undefined,
      purchaseCost: parseFloat(formData.purchaseCost),
      purchaseDate: formData.purchaseDate,
      profitTarget: parseFloat(formData.profitTarget),
      currentProfit: 0,
      maxDrawdown: parseFloat(formData.maxDrawdown),
      remainingDrawdown: parseFloat(formData.maxDrawdown),
      status: "active",
      presetId: selectedPresetId || undefined,
      notes: formData.notes || undefined,
    });
    onOpenChange(false);
    // Reset form
    setSelectedFirm("");
    setSelectedPresetId("");
    setFormData({
      propFirmName: "",
      accountName: "",
      accountSize: "",
      challengeType: "",
      challengeKind: "1-step",
      purchaseCost: "",
      purchaseDate: new Date().toISOString().split('T')[0],
      profitTarget: "",
      step1ProfitTarget: "",
      step2ProfitTarget: "",
      maxDrawdown: "",
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080D1B] border-[#1A2942] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Add New Challenge</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preset Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propFirm" className="text-[#8B97A8]">Prop Firm</Label>
              <select
                id="propFirm"
                value={selectedFirm}
                onChange={(e) => {
                  setSelectedFirm(e.target.value);
                  setSelectedPresetId("");
                }}
                className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              >
                <option value="">Select a firm</option>
                {firms.map((firm) => (
                  <option key={firm} value={firm}>{firm}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan" className="text-[#8B97A8]">Plan</Label>
              <select
                id="plan"
                value={selectedPresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                disabled={!selectedFirm}
                className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all disabled:opacity-50"
              >
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.planName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Challenge Structure */}
          <div className="space-y-2">
            <Label htmlFor="challengeKind" className="text-[#8B97A8]">Challenge Structure</Label>
            <select
              id="challengeKind"
              value={formData.challengeKind}
              onChange={(e) => {
                const kind = e.target.value as "1-step" | "2-step" | "instant";
                setFormData({
                  ...formData,
                  challengeKind: kind,
                  // reset step targets when leaving 2-step
                  step1ProfitTarget: kind === "2-step" ? formData.step1ProfitTarget : "",
                  step2ProfitTarget: kind === "2-step" ? formData.step2ProfitTarget : "",
                });
              }}
              className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2 focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            >
              <option value="1-step">1 Step</option>
              <option value="2-step">2 Step</option>
              <option value="instant">Instant</option>
            </select>
          </div>

          {/* Basic Fields */}
          <div className="space-y-2">
            <Label htmlFor="accountName" className="text-[#8B97A8]">Account Name</Label>
            <Input
              id="accountName"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              required
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challengeStartDate" className="text-[#8B97A8]">Challenge Start Date (Optional)</Label>
            <Input
              id="challengeStartDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountSize" className="text-[#8B97A8]">Account Size ($)</Label>
              <Input
                id="accountSize"
                type="number"
                value={formData.accountSize}
                onChange={(e) => setFormData({ ...formData, accountSize: e.target.value })}
                required
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseCost" className="text-[#8B97A8]">Purchase Cost ($)</Label>
              <Input
                id="purchaseCost"
                type="number"
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                required
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {formData.challengeKind !== "2-step" && (
              <div className="space-y-2">
                <Label htmlFor="profitTarget" className="text-[#8B97A8]">Profit Target ($)</Label>
                <Input
                  id="profitTarget"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData({ ...formData, profitTarget: e.target.value })}
                  required
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="maxDrawdown" className="text-[#8B97A8]">Max Drawdown ($)</Label>
              <Input
                id="maxDrawdown"
                type="number"
                value={formData.maxDrawdown}
                onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
                required
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
              />
            </div>
          </div>

          {formData.challengeKind === "2-step" && (
            <div className="rounded-xl p-4 bg-[rgba(41,141,255,0.06)] border border-[rgba(41,141,255,0.25)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(41,141,255,0.15)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">2 Step</span>
                <span className="text-xs text-[#8B97A8]">This account will progress through two steps before funding.</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Step 1 Target ($)</Label>
                  <Input
                    type="number"
                    value={formData.step1ProfitTarget}
                    onChange={(e) => setFormData({ ...formData, step1ProfitTarget: e.target.value, profitTarget: e.target.value })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Step 2 Target ($)</Label>
                  <Input
                    type="number"
                    value={formData.step2ProfitTarget}
                    onChange={(e) => setFormData({ ...formData, step2ProfitTarget: e.target.value })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[#8B97A8]">Notes (Optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] focus:border-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 transition-all"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1A2942] text-[#F8FAFC] hover:bg-[#111C33] hover:border-[#2F80ED] rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-[#2F80ED] to-[#1E6BC7] hover:shadow-lg hover:shadow-[#2F80ED]/20 hover:scale-105 transition-all duration-200 text-white rounded-xl">
              Add Challenge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
