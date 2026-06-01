import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Cloud, MonitorPlay } from "lucide-react";

const inputCls =
  "w-full bg-[#0A0C10] border border-[#222731] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-status-cloud placeholder:text-white/25";

export default function SettingsDialog({ open, onClose, settings, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        player_mode: settings.player_mode || "mse",
        motion_detection: settings.motion_detection ?? true,
        go2rtc_public_url: settings.go2rtc_public_url || "",
        tuya: {
          enabled: settings.tuya?.enabled ?? false,
          access_id: settings.tuya?.access_id || "",
          access_secret: settings.tuya?.access_secret || "",
          region: settings.tuya?.region || "eu",
          app_uid: settings.tuya?.app_uid || "",
        },
      });
    }
  }, [settings, open]);

  if (!form) return null;

  const setTuya = (k, v) => setForm((f) => ({ ...f, tuya: { ...f.tuya, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings(form);
      toast.success("Réglages enregistrés");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const testTuya = async () => {
    setTesting(true);
    try {
      await api.updateSettings(form);
      const res = await api.tuyaTest();
      toast.success(`Tuya OK — ${res.camera_count} caméra(s) sur ${res.device_count} appareil(s)`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Échec du test Tuya");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="settings-dialog"
        className="max-w-lg bg-[#12151A] border-[#222731] rounded-sm max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-tight">Réglages</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Player */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white/70">
              <MonitorPlay className="h-4 w-4 text-status-cloud" />
              <h3 className="text-xs uppercase tracking-[0.2em] font-mono">Lecture vidéo</h3>
            </div>
            <div>
              <Label className="text-xs text-white/60">Transport (mode du lecteur)</Label>
              <select
                data-testid="settings-player-mode"
                className={inputCls}
                value={form.player_mode}
                onChange={(e) => setForm((f) => ({ ...f, player_mode: e.target.value }))}
              >
                <option value="mse">MSE (robuste — recommandé en preview cloud)</option>
                <option value="webrtc,mse">WebRTC puis MSE (faible latence — auto-hébergé)</option>
                <option value="webrtc,mse,hls">WebRTC, MSE, HLS (compatibilité max)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-white/60">URL publique go2rtc (auto-hébergement)</Label>
              <input
                className={`${inputCls} font-mono text-xs`}
                value={form.go2rtc_public_url}
                onChange={(e) => setForm((f) => ({ ...f, go2rtc_public_url: e.target.value }))}
                placeholder="https://surveillance-video.quentin-astro.fr"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-white/60">Détection de mouvement</Label>
              <Switch
                data-testid="settings-motion-toggle"
                checked={form.motion_detection}
                onCheckedChange={(v) => setForm((f) => ({ ...f, motion_detection: v }))}
              />
            </div>
          </section>

          {/* Tuya */}
          <section className="space-y-3 border-t border-[#222731] pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/70">
                <Cloud className="h-4 w-4 text-status-cloud" />
                <h3 className="text-xs uppercase tracking-[0.2em] font-mono">Mode Cloud SmartLife</h3>
              </div>
              <Switch
                data-testid="settings-tuya-enabled"
                checked={form.tuya.enabled}
                onCheckedChange={(v) => setTuya("enabled", v)}
              />
            </div>

            {form.tuya.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/60">Access ID</Label>
                    <input className={`${inputCls} font-mono text-xs`} value={form.tuya.access_id} onChange={(e) => setTuya("access_id", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60">Région</Label>
                    <select className={inputCls} value={form.tuya.region} onChange={(e) => setTuya("region", e.target.value)}>
                      <option value="eu">Europe (EU)</option>
                      <option value="us">Amérique (US)</option>
                      <option value="cn">Chine (CN)</option>
                      <option value="in">Inde (IN)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/60">Access Secret</Label>
                  <input type="password" className={`${inputCls} font-mono text-xs`} value={form.tuya.access_secret} onChange={(e) => setTuya("access_secret", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-white/60">App UID (compte SmartLife lié)</Label>
                  <input className={`${inputCls} font-mono text-xs`} value={form.tuya.app_uid} onChange={(e) => setTuya("app_uid", e.target.value)} />
                </div>
                <button
                  data-testid="settings-tuya-test"
                  onClick={testTuya}
                  disabled={testing}
                  className="w-full py-2 border border-[#222731] hover:border-status-cloud text-white/80 text-xs rounded-sm transition-colors disabled:opacity-50"
                >
                  {testing ? "Test en cours..." : "Tester la connexion Tuya"}
                </button>
                <a
                  href="https://iot.tuya.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-status-cloud hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Créer un projet sur iot.tuya.com → Cloud → lier le compte SmartLife (QR)
                </a>
              </>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/60 hover:text-white rounded-sm">
            Fermer
          </button>
          <button
            data-testid="settings-save"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-white text-[#0A0C10] rounded-sm hover:bg-white/85 disabled:opacity-50"
          >
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
