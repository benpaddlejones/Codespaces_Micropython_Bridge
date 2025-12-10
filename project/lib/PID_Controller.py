import time

"""
PID Controller Module

A robust PID (Proportional-Integral-Derivative) controller implementation for real-time control systems.

Features:
- Configurable PID gains (Kp, Ki, Kd)
- Adjustable sample time
- Control signal bounds with anti-windup
- Time-based computation with proper delta timing

The controller returns:
- Positive control signal when process variable is below setpoint
- Negative control signal when process variable is above setpoint

Example Usage:
    pid = PIDControl(Kp=1.0, Ki=0.5, Kd=0.1, T=100, max_control=255, min_control=-255)
    pid.setpoint = 50.0
    pid.sensed_output = 40.0
    
    control_output = pid.compute()
    print(f"Control Signal: {control_output}")
"""


class PIDControl:
    """
    PID Controller Class

    Implements a discrete-time PID controller with anti-windup protection
    and configurable bounds for control output.
    """

    def __init__(
        self, Kp=0.0, Ki=0.0, Kd=0.0, T=100, max_control=100, min_control=-100
    ):
        """
        Initialize the PID controller.

        Args:
            Kp (float): Proportional gain
            Ki (float): Integral gain
            Kd (float): Derivative gain
            T (int): Sample time in milliseconds
            max_control (float): Maximum control signal output
            min_control (float): Minimum control signal output
        """
        # Process variables
        self.sensed_output = 0.0
        self.setpoint = 0.0
        self.control_signal = 0.0

        # PID parameters
        self.Kp = Kp
        self.Ki = Ki
        self.Kd = Kd
        self.T = T  # Sample time in milliseconds

        # Control bounds
        self.max_control = max_control
        self.min_control = min_control

        # Internal state variables
        self._total_error = 0.0  # Accumulated error for integral term
        self._last_error = 0.0  # Previous error for derivative term
        self._last_time = self._get_time_ms()  # Previous computation time

    def _get_time_ms(self):
        """
        Get current time in milliseconds.

        Returns:
            int: Current time in milliseconds since epoch
        """
        return int(round(time.time() * 1000))

    def _clamp(self, value, min_val, max_val):
        """
        Clamp a value between minimum and maximum bounds.

        Args:
            value (float): Value to clamp
            min_val (float): Minimum bound
            max_val (float): Maximum bound

        Returns:
            float: Clamped value
        """
        return max(min_val, min(max_val, value))

    def compute(self):
        """
        Perform PID control computation.

        Calculates the control signal based on current error, accumulated error,
        and rate of error change. Only computes when sufficient time has elapsed
        based on the configured sample time.

        Returns:
            float: Control signal output (clamped to bounds)
        """
        current_time = self._get_time_ms()
        delta_time = current_time - self._last_time

        # Only compute if enough time has passed
        if delta_time >= self.T:
            # Calculate current error
            error = self.setpoint - self.sensed_output

            # Proportional term
            proportional = self.Kp * error

            # Integral term with anti-windup
            self._total_error += error
            self._total_error = self._clamp(
                self._total_error, self.min_control, self.max_control
            )
            integral = (self.Ki * self.T) * self._total_error

            # Derivative term
            delta_error = error - self._last_error
            derivative = (self.Kd / self.T) * delta_error

            # Compute total control signal
            self.control_signal = proportional + integral + derivative

            # Apply output bounds
            self.control_signal = self._clamp(
                self.control_signal, -self.max_control, self.max_control
            )

            # Update state for next computation
            self._last_error = error
            self._last_time = current_time

        return self.control_signal

    def reset(self):
        """
        Reset the PID controller internal state.

        Clears accumulated error and resets timing. Useful when changing
        setpoints or restarting control after a pause.
        """
        self._total_error = 0.0
        self._last_error = 0.0
        self._last_time = self._get_time_ms()
        self.control_signal = 0.0

    def set_gains(self, Kp=None, Ki=None, Kd=None):
        """
        Update PID gains during runtime.

        Args:
            Kp (float, optional): New proportional gain
            Ki (float, optional): New integral gain
            Kd (float, optional): New derivative gain
        """
        if Kp is not None:
            self.Kp = Kp
        if Ki is not None:
            self.Ki = Ki
        if Kd is not None:
            self.Kd = Kd

    def set_output_limits(self, min_control=None, max_control=None):
        """
        Update control signal output limits.

        Args:
            min_control (float, optional): New minimum control limit
            max_control (float, optional): New maximum control limit
        """
        if min_control is not None:
            self.min_control = min_control
        if max_control is not None:
            self.max_control = max_control

    def get_status(self):
        """
        Get current PID controller status and parameters.

        Returns:
            dict: Dictionary containing current PID state and parameters
        """
        return {
            "setpoint": self.setpoint,
            "sensed_output": self.sensed_output,
            "control_signal": self.control_signal,
            "error": self.setpoint - self.sensed_output,
            "gains": {"Kp": self.Kp, "Ki": self.Ki, "Kd": self.Kd},
            "sample_time": self.T,
            "output_limits": {"min": self.min_control, "max": self.max_control},
        }
