"""Mock network module for MicroPython emulation."""

from typing import Optional

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
        """Create a WLAN interface object.

        Args:
            interface_id: network.STA_IF (station) or network.AP_IF (access point).
        """
        self.interface_id = interface_id
        self._active = False
        self._connected = False
        self._ssid = None
        self._ip = "192.168.1.100"
        self._subnet = "255.255.255.0"
        self._gateway = "192.168.1.1"
        self._dns = "8.8.8.8"
        # Persistent config state. Keys mirror the documented config()
        # parameter names so callers can round-trip values.
        self._config = {
            "mac": b"\x02\x00\x00\x00\x00\x01",
            "essid": None,
            "channel": 1,
            "hidden": False,
            "authmode": 3,  # WPA2_PSK
            "password": "",
            "txpower": 17,
            "pm": 0,
            "hostname": "micropython",
        }
        state.emit_event("wlan_init", {"interface": interface_id})
    
    def active(self, is_active: Optional[bool] = None):
        """Activate or deactivate the network interface."""
        if is_active is not None:
            self._active = is_active
            state.emit_event("wlan_active", {"interface": self.interface_id, "active": is_active})
        return self._active
    
    def connect(self, ssid: str, password: Optional[str] = None):
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
    
    def status(self, param: Optional[str] = None):
        """Get the status of the wireless interface."""
        if param == "rssi":
            return -50  # Mock signal strength
        return STAT_GOT_IP if self._connected else STAT_IDLE
    
    def ifconfig(self, config: Optional[tuple] = None):
        """Get or set IP-level network interface parameters."""
        if config is not None:
            self._ip, self._subnet, self._gateway, self._dns = config
            state.emit_event("wlan_ifconfig", {"interface": self.interface_id, "config": config})
        return (self._ip, self._subnet, self._gateway, self._dns)
    
    def config(self, *args, **kwargs):
        """Get or set general network interface parameters.

        Args:
            *args: Single key string for a get; multiple are not supported
                by MicroPython either.
            **kwargs: One or more ``key=value`` pairs to set.

        Returns:
            The requested value when called with a single positional key,
            otherwise ``None``.
        """
        if args and not kwargs:
            if len(args) != 1:
                raise ValueError("config() takes exactly one positional key")
            key = args[0]
            if key == "essid":
                return self._ssid if self._ssid is not None else self._config["essid"]
            if key not in self._config:
                raise ValueError("unknown config key: {}".format(key))
            return self._config[key]
        for key, value in kwargs.items():
            if key == "essid":
                self._ssid = value
            if key not in self._config and key != "essid":
                raise ValueError("unknown config key: {}".format(key))
            self._config[key] = value
        if kwargs:
            state.emit_event(
                "wlan_config",
                {"interface": self.interface_id, "keys": list(kwargs)},
            )
        return None

    def ipconfig(self, *args, **kwargs):
        """Get or set IP-level parameters using the v1.22+ ``ipconfig`` API.

        Recognised keys: ``addr4``, ``gw4``, ``dns``, ``has_dhcp4``.

        Args:
            *args: A single key string for a get.
            **kwargs: One or more ``key=value`` pairs to set; ``addr4`` may
                be a ``"a.b.c.d/prefix"`` string or an ``(ip, mask)`` tuple.

        Returns:
            The requested value when called with one positional key, else
            ``None``.
        """
        def _get(key):
            """Resolve a single ipconfig key against current state."""
            if key == "addr4":
                return (self._ip, self._subnet)
            if key == "gw4":
                return self._gateway
            if key == "dns":
                return self._dns
            if key == "has_dhcp4":
                return False
            raise ValueError("unknown ipconfig key: {}".format(key))

        if args and not kwargs:
            if len(args) != 1:
                raise ValueError("ipconfig() takes exactly one positional key")
            return _get(args[0])
        for key, value in kwargs.items():
            if key == "addr4":
                if isinstance(value, tuple):
                    self._ip, self._subnet = value
                elif isinstance(value, str) and "/" in value:
                    ip, _prefix = value.split("/", 1)
                    self._ip = ip
                else:
                    self._ip = value
            elif key == "gw4":
                self._gateway = value
            elif key == "dns":
                self._dns = value
            elif key == "has_dhcp4":
                pass  # No DHCP loop in the mock.
            else:
                raise ValueError("unknown ipconfig key: {}".format(key))
        if kwargs:
            state.emit_event(
                "wlan_ipconfig",
                {"interface": self.interface_id, "keys": list(kwargs)},
            )
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
        """Create a mock LAN (Ethernet) interface."""
        self._active = False
        self._connected = False
        state.emit_event("lan_init", {})
    
    def active(self, is_active: Optional[bool] = None):
        """Activate or deactivate the LAN interface."""
        if is_active is not None:
            self._active = is_active
        return self._active
    
    def isconnected(self) -> bool:
        """Return True if the LAN interface is connected."""
        return self._connected
    
    def ifconfig(self, config: Optional[tuple] = None):
        """Get or set the IP-level network configuration.

        Args:
            config: Optional (ip, subnet, gateway, dns) tuple to set.

        Returns:
            tuple: Current (ip, subnet, gateway, dns) configuration.
        """
        if config:
            return None
        return ("0.0.0.0", "0.0.0.0", "0.0.0.0", "0.0.0.0")


# Helper functions
def hostname(name: Optional[str] = None) -> str:
    """Get or set the network hostname."""
    return "micropython" if name is None else name


def country(code: Optional[str] = None) -> str:
    """Get or set the two-letter country code."""
    return "US" if code is None else code
