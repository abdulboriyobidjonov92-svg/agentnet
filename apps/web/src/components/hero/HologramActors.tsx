/**
 * HologramActors — ekranlardan "chiqib kelayotgan" hologram aktyorlar:
 * Doctor (cyan), Retail Owner (emerald), Cargo Truck, Camera, Chart Panel,
 * Logistics Drone. Har biri o'z faylida ./hologram/ ichida — bu fayl faqat
 * mavjud import yo'lini (`from "./HologramActors"`, HeroCanvas.tsx'da)
 * buzmaslik uchun qayta eksport qiladi.
 */
export { DoctorHologram } from "./hologram/doctor-hologram";
export { RetailOwnerHologram } from "./hologram/retail-owner-hologram";
export { CargoTruckHologram } from "./hologram/cargo-truck-hologram";
export { CameraHologram } from "./hologram/camera-hologram";
export { ChartPanelHologram } from "./hologram/chart-panel-hologram";
export { LogisticsDrone } from "./hologram/logistics-drone";
