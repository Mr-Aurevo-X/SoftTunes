# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# PyInstaller runtime hook — runs before opti_host / webview / pythonnet.

from motw_unblock import strip_bundle_motw

strip_bundle_motw()
