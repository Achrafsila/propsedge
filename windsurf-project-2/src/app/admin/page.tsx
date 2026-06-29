"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Shield } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { ChallengeType } from "@/types";
import { motion } from "framer-motion";
import { colors, typography, borderRadius, glassmorphism, gradientText } from "@/design-system";

export default function Admin() {
  const { isAdmin, challengeTypes, addChallengeType, updateChallengeType, deleteChallengeType } = useAdmin();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ChallengeType | null>(null);
  const [formData, setFormData] = useState<Partial<ChallengeType>>({
    propFirmName: "",
    planName: "",
    accountSize: 50000,
    purchaseCost: 0,
    challengeType: "1-step",
    profitTarget: 3000,
    step1ProfitTarget: undefined,
    step2ProfitTarget: undefined,
    maxDrawdown: 2000,
    drawdownMode: "EOD",
    dailyDrawdown: null,
    maxContracts: 3,
    minTradingDays: null,
    consistencyRule: null,
    newsTrading: "allowed",
    payoutDays: null,
    minPayout: null,
    maxPayoutRequest: null,
    payoutSplit: null,
    notes: "",
  });

  const handleAddSubmit = () => {
    if (!formData.propFirmName || !formData.planName) return;

    const newType: ChallengeType = {
      id: `${formData.propFirmName.toLowerCase().replace(/\s+/g, '-')}-${formData.planName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      propFirmName: formData.propFirmName,
      planName: formData.planName,
      accountSize: formData.accountSize || 50000,
      purchaseCost: formData.purchaseCost || 0,
      challengeType: formData.challengeType || "1-step",
      profitTarget: formData.profitTarget || 3000,
      step1ProfitTarget: formData.step1ProfitTarget,
      step2ProfitTarget: formData.step2ProfitTarget,
      maxDrawdown: formData.maxDrawdown || 2000,
      drawdownMode: formData.drawdownMode || "EOD",
      dailyDrawdown: formData.dailyDrawdown || null,
      maxContracts: formData.maxContracts || 3,
      minTradingDays: formData.minTradingDays || null,
      consistencyRule: formData.consistencyRule || null,
      newsTrading: formData.newsTrading || "allowed",
      payoutDays: formData.payoutDays || null,
      minPayout: formData.minPayout || null,
      maxPayoutRequest: formData.maxPayoutRequest || null,
      payoutSplit: formData.payoutSplit || null,
      notes: formData.notes || "",
    };

    addChallengeType(newType);
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEditSubmit = () => {
    if (!editingType || !formData.propFirmName || !formData.planName) return;

    const updatedType: ChallengeType = {
      ...editingType,
      propFirmName: formData.propFirmName,
      planName: formData.planName,
      accountSize: formData.accountSize || 50000,
      purchaseCost: formData.purchaseCost || 0,
      challengeType: formData.challengeType || "1-step",
      profitTarget: formData.profitTarget || 3000,
      step1ProfitTarget: formData.step1ProfitTarget,
      step2ProfitTarget: formData.step2ProfitTarget,
      maxDrawdown: formData.maxDrawdown || 2000,
      drawdownMode: formData.drawdownMode || "EOD",
      dailyDrawdown: formData.dailyDrawdown || null,
      maxContracts: formData.maxContracts || 3,
      minTradingDays: formData.minTradingDays || null,
      consistencyRule: formData.consistencyRule || null,
      newsTrading: formData.newsTrading || "allowed",
      payoutDays: formData.payoutDays || null,
      minPayout: formData.minPayout || null,
      maxPayoutRequest: formData.maxPayoutRequest || null,
      payoutSplit: formData.payoutSplit || null,
      notes: formData.notes || "",
    };

    updateChallengeType(editingType.id, updatedType);
    setIsEditDialogOpen(false);
    setEditingType(null);
    resetForm();
  };

  const handleEdit = (type: ChallengeType) => {
    setEditingType(type);
    setFormData(type);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this challenge type?")) {
      deleteChallengeType(id);
    }
  };

  const resetForm = () => {
    setFormData({
      propFirmName: "",
      planName: "",
      accountSize: 50000,
      purchaseCost: 0,
      profitTarget: 3000,
      maxDrawdown: 2000,
      drawdownMode: "EOD",
      dailyDrawdown: null,
      maxContracts: 3,
      minTradingDays: null,
      consistencyRule: null,
      newsTrading: "allowed",
      payoutDays: null,
      minPayout: null,
      maxPayoutRequest: null,
      payoutSplit: null,
      notes: "",
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-[#298DFF] mx-auto mb-4" />
          <h1 
            className="text-[3rem] font-extrabold text-[#F8FAFC] mb-4"
            style={{ 
              fontSize: typography.fontSize.display, 
              fontWeight: typography.fontWeight.extraBold,
              letterSpacing: typography.letterSpacing.display,
              lineHeight: typography.lineHeight.display,
              background: gradientText.premium,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            Admin Access Required
          </h1>
          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>
            Enable admin mode in settings to access this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 
            className="text-[3rem] font-extrabold text-[#F8FAFC]"
            style={{ 
              fontSize: typography.fontSize.display, 
              fontWeight: typography.fontWeight.extraBold,
              letterSpacing: typography.letterSpacing.display,
              lineHeight: typography.lineHeight.display,
              background: gradientText.premium,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            Admin Panel
          </h1>
          <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>
            Manage challenge types and configurations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <Button 
            className="bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] hover:scale-105 transition-all duration-300 text-white rounded-xl pointer-events-auto"
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Challenge Type
          </Button>
          <DialogContent className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#F8FAFC]">Add New Challenge Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Prop Firm Name</Label>
                  <Input
                    value={formData.propFirmName}
                    onChange={(e) => setFormData({ ...formData, propFirmName: e.target.value })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="e.g., MyFundedFutures"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Plan Name</Label>
                  <Input
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="e.g., Flex Plan 50K"
                  />
                </div>
              </div>
              {/* Challenge Structure */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Challenge Structure</Label>
                  <select
                    value={formData.challengeType}
                    onChange={(e) => setFormData({ ...formData, challengeType: e.target.value as any })}
                    className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                  >
                    <option value="1-step">1 Step</option>
                    <option value="2-step">2 Step</option>
                    <option value="instant">Instant</option>
                  </select>
                </div>
                {formData.challengeType === "2-step" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-[#8B97A8]">Step 1 Target ($)</Label>
                      <Input
                        type="number"
                        value={formData.step1ProfitTarget ?? ""}
                        onChange={(e) => setFormData({ ...formData, step1ProfitTarget: e.target.value ? Number(e.target.value) : undefined })}
                        className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                        placeholder="e.g., 3000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#8B97A8]">Step 2 Target ($)</Label>
                      <Input
                        type="number"
                        value={formData.step2ProfitTarget ?? ""}
                        onChange={(e) => setFormData({ ...formData, step2ProfitTarget: e.target.value ? Number(e.target.value) : undefined })}
                        className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                        placeholder="e.g., 6000"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Account Size ($)</Label>
                  <Input
                    type="number"
                    value={formData.accountSize}
                    onChange={(e) => setFormData({ ...formData, accountSize: Number(e.target.value) })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Purchase Cost ($)</Label>
                  <Input
                    type="number"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Profit Target ($)</Label>
                  <Input
                    type="number"
                    value={formData.profitTarget}
                    onChange={(e) => setFormData({ ...formData, profitTarget: Number(e.target.value) })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Max Drawdown ($)</Label>
                  <Input
                    type="number"
                    value={formData.maxDrawdown}
                    onChange={(e) => setFormData({ ...formData, maxDrawdown: Number(e.target.value) })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Drawdown Mode</Label>
                  <select
                    value={formData.drawdownMode}
                    onChange={(e) => setFormData({ ...formData, drawdownMode: e.target.value as any })}
                    className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                  >
                    <option value="EOD">EOD</option>
                    <option value="Daily">Daily</option>
                    <option value="Trailing">Trailing</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Daily Drawdown ($)</Label>
                  <Input
                    type="number"
                    value={formData.dailyDrawdown || ""}
                    onChange={(e) => setFormData({ ...formData, dailyDrawdown: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Max Contracts</Label>
                  <Input
                    type="number"
                    value={formData.maxContracts}
                    onChange={(e) => setFormData({ ...formData, maxContracts: Number(e.target.value) })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Min Trading Days</Label>
                  <Input
                    type="number"
                    value={formData.minTradingDays || ""}
                    onChange={(e) => setFormData({ ...formData, minTradingDays: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Consistency Rule</Label>
                  <Input
                    value={formData.consistencyRule || ""}
                    onChange={(e) => setFormData({ ...formData, consistencyRule: e.target.value || null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="e.g., 50%"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">News Trading</Label>
                  <select
                    value={formData.newsTrading}
                    onChange={(e) => setFormData({ ...formData, newsTrading: e.target.value })}
                    className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                  >
                    <option value="allowed">Allowed</option>
                    <option value="restricted">Restricted</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Payout Days</Label>
                  <Input
                    type="number"
                    value={formData.payoutDays || ""}
                    onChange={(e) => setFormData({ ...formData, payoutDays: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Min Payout ($)</Label>
                  <Input
                    type="number"
                    value={formData.minPayout || ""}
                    onChange={(e) => setFormData({ ...formData, minPayout: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Max Payout ($)</Label>
                  <Input
                    type="number"
                    value={formData.maxPayoutRequest || ""}
                    onChange={(e) => setFormData({ ...formData, maxPayoutRequest: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B97A8]">Payout Split (%)</Label>
                  <Input
                    type="number"
                    value={formData.payoutSplit || ""}
                    onChange={(e) => setFormData({ ...formData, payoutSplit: e.target.value ? Number(e.target.value) : null })}
                    className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Additional notes..."
                />
              </div>
              <Button 
                onClick={handleAddSubmit}
                className="w-full bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] transition-all duration-300 text-white rounded-xl"
              >
                Add Challenge Type
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Challenge Types List */}
      <div className="grid grid-cols-1 gap-4">
        {challengeTypes.map((type, index) => (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card
              className="relative transition-all duration-300 hover:shadow-lg"
              style={{
                background: glassmorphism.card.background,
                backdropFilter: glassmorphism.card.backdropBlur,
                border: '1px solid',
                borderColor: 'rgba(148, 163, 184, 0.08)',
                borderRadius: borderRadius.xl,
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 
                        className="text-[#F8FAFC]"
                        style={{ 
                          fontSize: typography.fontSize.section, 
                          fontWeight: typography.fontWeight.bold,
                          letterSpacing: typography.letterSpacing.section
                        }}
                      >
                        {type.propFirmName}
                      </h3>
                      <span className="text-[#94A3B8]">•</span>
                      <p
                        className="text-[#298DFF]"
                        style={{
                          fontSize: typography.fontSize.base,
                          fontWeight: typography.fontWeight.medium
                        }}
                      >
                        {type.planName}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(41,141,255,0.12)] text-[#298DFF] border border-[rgba(41,141,255,0.3)]">
                        {type.challengeType === "2-step" ? "2 Step" : type.challengeType === "instant" ? "Instant" : "1 Step"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p 
                          className="text-[#94A3B8]"
                          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}
                        >
                          Account Size
                        </p>
                        <p className="text-[#F8FAFC] font-medium">${type.accountSize.toLocaleString()}</p>
                      </div>
                      <div>
                        <p 
                          className="text-[#94A3B8]"
                          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}
                        >
                          Cost
                        </p>
                        <p className="text-[#F8FAFC] font-medium">${type.purchaseCost}</p>
                      </div>
                      {type.challengeType === "2-step" ? (
                        <>
                          <div>
                            <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Step 1 Target</p>
                            <p className="text-[#10B981] font-medium">${(type.step1ProfitTarget ?? type.profitTarget).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Step 2 Target</p>
                            <p className="text-[#10B981] font-medium">${(type.step2ProfitTarget ?? type.profitTarget).toLocaleString()}</p>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="text-[#94A3B8]" style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}>Profit Target</p>
                          <p className="text-[#10B981] font-medium">${type.profitTarget.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p 
                          className="text-[#94A3B8]"
                          style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.secondary }}
                        >
                          Max Drawdown
                        </p>
                        <p className="text-[#EF4444] font-medium">${type.maxDrawdown}</p>
                      </div>
                    </div>
                    {type.notes && (
                      <p 
                        className="text-[#64748B] mt-3 text-sm"
                        style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                      >
                        {type.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(type)}
                      className="border-[rgba(148,163,184,0.2)] text-[#F8FAFC] hover:bg-[rgba(41,141,255,0.1)] hover:border-[#298DFF]"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(type.id)}
                      className="border-[rgba(239,68,68,0.2)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] hover:border-[#EF4444]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">Edit Challenge Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Prop Firm Name</Label>
                <Input
                  value={formData.propFirmName}
                  onChange={(e) => setFormData({ ...formData, propFirmName: e.target.value })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Plan Name</Label>
                <Input
                  value={formData.planName}
                  onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
            </div>
            {/* Challenge Structure */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Challenge Structure</Label>
                <select
                  value={formData.challengeType}
                  onChange={(e) => setFormData({ ...formData, challengeType: e.target.value as any })}
                  className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                >
                  <option value="1-step">1 Step</option>
                  <option value="2-step">2 Step</option>
                  <option value="instant">Instant</option>
                </select>
              </div>
              {formData.challengeType === "2-step" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-[#8B97A8]">Step 1 Target ($)</Label>
                    <Input
                      type="number"
                      value={formData.step1ProfitTarget ?? ""}
                      onChange={(e) => setFormData({ ...formData, step1ProfitTarget: e.target.value ? Number(e.target.value) : undefined })}
                      className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                      placeholder="e.g., 3000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8B97A8]">Step 2 Target ($)</Label>
                    <Input
                      type="number"
                      value={formData.step2ProfitTarget ?? ""}
                      onChange={(e) => setFormData({ ...formData, step2ProfitTarget: e.target.value ? Number(e.target.value) : undefined })}
                      className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                      placeholder="e.g., 6000"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Account Size ($)</Label>
                <Input
                  type="number"
                  value={formData.accountSize}
                  onChange={(e) => setFormData({ ...formData, accountSize: Number(e.target.value) })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Purchase Cost ($)</Label>
                <Input
                  type="number"
                  value={formData.purchaseCost}
                  onChange={(e) => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Profit Target ($)</Label>
                <Input
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData({ ...formData, profitTarget: Number(e.target.value) })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Max Drawdown ($)</Label>
                <Input
                  type="number"
                  value={formData.maxDrawdown}
                  onChange={(e) => setFormData({ ...formData, maxDrawdown: Number(e.target.value) })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Drawdown Mode</Label>
                <select
                  value={formData.drawdownMode}
                  onChange={(e) => setFormData({ ...formData, drawdownMode: e.target.value as any })}
                  className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                >
                  <option value="EOD">EOD</option>
                  <option value="Daily">Daily</option>
                  <option value="Trailing">Trailing</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Daily Drawdown ($)</Label>
                <Input
                  type="number"
                  value={formData.dailyDrawdown || ""}
                  onChange={(e) => setFormData({ ...formData, dailyDrawdown: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Max Contracts</Label>
                <Input
                  type="number"
                  value={formData.maxContracts}
                  onChange={(e) => setFormData({ ...formData, maxContracts: Number(e.target.value) })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Min Trading Days</Label>
                <Input
                  type="number"
                  value={formData.minTradingDays || ""}
                  onChange={(e) => setFormData({ ...formData, minTradingDays: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Consistency Rule</Label>
                <Input
                  value={formData.consistencyRule || ""}
                  onChange={(e) => setFormData({ ...formData, consistencyRule: e.target.value || null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="e.g., 50%"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">News Trading</Label>
                <select
                  value={formData.newsTrading}
                  onChange={(e) => setFormData({ ...formData, newsTrading: e.target.value })}
                  className="w-full bg-[#0D1424] border-[#1A2942] text-[#F8FAFC] rounded-lg px-3 py-2"
                >
                  <option value="allowed">Allowed</option>
                  <option value="restricted">Restricted</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Payout Days</Label>
                <Input
                  type="number"
                  value={formData.payoutDays || ""}
                  onChange={(e) => setFormData({ ...formData, payoutDays: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Min Payout ($)</Label>
                <Input
                  type="number"
                  value={formData.minPayout || ""}
                  onChange={(e) => setFormData({ ...formData, minPayout: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Max Payout ($)</Label>
                <Input
                  type="number"
                  value={formData.maxPayoutRequest || ""}
                  onChange={(e) => setFormData({ ...formData, maxPayoutRequest: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B97A8]">Payout Split (%)</Label>
                <Input
                  type="number"
                  value={formData.payoutSplit || ""}
                  onChange={(e) => setFormData({ ...formData, payoutSplit: e.target.value ? Number(e.target.value) : null })}
                  className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#8B97A8]">Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-[#0D1424] border-[#1A2942] text-[#F8FAFC]"
                placeholder="Additional notes..."
              />
            </div>
            <Button 
              onClick={handleEditSubmit}
              className="w-full bg-gradient-to-r from-[#298DFF] to-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] transition-all duration-300 text-white rounded-xl"
            >
              Update Challenge Type
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
