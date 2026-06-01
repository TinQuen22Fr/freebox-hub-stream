import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

const inputCls =
  "w-full bg-[#0A0C10] border border-[#222731] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-status-cloud placeholder:text-white/25";

const empty = {
  name: "",
  type: "indoor",
  mode: "local",
  location: "",
  ip: "",
  rtsp_url: "",
  ptz: { protocol: "cgi", ip: "", port: 8080, username: "admin", password: "", cgi_path: "/cgi-bin/motor.cgi", default_dist: 10 },
  tuya: { device_id: "" },
};

export default function CameraFormDialog({ open, onClose, camera, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editing = !!camera;

  useEffect(() => {
    if (camera) {
      setForm({
        ...empty,
        ...camera,
        rtsp_url: camera.rtsp_url || "",
        location: camera.location || "",
        ip: camera.ip || "",
        ptz: { ...empty.ptz, ...(camera.ptz || {}) },
        tuya: { ...empty.tuya, ...(camera.tuya || {}) },
      });
    } else {
      setForm(empty);
    }
  }, [camera, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPtz = (k, v) => setForm((f) => ({ ...f, ptz: { ...f.ptz, [k]: v } }));

  const showRtsp = form.mode === "local" || form.mode === "hybrid";
  const showTuya = form.mode === "cloud" || form.mode === "hybrid";
  const isRot = form.type === "rotatable";

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        mode: form.mode,
        enabled: true,
        location: form.location || null,
        ip: form.ip || null,
        rtsp_url: showRtsp ? form.rtsp_url || null : null,
        ptz: isRot
          ? {
              ...form.ptz,
              port: Number(form.ptz.port) || 8080,
              default_dist: Number(form.ptz.default_dist) || 10,
            }
          : { protocol: "none" },
        tuya: { device_id: showTuya ? form.tuya.device_id || null : null },
      };
      if (editing) await api.updateCamera(camera.id, payload);
      else await api.createCamera(payload);
      toast.success(editing ? "Caméra mise à jour" : "Caméra ajoutée");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="camera-form-dialog"
        className="max-w-lg bg-[#12151A] border-[#222731] rounded-sm max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-tight">
            {editing ? "Éditer la caméra" : "Nouvelle caméra"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-white/60">Nom</Label>
            <input
              data-testid="form-camera-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Caméra Entrée"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/60">Type</Label>
              <select data-testid="form-camera-type" className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="indoor">Intérieure (fixe)</option>
                <option value="rotatable">Rotative (PTZ)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-white/60">Mode</Label>
              <select data-testid="form-camera-mode" className={inputCls} value={form.mode} onChange={(e) => set("mode", e.target.value)}>
                <option value="local">Local (RTSP)</option>
                <option value="cloud">Cloud (SmartLife)</option>
                <option value="hybrid">Dual (RTSP + Cloud)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/60">Emplacement</Label>
              <input className={inputCls} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Extérieur" />
            </div>
            <div>
              <Label className="text-xs text-white/60">IP locale</Label>
              <input className={inputCls} value={form.ip} onChange={(e) => set("ip", e.target.value)} placeholder="192.168.0.61" />
            </div>
          </div>

          {showRtsp && (
            <div>
              <Label className="text-xs text-white/60">URL RTSP</Label>
              <input
                data-testid="form-camera-rtsp"
                className={`${inputCls} font-mono text-xs`}
                value={form.rtsp_url}
                onChange={(e) => set("rtsp_url", e.target.value)}
                placeholder="rtsp://192.168.0.61:554/main_ch"
              />
              <p className="text-[10px] text-white/30 mt-1 font-mono">
                Toolkit tasarren : rtsp://IP:554/main_ch
              </p>
            </div>
          )}

          {showTuya && (
            <div>
              <Label className="text-xs text-white/60">Tuya Device ID</Label>
              <input
                className={`${inputCls} font-mono text-xs`}
                value={form.tuya.device_id}
                onChange={(e) => setForm((f) => ({ ...f, tuya: { device_id: e.target.value } }))}
                placeholder="bfxxxxxxxxxxxxxxxx"
              />
            </div>
          )}

          {isRot && (
            <div className="border border-[#222731] rounded-sm p-3 space-y-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono">
                Contrôle PTZ
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/60">Protocole</Label>
                  <select className={inputCls} value={form.ptz.protocol} onChange={(e) => setPtz("protocol", e.target.value)}>
                    <option value="cgi">CGI (motor.cgi)</option>
                    <option value="tuya">Tuya Cloud</option>
                    <option value="onvif">ONVIF</option>
                    <option value="none">Aucun</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-white/60">Port</Label>
                  <input className={inputCls} value={form.ptz.port} onChange={(e) => setPtz("port", e.target.value)} placeholder="8080" />
                </div>
              </div>
              {form.ptz.protocol === "cgi" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/60">Utilisateur</Label>
                    <input className={inputCls} value={form.ptz.username} onChange={(e) => setPtz("username", e.target.value)} placeholder="admin" />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60">Mot de passe</Label>
                    <input type="password" className={inputCls} value={form.ptz.password} onChange={(e) => setPtz("password", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/60 hover:text-white rounded-sm">
            Annuler
          </button>
          <button
            data-testid="form-save-camera"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-white text-[#0A0C10] rounded-sm hover:bg-white/85 disabled:opacity-50"
          >
            {saving ? "..." : editing ? "Mettre à jour" : "Ajouter"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
