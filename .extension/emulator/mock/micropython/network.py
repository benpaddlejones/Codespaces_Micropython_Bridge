"""Mock network module for MicroPython emulation."""

import state

# Network modes
STA_IF = 0
AP_IF = 1

# Status codes
STAT_IDLE = 0
STAT_CONNECTING = 1
STAT_GOT_IP = 3
STAT_WRONG_PASSWORD = 4
STAT_NO_AP_FOUND = 5


class WLAN:
    """Mock WLAN interface."""
    
    def __init__(self, interface_id: int):
        self.interface_id = interface_id
        self._active = False
        self._connected = False
        self._ssid = None
        self._ip = "192.168.1.100"
        self._subnet = "255.255.255.0"
        self._gateway = "192.168.1.1"
        self._dns = "8.8.8.8"
        state.emit_event("wlan_init", {"interface": interface_id})
    
    def active(self, is_active: bool = None):
        """Activate or deactivate the network interface."""
        if is_active is not None:
            self._active = is_active
            state.emit_event("wlan_active", {"interface": self.interface_id, "active": is_active})
        return self._active
    
    def connect(self, ssid: str, password: str = None):
        """Connect to a wireless access point."""
        self._ssid = ssid
        self._connected = True
        state.emit_event("wlan_connect", {
            "interface": self.interface_id,
            "ssid": ssid,
            "ip": self._ip,
            "subnet": self._subnet,
            "gateway": self._gateway,
        })
    
    def disconnect(self):
        """Disconnect from the wireless access point."""
        self._connected = False
        self._ssid = None
        state.emit_event("wlan_disconnect", {"interface": self.interface_id})
    
    def isconnected(self) -> bool:
        """Check if connected to a wireless access point."""
        return self._connected
    
    def status(self, param: str = None):
        """Get the status of the wireless interface."""
        if param == "rssi":
            return -50  # Mock signal strength
        return STAT_GOT_IP if self._connected else STAT_IDLE
    
    def ifconfig(self, config: tuple = None):
        """Get or set IP-level network interface parameters."""
        if config is not None:
            self._ip, self._subnet, self._gateway, self._dns = config
            state.emit_event("wlan_ifconfig", {"interface": self.interface_id, "config": config})
        return (self._ip, self._subnet, self._gateway, self._dns)
    
    def config(self, *args, **kwargs):
        """Get or set general network interface parameters."""
        if "essid" in kwargs:
            self._ssid = kwargs["essid"]
        if "channel" in kwargs:
            pass  # Mock - ignore channel
        return None
    
    def scan(self):
        """Scan for available wireless networks."""
        # Return mock networks
        state.emit_event("wlan_scan", {"interface": self.interface_id})
        return [
            (b"MockNetwork1", b"\x00\x11\x22\x33\x44\x55", 6, -45, 3, False),
            (b"MockNetwork2", b"\xaa\xbb\xcc\xdd\xee\xff", 11, -60, 4, False),
        ]


# Mock ethernet interface (stub)
class LAN:
    """Mock LAN interface (Ethernet)."""
    
    def __init__(self, *args, **kwargs):
        self._active = False
        self._connected = False
        state.emit_event("lan_init", {})
    
    def active(self, is_active: bool = None):
        if is_active is not None:
            self._active = is_active
        return self._active
    
    def isconnected(self) -> bool:
        return self._connected
    
    def ifconfig(self, config: tuple = None):
        if config:
            return None
        return ("0.0.0.0", "0.0.0.0", "0.0.0.0", "0.0.0.0")


# Helper functions
def hostname(name: str = None) -> str:
    """Get or set the network hostname."""
    return "micropython" if name is None else name


def country(code: str = None) -> str:
    """Get or set the two-letter country code."""
    return "US" if code is None else code
