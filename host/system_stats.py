# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""CPU / GPU / RAM stats via LibreHardwareMonitorLib (pythonnet) with fallbacks."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

CREATE_NO_WINDOW = 0x08000000

# Bundled beside LibreHardwareMonitorLib.dll (from LHM release zip)
_LHM_DEPS = (
    "HidSharp.dll",
    "System.Memory.dll",
    "System.Buffers.dll",
    "System.Numerics.Vectors.dll",
    "System.Runtime.CompilerServices.Unsafe.dll",
    "System.Collections.Immutable.dll",
    "System.Text.Json.dll",
    "System.Text.Encodings.Web.dll",
    "System.IO.Pipelines.dll",
    "System.Threading.Tasks.Extensions.dll",
    "Microsoft.Bcl.AsyncInterfaces.dll",
    "Microsoft.Bcl.HashCode.dll",
    "BlackSharp.Core.dll",
    "RAMSPDToolkit-NDD.dll",
    "DiskInfoToolkit.dll",
)


def _find_lhm_dll(root: Path) -> Path | None:
    candidates = [
        root / "bin" / "LibreHardwareMonitorLib.dll",
        root / "tools" / "bin" / "LibreHardwareMonitorLib.dll",
    ]
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", root))
        candidates.insert(0, meipass / "bin" / "LibreHardwareMonitorLib.dll")
    # Prefer a folder that also has System.Memory.dll (required by LHM Open)
    complete: list[Path] = []
    incomplete: list[Path] = []
    for p in candidates:
        if not p.is_file():
            continue
        if (p.parent / "System.Memory.dll").is_file():
            complete.append(p)
        else:
            incomplete.append(p)
    if complete:
        return complete[0]
    return incomplete[0] if incomplete else None


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


def _nvidia_smi_query(*fields: str) -> list[str] | None:
    smi = _find_nvidia_smi()
    if smi is None:
        return None
    try:
        r = subprocess.run(
            [
                str(smi),
                f"--query-gpu={','.join(fields)}",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=3,
            creationflags=CREATE_NO_WINDOW,
        )
        if r.returncode != 0 or not r.stdout.strip():
            return None
        line = r.stdout.strip().splitlines()[0]
        return [p.strip() for p in line.split(",")]
    except Exception:
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
        import ctypes
        from ctypes import wintypes

        class FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]

        idle1, kernel1, user1 = FILETIME(), FILETIME(), FILETIME()
        idle2, kernel2, user2 = FILETIME(), FILETIME(), FILETIME()
        k32 = ctypes.windll.kernel32
        if k32.GetSystemTimes(ctypes.byref(idle1), ctypes.byref(kernel1), ctypes.byref(user1)):
            time.sleep(0.12)
            if k32.GetSystemTimes(ctypes.byref(idle2), ctypes.byref(kernel2), ctypes.byref(user2)):

                def _q(ft: FILETIME) -> int:
                    return (int(ft.dwHighDateTime) << 32) | int(ft.dwLowDateTime)

                idle = _q(idle2) - _q(idle1)
                kernel = _q(kernel2) - _q(kernel1)
                user = _q(user2) - _q(user1)
                total = kernel + user
                if total > 0:
                    busy = total - idle
                    out["cpuPct"] = max(0, min(100, round((busy / total) * 100.0, 1)))
    except Exception:
        pass

    parts = _nvidia_smi_query("utilization.gpu", "temperature.gpu")
    if parts and len(parts) >= 2:
        try:
            out["gpuPct"] = int(float(parts[0]))
        except Exception:
            pass
        try:
            out["gpuTempC"] = round(float(parts[1]), 1)
        except Exception:
            pass
        out["source"] = "wmi+nvidia-smi"
    elif parts and len(parts) == 1:
        try:
            out["gpuPct"] = int(float(parts[0]))
            out["source"] = "wmi+nvidia-smi"
        except Exception:
            pass
    return out


class HardwareStatsSampler:
    """Cached hardware sampler (TTL 2s). Prefers LHM DLL, falls back to WMI/nvidia-smi."""

    def __init__(self, root: Path, ttl_s: float = 2.0) -> None:
        self._root = root
        self._ttl = ttl_s
        self._cache: dict[str, Any] | None = None
        self._cache_at = 0.0
        self._computer: Any = None
        self._lhm_ok = False
        self._lhm_tried = False
        self._lhm_error: str | None = None
        self._SensorType: Any = None
        self._HardwareType: Any = None

    def _init_lhm(self) -> bool:
        if self._lhm_tried:
            return self._lhm_ok
        self._lhm_tried = True
        dll = _find_lhm_dll(self._root)
        if dll is None:
            self._lhm_error = "LibreHardwareMonitorLib.dll missing"
            return False
        try:
            import clr  # type: ignore

            dll_dir = str(dll.parent)
            if dll_dir not in sys.path:
                sys.path.insert(0, dll_dir)
            try:
                os.add_dll_directory(dll_dir)  # type: ignore[attr-defined]
            except Exception:
                pass
            # Ensure dependency DLLs are loadable from the same folder
            os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")
            clr.AddReference(str(dll))
            from LibreHardwareMonitor.Hardware import (  # type: ignore
                Computer,
                HardwareType,
                SensorType,
            )

            computer = Computer()
            computer.IsCpuEnabled = True
            computer.IsGpuEnabled = True
            computer.IsMemoryEnabled = True
            computer.IsMotherboardEnabled = True
            computer.Open()
            self._computer = computer
            self._SensorType = SensorType
            self._HardwareType = HardwareType
            self._lhm_ok = True
            self._lhm_error = None
            return True
        except Exception as exc:
            self._computer = None
            self._lhm_ok = False
            self._lhm_error = str(exc)[:200]
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

    def _walk_update(self, hw: Any) -> None:
        try:
            hw.Update()
        except Exception:
            pass
        try:
            for sub in hw.SubHardware:
                self._walk_update(sub)
        except Exception:
            pass

    def _collect_sensors(self, hw: Any, out: list[Any]) -> None:
        try:
            out.extend(list(hw.Sensors))
        except Exception:
            pass
        try:
            for sub in hw.SubHardware:
                self._collect_sensors(sub, out)
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
        for name, val in loads:
            if "total" in name or name in ("cpu", "gpu", "memory"):
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
            # 0.0 often means "sensor present but Ring0/PawnIO unavailable"
            if val is None or val <= 1.0 or val > 120:
                continue
            name = (getattr(s, "Name", "") or "").lower()
            temps.append((name, val))
        if not temps:
            return None
        for pref in prefer_names:
            for name, val in temps:
                if pref in name:
                    return round(val, 1)
        for name, val in temps:
            if any(k in name for k in ("package", "tctl", "tdie", "average", "gpu core", "core")):
                if "distance" in name or "max" in name:
                    continue
                return round(val, 1)
        return round(temps[0][1], 1)

    def _sample_lhm(self) -> dict[str, Any]:
        assert self._computer is not None
        HardwareType = self._HardwareType

        cpu_sensors: list[Any] = []
        gpu_sensors: list[Any] = []
        mem_sensors: list[Any] = []
        mb_sensors: list[Any] = []

        for hw in self._computer.Hardware:
            try:
                self._walk_update(hw)
                ht = hw.HardwareType
            except Exception:
                continue
            sensors: list[Any] = []
            self._collect_sensors(hw, sensors)
            ht_name = str(ht)
            try:
                is_cpu = ht == HardwareType.Cpu or "Cpu" in ht_name
                is_gpu = (
                    ht
                    in (
                        getattr(HardwareType, "GpuNvidia", None),
                        getattr(HardwareType, "GpuAmd", None),
                        getattr(HardwareType, "GpuIntel", None),
                    )
                    or "Gpu" in ht_name
                )
                is_mem = ht == HardwareType.Memory or "Memory" in ht_name
                is_mb = ht == HardwareType.Motherboard or "Motherboard" in ht_name
            except Exception:
                is_cpu = "Cpu" in ht_name
                is_gpu = "Gpu" in ht_name
                is_mem = "Memory" in ht_name
                is_mb = "Motherboard" in ht_name

            if is_cpu:
                cpu_sensors.extend(sensors)
            elif is_gpu:
                gpu_sensors.extend(sensors)
            elif is_mem:
                mem_sensors.extend(sensors)
            elif is_mb:
                mb_sensors.extend(sensors)

        cpu_temp = self._pick_temp(cpu_sensors, ("tctl", "tdie", "package", "cpu package", "cpu"))
        if cpu_temp is None:
            # Some boards expose CPU die via motherboard sensors
            cpu_temp = self._pick_temp(mb_sensors, ("cpu", "tctl", "tdie", "package"))

        data = {
            "cpuPct": self._pick_load(cpu_sensors, ("cpu total", "total")),
            "cpuTempC": cpu_temp,
            "gpuPct": self._pick_load(gpu_sensors, ("gpu core", "core", "d3d 3d")),
            "gpuTempC": self._pick_temp(gpu_sensors, ("gpu core", "core", "hot spot", "hotspot")),
            "ramPct": self._pick_load(mem_sensors, ("memory",)),
            "source": "lhm",
        }

        # Fill GPU gaps via nvidia-smi when LHM missed them
        if data["gpuPct"] is None or data["gpuTempC"] is None:
            parts = _nvidia_smi_query("utilization.gpu", "temperature.gpu")
            if parts and len(parts) >= 2:
                if data["gpuPct"] is None:
                    try:
                        data["gpuPct"] = int(float(parts[0]))
                    except Exception:
                        pass
                if data["gpuTempC"] is None:
                    try:
                        data["gpuTempC"] = round(float(parts[1]), 1)
                    except Exception:
                        pass
                data["source"] = "lhm+nvidia-smi"
        return data

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
                if self._lhm_error:
                    data["lhmError"] = self._lhm_error
        else:
            data = _wmi_fallback()
            if self._lhm_error:
                data["lhmError"] = self._lhm_error

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
