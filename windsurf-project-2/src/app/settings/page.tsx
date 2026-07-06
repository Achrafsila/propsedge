"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { colors, typography, borderRadius, glassmorphism, gradientText } from "@/design-system";
import { useAdmin } from "@/context/AdminContext";
import { useAuth } from "@/context/AuthContext";
import { useTradingMode } from "@/context/TradingModeContext";

export default function Settings() {
  const { isAdmin, toggleAdmin } = useAdmin();
  const { user } = useAuth();
  const { isPropFirmMode, isPersonalCapitalMode, setTradingMode } = useTradingMode();

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "User";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const accountId = user?.id
    ? `ACC-${user.id.slice(0, 8).toUpperCase()}`
    : "—";

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cardVariants = {
    hover: {
      y: -4,
      transition: { duration: 0.3 }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
          Settings
        </h1>
        <p className="text-[#94A3B8] mt-2" style={{ fontSize: typography.fontSize.base, opacity: typography.opacity.tertiary }}>Manage your account and preferences</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-6"
      >
        {/* Profile Settings */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(41,141,255, 0.1)' }}
              >
                <User className="w-6 h-6 text-[#298DFF]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Profile Settings
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label 
                    className="text-[#94A3B8]"
                    style={{ 
                      fontSize: typography.fontSize.sm, 
                      fontWeight: typography.fontWeight.medium,
                      letterSpacing: typography.letterSpacing.label,
                      opacity: typography.opacity.secondary,
                      textTransform: typography.textTransform.uppercase
                    }}
                  >
                    Full Name
                  </label>
                  <div className="p-3 rounded-xl text-[#F8FAFC]"
                    style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                  >
                    {displayName}
                  </div>
                </div>
                <div className="space-y-2">
                  <label 
                    className="text-[#94A3B8]"
                    style={{ 
                      fontSize: typography.fontSize.sm, 
                      fontWeight: typography.fontWeight.medium,
                      letterSpacing: typography.letterSpacing.label,
                      opacity: typography.opacity.secondary,
                      textTransform: typography.textTransform.uppercase
                    }}
                  >
                    Email
                  </label>
                  <div className="p-3 rounded-xl text-[#F8FAFC]"
                    style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                  >
                    {user?.email ?? "—"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label 
                  className="text-[#94A3B8]"
                  style={{ 
                    fontSize: typography.fontSize.sm, 
                    fontWeight: typography.fontWeight.medium,
                    letterSpacing: typography.letterSpacing.label,
                    opacity: typography.opacity.secondary,
                    textTransform: typography.textTransform.uppercase
                  }}
                >
                  Timezone
                </label>
                <div className="p-3 rounded-xl text-[#F8FAFC]"
                  style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                >
                  {timezone}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Bell className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Notifications
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Email Notifications
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Receive updates via email
                  </p>
                </div>
                <Badge variant="default" className="bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Payout Alerts
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Get notified when payout is ready
                  </p>
                </div>
                <Badge variant="default" className="bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Rule Violation Alerts
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Alert when near rule limits
                  </p>
                </div>
                <Badge variant="default" className="bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Marketing Emails
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Receive promotional content
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#94A3B8]">Disabled</Badge>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Security Settings */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.1)' }}
              >
                <Shield className="w-6 h-6 text-[#10B981]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Security
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Two-Factor Authentication
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Add an extra layer of security
                  </p>
                </div>
                <Badge variant="default" className="bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.3)]">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Password Last Changed
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    30 days ago
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#94A3B8]">Update</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Active Sessions
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    2 devices logged in
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#94A3B8]">Manage</Badge>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Appearance */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <Palette className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Appearance
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Theme
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Dark mode by default
                  </p>
                </div>
                <Badge variant="default" className="bg-[rgba(59,130,246,0.2)] text-[#3B82F6] border border-[rgba(59,130,246,0.3)]">Dark</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Accent Color
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Purple gradient accent
                  </p>
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#298DFF] to-[#3B82F6]" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Data & Storage */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(148, 163, 184, 0.1)' }}
              >
                <Database className="w-6 h-6 text-[#94A3B8]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Data & Storage
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Export Trade Data
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Download your trading history
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#94A3B8]">Export</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Clear Cache
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Clear local stored data
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(148,163,184,0.2)] text-[#94A3B8]">Clear</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Delete Account
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Permanently delete your account
                  </p>
                </div>
                <Badge variant="outline" className="border-[rgba(239,68,68,0.3)] text-[#EF4444]">Delete</Badge>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Admin Settings */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(41,141,255, 0.1)' }}
              >
                <Shield className="w-6 h-6 text-[#298DFF]" />
              </div>
              <h3 
                className="text-[#F8FAFC]"
                style={{ 
                  fontSize: typography.fontSize.section, 
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Admin Access
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
              >
                <div>
                  <p 
                    className="text-[#F8FAFC]"
                    style={{ 
                      fontSize: typography.fontSize.base, 
                      fontWeight: typography.fontWeight.medium
                    }}
                  >
                    Admin Mode
                  </p>
                  <p 
                    className="text-[#64748B]"
                    style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                  >
                    Enable to manage challenge types
                  </p>
                </div>
                <Button
                  onClick={toggleAdmin}
                  className={isAdmin 
                    ? "bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.4)] hover:bg-[rgba(16,185,129,0.3)]" 
                    : "bg-[rgba(148,163,184,0.2)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] hover:bg-[rgba(148,163,184,0.3)]"
                  }
                  style={{ borderRadius: '9999px', padding: '0.5rem 1.5rem' }}
                >
                  {isAdmin ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Trading Mode */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129, 0.1)' }}
              >
                <Layers className="w-6 h-6 text-[#10B981]" />
              </div>
              <h3
                className="text-[#F8FAFC]"
                style={{
                  fontSize: typography.fontSize.section,
                  fontWeight: typography.fontWeight.bold,
                  letterSpacing: typography.letterSpacing.section
                }}
              >
                Trading Mode
              </h3>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
            >
              <div>
                <p
                  className="text-[#F8FAFC]"
                  style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.medium
                  }}
                >
                  {isPropFirmMode ? "Prop Firm" : "Personal Capital"}
                </p>
                <p
                  className="text-[#64748B]"
                  style={{ fontSize: typography.fontSize.xs, opacity: typography.opacity.tertiary }}
                >
                  Switch between prop firm challenges/funded accounts and personal capital tracking
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setTradingMode("prop-firm")}
                  className={isPropFirmMode
                    ? "bg-[rgba(41,141,255,0.2)] text-[#298DFF] border border-[rgba(41,141,255,0.4)] hover:bg-[rgba(41,141,255,0.3)]"
                    : "bg-[rgba(148,163,184,0.2)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] hover:bg-[rgba(148,163,184,0.3)]"
                  }
                  style={{ borderRadius: '9999px', padding: '0.5rem 1.25rem' }}
                >
                  Prop Firm
                </Button>
                <Button
                  onClick={() => setTradingMode("personal-capital")}
                  className={isPersonalCapitalMode
                    ? "bg-[rgba(16,185,129,0.2)] text-[#10B981] border border-[rgba(16,185,129,0.4)] hover:bg-[rgba(16,185,129,0.3)]"
                    : "bg-[rgba(148,163,184,0.2)] text-[#94A3B8] border border-[rgba(148,163,184,0.4)] hover:bg-[rgba(148,163,184,0.3)]"
                  }
                  style={{ borderRadius: '9999px', padding: '0.5rem 1.25rem' }}
                >
                  Personal Capital
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Account Info */}
        <motion.div variants={itemVariants}>
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            className="relative rounded-xl p-6 transition-all duration-300"
            style={{
              background: glassmorphism.card.background,
              backdropFilter: glassmorphism.card.backdropBlur,
              border: '1px solid',
              borderColor: 'rgba(148, 163, 184, 0.08)',
              borderRadius: borderRadius.xl,
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(41,141,255, 0.1)' }}
              >
                <SettingsIcon className="w-6 h-6 text-[#298DFF]" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8FAFC]">Account Information</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#94A3B8]">Account Type</label>
                  <div className="p-3 rounded-xl text-[#F8FAFC]"
                    style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                  >
                    Pro Account
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#94A3B8]">Member Since</label>
                  <div className="p-3 rounded-xl text-[#F8FAFC]"
                    style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                  >
                    {memberSince}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#94A3B8]">Account ID</label>
                <div className="p-3 rounded-xl text-[#F8FAFC] font-mono"
                  style={{ background: 'rgba(11, 18, 32, 0.5)', border: '1px solid rgba(148, 163, 184, 0.08)' }}
                >
                  {accountId}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
