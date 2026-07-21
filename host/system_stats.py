"""CPU / GPU / RAM stats via LibreHardwareMonitorLib (pythonnet) with WMI fallback."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

CREATE_NO_WINDOW = 0x08000000


def _find_lhm_dll(root: Path) -> Path | None:
    candidates = [
        root / "bin" / "LibreHardwareMonitorLib.dll",
        root / "tools" / "bin" / "LibreHardwareMonitorLib.dll",
    ]
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", root))
        candidates.insert(0, meipass / "bin" / "LibreHardwareMonitorLib.dll")
    for p in candidates:
        if p.is_file():
            return p
    return None


def _find_nvidia_smi() -> Path | None:
    for key in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(key)
        if not base:
            continue
        p = Path(base) / "NVIDIA Corporation" / "NVSMI" / "nvidia-smi.exe"
        if p.is_file():
            return p
    sys32 = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "nvidia-smi.exe"
    if sys32.is_file():
        return sys32
    return None


def _wmi_fallback() -> dict[str, Any]:
    out: dict[str, Any] = {
        "cpuPct": None,
        "cpuTempC": None,
        "gpuPct": None,
        "gpuTempC": None,
        "ramPct": None,
        "source": "wmi",
    }
    try:
        import ctypes
        from ctypes import wintypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", wintypes.DWORD),
                ("dwMemoryLoad", wintypes.DWORD),
                ("ullTotalPhys", ctypes.c_uint64),
                ("ullAvailPhys", ctypes.c_uint64),
                ("ullTotalPageFile", ctypes.c_uint64),
                ("ullAvailPageFile", ctypes.c_uint64),
                ("ullTotalVirtual", ctypes.c_uint64),
                ("ullAvailVirtual", ctypes.c_uint64),
                ("ullAvailExtendedVirtual", ctypes.c_uint64),
            ]

        st = MEMORYSTATUSEX()
        st.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):
            out["ramPct"] = float(st.dwMemoryLoad)
    except Exception:
        pass

    try:
        # Quick CPU load via PDH-less WMI through powershell would be slow;
        # use idle tick delta via GetSystemTimes if possible.
        import ctypes
        from ctypes import wintypes

        class FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]

        idle1, kernel1, user1 = FILETIME(), FILETIME(), FILETIME()
        idle2, kernel2, user2 = FILETIME(), FILETIME(), FILETIME()
        k32 = ctypes.windll.kernel32
        if k32.GetSystemTimes(ctypes.byref(idle1), ctypes.byref(kernel1), ctypes.byref(user1)):
            time.sleep(0.15)
            if k32.GetSystemTimes(ctypes.byref(idle2), ctypes.byref(kernel2), ctypes.byref(user2)):

                def _q(ft: FILETIME) -> int:
                    return (int(ft.dwHighDateTime) << 32) | int(ft.dwLowDateTime)

                idle = _q(idle2) - _q(idle1)
                kernel = _q(kernel2) - _q(kernel1)
                user = _q(user2) - _q(user1)
                total = kernel + user
                if total > 0:
                    # kernel includes idle
                    busy = total - idle
                    out["cpuPct"] = max(0, min(100, round((busy / total) * 100.0, 1)))
    except Exception:
        pass

    smi = _find_nvidia_smi()
    if smi is not None:
        try:
            r = subprocess.run(
                [
                    str(smi),
                    "--query-gpu=utilization.gpu",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=3,
                creationflags=CREATE_NO_WINDOW,
            )
            if r.returncode == 0 and r.stdout.strip():
                out["gpuPct"] = int(float(r.stdout.strip().splitlines()[0].strip()))
                out["source"] = "wmi+nvidia-smi"
        except Exception:
            pass
    return out


class HardwareStatsSampler:
    """Cached hardware sampler (TTL 2s). Prefers LHM DLL, falls back to WMI."""

    def __init__(self, root: Path, ttl_s: float = 2.0) -> None:
        self._root = root
        self._ttl = ttl_s
        self._cache: dict[str, Any] | None = None
        self._cache_at = 0.0
        self._computer: Any = None
        self._visitor: Any = None
        self._lhm_ok = False
        self._lhm_tried = False
        self._SensorType: Any = None
        self._HardwareType: Any = None

    def _init_lhm(self) -> bool:
        if self._lhm_tried:
            return self._lhm_ok
        self._lhm_tried = True
        dll = _find_lhm_dll(self._root)
        if dll is None:
            return False
        try:
            import clr  # type: ignore

            dll_dir = str(dll.parent)
            if dll_dir not in sys.path:
                sys.path.insert(0, dll_dir)
            os.add_dll_directory(dll_dir)  # type: ignore[attr-defined]
            clr.AddReference(str(dll))
            from LibreHardwareMonitor.Hardware import (  # type: ignore
                Computer,
                HardwareType,
                IVisitor,
                SensorType,
            )

            class UpdateVisitor(IVisitor):
                def VisitComputer(self, computer):  # noqa: N802
                    computer.Traverse(self)

                def VisitHardware(self, hardware):  # noqa: N802
                    hardware.Update()
                    for sub in hardware.SubHardware:
                        sub.Accept(self)

                def VisitSensor(self, sensor):  # noqa: N802
                    pass

                def VisitParameter(self, parameter):  # noqa: N802
                    pass

            computer = Computer()
            computer.IsCpuEnabled = True
            computer.IsGpuEnabled = True
            computer.IsMemoryEnabled = True
            computer.Open()
            self._computer = computer
            self._visitor = UpdateVisitor()
            self._SensorType = SensorType
            self._HardwareType = HardwareType
            self._lhm_ok = True
            return True
        except Exception:
            self._computer = None
            self._lhm_ok = False
            return False

    def _sensor_val(self, sensor: Any) -> float | None:
        try:
            v = sensor.Value
            if v is None:
                return None
            f = float(v)
            if f != f:  # NaN
                return None
            return f
        except Exception:
            return None

    def _iter_hardware(self, hw: Any):
        yield hw
        try:
            for sub in hw.SubHardware:
                yield from self._iter_hardware(sub)
        except Exception:
            pass

    def _pick_load(self, sensors: list[Any], prefer_names: tuple[str, ...]) -> float | None:
        SensorType = self._SensorType
        loads = []
        for s in sensors:
            try:
                if s.SensorType != SensorType.Load:
                    continue
            except Exception:
                continue
            val = self._sensor_val(s)
            if val is None or val < 0 or val > 100:
                continue
            name = (getattr(s, "Name", "") or "").lower()
            loads.append((name, val))
        if not loads:
            return None
        for pref in prefer_names:
            for name, val in loads:
                if pref in name:
                    return round(val, 1)
        # Prefer "CPU Total" / "GPU Core" style over per-core
        for name, val in loads:
            if "total" in name or "core" in name or name in ("cpu", "gpu", "memory"):
                return round(val, 1)
        return round(loads[0][1], 1)

    def _pick_temp(self, sensors: list[Any], prefer_names: tuple[str, ...]) -> float | None:
        SensorType = self._SensorType
        temps = []
        for s in sensors:
            try:
                if s.SensorType != SensorType.Temperature:
                    continue
            except Exception:
                continue
            val = self._sensor_val(s)
            if val is None or val <= 0 or val > 120:
                continue
            name = (getattr(s, "Name", "") or "").lower()
            temps.append((name, val))
        if not temps:
            return None
        for pref in prefer_names:
            for name, val in temps:
                if pref in name:
                    return round(val, 1)
        # Prefer package/tctl/tdie over per-core
        for name, val in temps:
            if any(k in name for k in ("package", "tctl", "tdie", "average", "core")):
                return round(val, 1)
        return round(temps[0][1], 1)

    def _sample_lhm(self) -> dict[str, Any]:
        assert self._computer is not None
        HardwareType = self._HardwareType
        self._computer.Accept(self._visitor)

        cpu_sensors: list[Any] = []
        gpu_sensors: list[Any] = []
        mem_sensors: list[Any] = []

        for hw in self._computer.Hardware:
            try:
                ht = hw.HardwareType
            except Exception:
                continue
            sensors: list[Any] = []
            for node in self._iter_hardware(hw):
                try:
                    sensors.extend(list(node.Sensors))
                except Exception:
                    pass
            ht_name = str(ht)
            if ht == HardwareType.Cpu or "Cpu" in ht_name:
                cpu_sensors.extend(sensors)
            elif (
                ht in (HardwareType.GpuNvidia, HardwareType.GpuAmd, HardwareType.GpuIntel)
                or "Gpu" in ht_name
            ):
                gpu_sensors.extend(sensors)
            elif ht == HardwareType.Memory or "Memory" in ht_name:
                mem_sensors.extend(sensors)

        return {
            "cpuPct": self._pick_load(cpu_sensors, ("cpu total", "total")),
            "cpuTempC": self._pick_temp(cpu_sensors, ("tctl", "tdie", "package", "cpu package")),
            "gpuPct": self._pick_load(gpu_sensors, ("gpu core", "core", "d3d 3d", "3d")),
            "gpuTempC": self._pick_temp(gpu_sensors, ("gpu core", "core", "hot spot", "hotspot")),
            "ramPct": self._pick_load(mem_sensors, ("memory", "used")),
            "source": "lhm",
        }

    def sample(self) -> dict[str, Any]:
        now = time.monotonic()
        if self._cache is not None and (now - self._cache_at) < self._ttl:
            return dict(self._cache)

        data: dict[str, Any]
        if self._init_lhm():
            try:
                data = self._sample_lhm()
            except Exception:
                data = _wmi_fallback()
        else:
            data = _wmi_fallback()

        self._cache = data
        self._cache_at = now
        return dict(data)

    def close(self) -> None:
        if self._computer is not None:
            try:
                self._computer.Close()
            except Exception:
                pass
        self._computer = None
        self._lhm_ok = False
        self._cache = None
