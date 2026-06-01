import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

const http = axios.create({ baseURL: API });

export const api = {
  systemStatus: () => http.get("/system/status").then((r) => r.data),
  listCameras: () => http.get("/cameras").then((r) => r.data),
  getCamera: (id) => http.get(`/cameras/${id}`).then((r) => r.data),
  createCamera: (d) => http.post("/cameras", d).then((r) => r.data),
  updateCamera: (id, d) => http.put(`/cameras/${id}`, d).then((r) => r.data),
  deleteCamera: (id) => http.delete(`/cameras/${id}`).then((r) => r.data),
  testCamera: (id) => http.post(`/cameras/${id}/test`).then((r) => r.data),
  ptz: (id, action, dist) =>
    http.post(`/cameras/${id}/ptz`, { action, dist }).then((r) => r.data),
  listMotion: () => http.get("/motion-events").then((r) => r.data),
  simulateMotion: (camera_id) =>
    http.post("/motion-events/simulate", null, { params: { camera_id } }).then((r) => r.data),
  ackMotion: (id) => http.put(`/motion-events/${id}/ack`).then((r) => r.data),
  deleteMotion: (id) => http.delete(`/motion-events/${id}`).then((r) => r.data),
  listRecordings: () => http.get("/recordings").then((r) => r.data),
  createRecording: (id) => http.post(`/cameras/${id}/recordings`).then((r) => r.data),
  deleteRecording: (id) => http.delete(`/recordings/${id}`).then((r) => r.data),
  getSettings: () => http.get("/settings").then((r) => r.data),
  updateSettings: (d) => http.put("/settings", d).then((r) => r.data),
  tuyaStatus: () => http.get("/tuya/status").then((r) => r.data),
  tuyaTest: () => http.post("/tuya/test").then((r) => r.data),
};

export const wsUrl = (streamName) =>
  `${BACKEND}/api/ws?src=${encodeURIComponent(streamName)}`;
export const snapshotUrl = (id) => `${API}/cameras/${id}/snapshot`;
export const motionSnapshotUrl = (id) => `${API}/motion-events/${id}/snapshot`;
export const recordingThumbUrl = (id) => `${API}/recordings/${id}/thumbnail`;
